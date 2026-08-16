// 待办事项API模块

/**
 * 生成唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 获取待办列表
 * GET /api/v1/todos?filter=all|pending|completed
 */
export async function handleGetTodos(request, env) {
  const url = new URL(request.url);
  const filter = url.searchParams.get('filter') || 'all';

  let sql = `SELECT * FROM todos WHERE 1=1`;

  if (filter === 'pending') {
    sql += ` AND completed = 0`;
  } else if (filter === 'completed') {
    sql += ` AND completed = 1`;
  }

  sql += ` ORDER BY completed ASC, created_at DESC`;

  const { results } = await env.DB.prepare(sql).all();

  return new Response(JSON.stringify({ data: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 创建待办
 * POST /api/v1/todos
 * Body: { text }
 */
export async function handleCreateTodo(request, env) {
  const body = await request.json();

  if (!body.text || !body.text.trim()) {
    return new Response(JSON.stringify({ error: { message: '待办内容不能为空' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = generateId();
  await env.DB.prepare(`
    INSERT INTO todos (id, text, completed)
    VALUES (?, ?, 0)
  `).bind(id, body.text.trim()).run();

  const todo = await env.DB.prepare(`
    SELECT * FROM todos WHERE id = ?
  `).bind(id).first();

  return new Response(JSON.stringify({ data: todo }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 更新待办
 * PATCH /api/v1/todos/:id
 * Body: { text?, completed? }
 */
export async function handleUpdateTodo(request, env, id) {
  const body = await request.json();
  const updates = [];
  const params = [];

  if (body.text !== undefined) {
    updates.push('text = ?');
    params.push(body.text);
  }
  if (body.completed !== undefined) {
    updates.push('completed = ?');
    params.push(body.completed ? 1 : 0);
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: { message: '没有可更新的字段' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  updates.push('updated_at = datetime("now")');
  params.push(id);

  await env.DB.prepare(`
    UPDATE todos SET ${updates.join(', ')} WHERE id = ?
  `).bind(...params).run();

  const todo = await env.DB.prepare(`
    SELECT * FROM todos WHERE id = ?
  `).bind(id).first();

  return new Response(JSON.stringify({ data: todo }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 删除待办
 * DELETE /api/v1/todos/:id
 */
export async function handleDeleteTodo(request, env, id) {
  const result = await env.DB.prepare(`
    DELETE FROM todos WHERE id = ?
  `).bind(id).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ error: { message: '待办不存在' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ data: { success: true } }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 获取待办统计
 * GET /api/v1/todos/stats
 */
export async function handleGetTodoStats(request, env) {
  const { results } = await env.DB.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
    FROM todos
  `).all();

  const stats = results[0] || { total: 0, pending: 0, completed: 0 };

  return new Response(JSON.stringify({ data: stats }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
