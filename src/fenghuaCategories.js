import { validateCategory } from './fenghuaValidation.mjs';

export async function handleFenghuaCategories(request, env) {
  if (request.method === 'GET') return listCategories(request, env);
  if (request.method === 'POST') return createCategory(request, env);
  return jsonError('METHOD_NOT_ALLOWED', '请求方法不支持', 405);
}

async function listCategories(request, env) {
  const type = new URL(request.url).searchParams.get('type');
  if (type && !['income', 'expense'].includes(type)) {
    return jsonError('INVALID_QUERY', '分类类型必须是收入或支出', 400);
  }

  const query = type
    ? `SELECT id, category_key, type, name, created_at, updated_at
       FROM fenghua_categories WHERE type = ? ORDER BY name COLLATE NOCASE, id`
    : `SELECT id, category_key, type, name, created_at, updated_at
       FROM fenghua_categories ORDER BY type, name COLLATE NOCASE, id`;
  const statement = env.DB.prepare(query);
  const rows = type ? await statement.bind(type).all() : await statement.all();
  return Response.json({ data: (rows.results || []).map(formatCategory) });
}

async function createCategory(request, env) {
  const body = await readJson(request);
  if (body instanceof Response) return body;
  if (!isObjectBody(body)) return invalidBody();

  const normalized = { type: body.type, name: typeof body.name === 'string' ? body.name.trim() : body.name };
  const errors = validateCategory(normalized);
  if (errors.length) return jsonError('VALIDATION_ERROR', '分类内容有误', 422, errors);

  const existing = await env.DB.prepare(`
    SELECT id FROM fenghua_categories
    WHERE type = ? AND lower(name) = lower(?)
    LIMIT 1
  `).bind(normalized.type, normalized.name).first();
  if (existing) return jsonError('CATEGORY_EXISTS', '这个分类已经存在', 409, [
    { field: 'name', code: 'DUPLICATE_VALUE', message: '这个分类已经存在' },
  ]);

  let result;
  try {
    result = await env.DB.prepare(`
      INSERT INTO fenghua_categories (type, name, category_key)
      VALUES (?, ?, 'custom:pending-' || lower(hex(randomblob(8))))
    `).bind(normalized.type, normalized.name).run();
  } catch (error) {
    if (/unique|duplicate/i.test(String(error?.message || error))) {
      return jsonError('CATEGORY_EXISTS', '这个分类已经存在', 409);
    }
    throw error;
  }

  const id = Math.trunc(Number(result.meta.last_row_id));
  await env.DB.prepare(`
    UPDATE fenghua_categories SET category_key = ? WHERE id = ?
  `).bind(`custom:${id}`, id).run();
  const category = await getCategory(env, id);
  return Response.json({ data: category }, { status: 201 });
}

async function getCategory(env, id) {
  const row = await env.DB.prepare(`
    SELECT id, category_key, type, name, created_at, updated_at
    FROM fenghua_categories WHERE id = ?
  `).bind(id).first();
  return row ? formatCategory(row) : null;
}

function formatCategory(row) {
  return {
    id: row.id,
    key: row.category_key,
    type: row.type,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readJson(request) {
  try { return await request.json(); }
  catch { return jsonError('MALFORMED_JSON', '请求体 JSON 解析失败', 400); }
}

function isObjectBody(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalidBody() {
  return jsonError('VALIDATION_ERROR', '分类内容有误', 422, [
    { field: 'body', code: 'INVALID_VALUE', message: '请求体必须是 JSON 对象' },
  ]);
}

function jsonError(code, message, status, details = null) {
  const body = { error: { code, message } };
  if (details) body.error.details = details;
  return Response.json(body, { status });
}
