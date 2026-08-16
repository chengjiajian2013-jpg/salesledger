// 风华记账API模块

/**
 * 生成唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 获取交易列表
 * GET /api/v1/fenghua/transactions?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&type=expense|income&category=xxx
 */
export async function handleGetFenghuaTransactions(request, env) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const type = url.searchParams.get('type');
  const category = url.searchParams.get('category');

  let sql = `SELECT * FROM fenghua_transactions WHERE 1=1`;
  const params = [];

  if (startDate) {
    sql += ` AND date >= ?`;
    params.push(startDate);
  }
  if (endDate) {
    sql += ` AND date <= ?`;
    params.push(endDate);
  }
  if (type) {
    sql += ` AND type = ?`;
    params.push(type);
  }
  if (category && category !== 'all') {
    sql += ` AND category = ?`;
    params.push(category);
  }

  sql += ` ORDER BY date DESC, created_at DESC`;

  const { results } = await env.DB.prepare(sql).bind(...params).all();

  return new Response(JSON.stringify({ data: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 创建交易
 * POST /api/v1/fenghua/transactions
 * Body: { type, amount, category, title, date }
 */
export async function handleCreateFenghuaTransaction(request, env) {
  const body = await request.json();

  if (!body.type || !body.amount || !body.category || !body.title || !body.date) {
    return new Response(JSON.stringify({ error: { message: '缺少必填字段' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!['expense', 'income'].includes(body.type)) {
    return new Response(JSON.stringify({ error: { message: 'type必须是expense或income' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const id = generateId();
  await env.DB.prepare(`
    INSERT INTO fenghua_transactions (id, type, amount, category, title, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, body.type, body.amount, body.category, body.title, body.date).run();

  const transaction = await env.DB.prepare(`
    SELECT * FROM fenghua_transactions WHERE id = ?
  `).bind(id).first();

  return new Response(JSON.stringify({ data: transaction }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 更新交易
 * PATCH /api/v1/fenghua/transactions/:id
 */
export async function handleUpdateFenghuaTransaction(request, env, id) {
  const body = await request.json();
  const updates = [];
  const params = [];

  if (body.type !== undefined) {
    updates.push('type = ?');
    params.push(body.type);
  }
  if (body.amount !== undefined) {
    updates.push('amount = ?');
    params.push(body.amount);
  }
  if (body.category !== undefined) {
    updates.push('category = ?');
    params.push(body.category);
  }
  if (body.title !== undefined) {
    updates.push('title = ?');
    params.push(body.title);
  }
  if (body.date !== undefined) {
    updates.push('date = ?');
    params.push(body.date);
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
    UPDATE fenghua_transactions SET ${updates.join(', ')} WHERE id = ?
  `).bind(...params).run();

  const transaction = await env.DB.prepare(`
    SELECT * FROM fenghua_transactions WHERE id = ?
  `).bind(id).first();

  return new Response(JSON.stringify({ data: transaction }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 删除交易
 * DELETE /api/v1/fenghua/transactions/:id
 */
export async function handleDeleteFenghuaTransaction(request, env, id) {
  const result = await env.DB.prepare(`
    DELETE FROM fenghua_transactions WHERE id = ?
  `).bind(id).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ error: { message: '记录不存在' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ data: { success: true } }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 获取月度汇总
 * GET /api/v1/fenghua/summary?year=YYYY&month=MM
 */
export async function handleGetFenghuaSummary(request, env) {
  const url = new URL(request.url);
  const year = url.searchParams.get('year') || new Date().getFullYear();
  const month = url.searchParams.get('month') || String(new Date().getMonth() + 1).padStart(2, '0');

  const startDate = `${year}-${month}-01`;
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  const endDate = `${year}-${month}-${lastDay}`;

  const { results } = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense,
      COUNT(*) as count
    FROM fenghua_transactions
    WHERE date >= ? AND date <= ?
  `).bind(startDate, endDate).all();

  const summary = results[0] || { income: 0, expense: 0, count: 0 };
  summary.balance = summary.income - summary.expense;

  return new Response(JSON.stringify({ data: summary }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
