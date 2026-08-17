import { validateTodo } from './fenghuaValidation.mjs';

export async function handleFenghuaTodos(request, env) {
  if (request.method === 'GET') return listTodos(request, env);
  if (request.method === 'POST') return createTodo(request, env);
  return jsonError('METHOD_NOT_ALLOWED', '请求方法不支持', 405);
}

export async function handleFenghuaTodo(request, env, id) {
  if (request.method === 'PATCH') return updateTodo(request, env, id);
  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM fenghua_todos WHERE id = ?').bind(id).run();
    return new Response(null, { status: 204 });
  }
  return jsonError('METHOD_NOT_ALLOWED', '请求方法不支持', 405);
}

async function listTodos(request, env) {
  const params = new URL(request.url).searchParams;
  const page = positiveInt(params.get('page'), 1);
  const pageSize = Math.min(100, positiveInt(params.get('pageSize'), 100));
  const offset = (page - 1) * pageSize;

  const [rows, totalRow] = await Promise.all([
    env.DB.prepare(`
      SELECT id, content, due_date, is_completed, created_at, updated_at
      FROM fenghua_todos
      ORDER BY is_completed ASC, due_date IS NULL ASC, due_date ASC, id DESC
      LIMIT ? OFFSET ?
    `).bind(pageSize, offset).all(),
    env.DB.prepare('SELECT COUNT(*) AS total FROM fenghua_todos').first(),
  ]);

  const totalItems = Number(totalRow?.total || 0);
  return Response.json({
    data: rows.results.map(formatTodo),
    meta: { pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } },
  });
}

async function createTodo(request, env) {
  const body = await readJson(request);
  if (body instanceof Response) return body;
  if (!isObjectBody(body)) return invalidBody();
  const normalized = normalizeTodo(body);
  const errors = validateTodo(normalized);
  if (errors.length) return jsonError('VALIDATION_ERROR', '待办内容有误', 422, errors);

  const result = await env.DB.prepare(`
    INSERT INTO fenghua_todos (content, due_date, is_completed)
    VALUES (?, ?, ?)
  `).bind(normalized.content, normalized.dueDate, normalized.isCompleted ? 1 : 0).run();
  return Response.json({ data: await getTodo(env, result.meta.last_row_id) }, { status: 201 });
}

async function updateTodo(request, env, id) {
  const existing = await getTodo(env, id);
  if (!existing) return jsonError('RESOURCE_NOT_FOUND', '待办事项不存在', 404);

  const body = await readJson(request);
  if (body instanceof Response) return body;
  if (!isObjectBody(body)) return invalidBody();
  const merged = normalizeTodo({ ...existing, ...body });
  const errors = validateTodo(merged);
  if (errors.length) return jsonError('VALIDATION_ERROR', '待办内容有误', 422, errors);

  await env.DB.prepare(`
    UPDATE fenghua_todos
    SET content = ?, due_date = ?, is_completed = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(merged.content, merged.dueDate, merged.isCompleted ? 1 : 0, id).run();
  return Response.json({ data: await getTodo(env, id) });
}

async function getTodo(env, id) {
  const row = await env.DB.prepare(`
    SELECT id, content, due_date, is_completed, created_at, updated_at
    FROM fenghua_todos WHERE id = ?
  `).bind(id).first();
  return row ? formatTodo(row) : null;
}

function normalizeTodo(value) {
  return {
    content: typeof value.content === 'string' ? value.content.trim() : value.content,
    dueDate: value.dueDate === '' || value.dueDate === undefined ? null : value.dueDate,
    isCompleted: value.isCompleted ?? false,
  };
}

function formatTodo(row) {
  return {
    id: row.id,
    content: row.content,
    dueDate: row.due_date || null,
    isCompleted: Boolean(row.is_completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function readJson(request) {
  try { return await request.json(); }
  catch { return jsonError('MALFORMED_JSON', '请求体 JSON 解析失败', 400); }
}

function isObjectBody(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalidBody() {
  return jsonError('VALIDATION_ERROR', '待办内容有误', 422, [
    { field: 'body', code: 'INVALID_VALUE', message: '请求体必须是 JSON 对象' },
  ]);
}

function jsonError(code, message, status, details = null) {
  const body = { error: { code, message } };
  if (details) body.error.details = details;
  return Response.json(body, { status });
}
