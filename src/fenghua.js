import { validateLedgerEntry, validateMonth } from './fenghuaValidation.mjs';

export async function handleFenghuaEntries(request, env) {
  if (request.method === 'GET') return listEntries(request, env);
  if (request.method === 'POST') return createEntry(request, env);
  return jsonError('METHOD_NOT_ALLOWED', '请求方法不支持', 405);
}

export async function handleFenghuaEntry(request, env, id) {
  if (request.method === 'PATCH') return updateEntry(request, env, id);
  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM fenghua_entries WHERE id = ?').bind(id).run();
    return new Response(null, { status: 204 });
  }
  return jsonError('METHOD_NOT_ALLOWED', '请求方法不支持', 405);
}

async function listEntries(request, env) {
  const params = new URL(request.url).searchParams;
  const month = params.get('month');
  if (!validateMonth(month)) return jsonError('INVALID_QUERY', '月份格式应为 YYYY-MM', 400);

  const page = positiveInt(params.get('page'), 1);
  const pageSize = Math.min(100, positiveInt(params.get('pageSize'), 100));
  const startDate = `${month}-01`;
  const [year, monthNumber] = month.split('-').map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1));
  const endDate = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const offset = (page - 1) * pageSize;

  const [rows, totalRow, summary] = await Promise.all([
    env.DB.prepare(`
      SELECT id, type, amount, category, date, note, created_at, updated_at
      FROM fenghua_entries
      WHERE date >= ? AND date < ?
      ORDER BY date DESC, id DESC
      LIMIT ? OFFSET ?
    `).bind(startDate, endDate, pageSize, offset).all(),
    env.DB.prepare('SELECT COUNT(*) AS total FROM fenghua_entries WHERE date >= ? AND date < ?')
      .bind(startDate, endDate).first(),
    env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
      FROM fenghua_entries
      WHERE date >= ? AND date < ?
    `).bind(startDate, endDate).first(),
  ]);

  const totalItems = Number(totalRow?.total || 0);
  const income = round2(summary?.income);
  const expense = round2(summary?.expense);
  return Response.json({
    data: rows.results.map(formatEntry),
    meta: {
      month,
      summary: { income, expense, balance: round2(income - expense) },
      pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    },
  });
}

async function createEntry(request, env) {
  const body = await readJson(request);
  if (body instanceof Response) return body;
  if (!isObjectBody(body)) return invalidBody();

  const normalized = normalizeEntry(body);
  const errors = validateLedgerEntry(normalized);
  if (errors.length) return jsonError('VALIDATION_ERROR', '账目内容有误', 422, errors);

  const result = await env.DB.prepare(`
    INSERT INTO fenghua_entries (type, amount, category, date, note)
    VALUES (?, ?, ?, ?, ?)
  `).bind(normalized.type, round2(normalized.amount), normalized.category, normalized.date, normalized.note).run();

  return Response.json({ data: await getEntry(env, result.meta.last_row_id) }, { status: 201 });
}

async function updateEntry(request, env, id) {
  const existing = await getEntry(env, id);
  if (!existing) return jsonError('RESOURCE_NOT_FOUND', '账目不存在', 404);

  const body = await readJson(request);
  if (body instanceof Response) return body;
  if (!isObjectBody(body)) return invalidBody();
  const merged = normalizeEntry({ ...existing, ...body });
  const errors = validateLedgerEntry(merged);
  if (errors.length) return jsonError('VALIDATION_ERROR', '账目内容有误', 422, errors);

  await env.DB.prepare(`
    UPDATE fenghua_entries
    SET type = ?, amount = ?, category = ?, date = ?, note = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(merged.type, round2(merged.amount), merged.category, merged.date, merged.note, id).run();

  return Response.json({ data: await getEntry(env, id) });
}

async function getEntry(env, id) {
  const row = await env.DB.prepare(`
    SELECT id, type, amount, category, date, note, created_at, updated_at
    FROM fenghua_entries WHERE id = ?
  `).bind(id).first();
  return row ? formatEntry(row) : null;
}

function normalizeEntry(value) {
  return {
    type: value.type,
    amount: typeof value.amount === 'string' ? Number(value.amount) : value.amount,
    category: value.category,
    date: value.date,
    note: typeof value.note === 'string' ? value.note.trim() : '',
  };
}

function formatEntry(row) {
  return {
    id: row.id,
    type: row.type,
    amount: round2(row.amount),
    category: row.category,
    date: row.date,
    note: row.note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function readJson(request) {
  try { return await request.json(); }
  catch { return jsonError('MALFORMED_JSON', '请求体 JSON 解析失败', 400); }
}

function isObjectBody(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalidBody() {
  return jsonError('VALIDATION_ERROR', '账目内容有误', 422, [
    { field: 'body', code: 'INVALID_VALUE', message: '请求体必须是 JSON 对象' },
  ]);
}

function jsonError(code, message, status, details = null) {
  const body = { error: { code, message } };
  if (details) body.error.details = details;
  return Response.json(body, { status });
}
