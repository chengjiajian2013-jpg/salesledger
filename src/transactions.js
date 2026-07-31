// SalesLedger — 交易相关路由处理器（v2：seller/commission）

import { validateTransaction } from './validation.js';

export async function handleTransactions(request, env) {
  if (request.method === 'GET') return listTransactions(request, env);
  if (request.method === 'POST') return createTransaction(request, env);
}

async function listTransactions(request, env) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const seller = params.get('seller');
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');
  const channel = params.get('channel');
  const keyword = params.get('keyword');
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(params.get('pageSize') || '20', 10)));
  const sortBy = ['date', 'price', 'profit', 'createdAt'].includes(params.get('sortBy'))
    ? params.get('sortBy') : 'date';
  const sortOrder = params.get('sortOrder') === 'asc' ? 'ASC' : 'DESC';

  const where = [];
  const bindings = [];

  if (seller) { where.push('seller = ?'); bindings.push(seller); }
  if (startDate) { where.push('date >= ?'); bindings.push(startDate); }
  if (endDate) { where.push('date <= ?'); bindings.push(endDate); }
  if (channel) { where.push('channel = ?'); bindings.push(channel); }
  if (keyword) { where.push('(product LIKE ? OR note LIKE ?)'); bindings.push(`%${keyword}%`, `%${keyword}%`); }

  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const countRow = await env.DB
    .prepare(`SELECT COUNT(*) as total FROM transactions ${whereSql}`)
    .bind(...bindings)
    .first();
  const totalItems = countRow.total;

  const sortColumn = sortBy === 'profit' ? 'profit' : sortBy;
  const offset = (page - 1) * pageSize;

  const rows = await env.DB
    .prepare(`
      SELECT id, seller, date, product, channel, cost, price, commission_rate, profit, account, note, created_at, updated_at
      FROM transactions
      ${whereSql}
      ORDER BY ${sortColumn} ${sortOrder}, id DESC
      LIMIT ? OFFSET ?
    `)
    .bind(...bindings, pageSize, offset)
    .all();

  return Response.json({
    data: rows.results.map(formatTransaction),
    meta: { pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } },
  });
}

async function createTransaction(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return jsonError('MALFORMED_JSON', '请求体 JSON 解析失败', 400); }

  const errors = validateTransaction(body, { partial: false });
  if (errors.length) return jsonError('VALIDATION_ERROR', '请求数据校验失败', 422, errors);

  const cost = body.cost || 0;
  const price = body.price || 0;

  const result = await env.DB
    .prepare(`
      INSERT INTO transactions (seller, date, product, channel, cost, price, commission_rate, profit, account, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      body.seller || 'company',
      body.date,
      body.product,
      body.channel,
      cost,
      price,
      body.commission_rate,
      body.profit,
      body.account || '',
      body.note || ''
    )
    .run();

  return Response.json({ data: await getTransactionById(env, result.meta.last_row_id) }, { status: 201 });
}

export async function handleTransactionItem(request, env, id) {
  if (request.method === 'GET') {
    const txn = await getTransactionById(env, id);
    if (!txn) return jsonError('RESOURCE_NOT_FOUND', '记录不存在', 404);
    return Response.json({ data: txn });
  }

  if (request.method === 'PATCH') {
    const existing = await getTransactionById(env, id);
    if (!existing) return jsonError('RESOURCE_NOT_FOUND', '记录不存在', 404);

    let body;
    try { body = await request.json(); }
    catch { return jsonError('MALFORMED_JSON', '请求体 JSON 解析失败', 400); }

    const errors = validateTransaction(body, { partial: true });
    if (errors.length) return jsonError('VALIDATION_ERROR', '请求数据校验失败', 422, errors);

    // existing 使用 camelResponse 字段名（commissionRate），body 可能使用 snake_case（commission_rate）
    // 合并时统一处理，确保 UPDATE 拿到正确的值
    const merged = {
      seller: body.seller ?? existing.seller,
      date: body.date ?? existing.date,
      product: body.product ?? existing.product,
      channel: body.channel ?? existing.channel,
      cost: body.cost ?? existing.cost,
      price: body.price ?? existing.price,
      commission_rate: body.commission_rate ?? existing.commissionRate ?? existing.commission_rate ?? 0,
      profit: body.profit ?? existing.profit,
      account: body.account ?? existing.account ?? '',
      note: body.note ?? existing.note,
    };

    await env.DB
      .prepare(`
        UPDATE transactions
        SET seller=?, date=?, product=?, channel=?, cost=?, price=?, commission_rate=?, profit=?, account=?, note=?, updated_at=datetime('now')
        WHERE id = ?
      `)
      .bind(
        merged.seller, merged.date, merged.product, merged.channel,
        merged.cost || 0, merged.price || 0,
        merged.commission_rate, merged.profit, merged.account || '', merged.note || '', id
      )
      .run();

    return Response.json({ data: await getTransactionById(env, id) });
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();
    return new Response(null, { status: 204 });
  }
}

async function getTransactionById(env, id) {
  const row = await env.DB
    .prepare(`SELECT * FROM transactions WHERE id = ?`)
    .bind(id)
    .first();
  return row ? formatTransaction(row) : null;
}

function formatTransaction(row) {
  return {
    id: row.id,
    seller: row.seller,
    date: row.date,
    product: row.product,
    channel: row.channel,
    cost: round2(row.cost),
    price: round2(row.price),
    commissionRate: row.commission_rate,
    profit: round2(row.profit),
    account: row.account || '',
    note: row.note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function jsonError(code, message, status = 400, details = null) {
  const body = { error: { code, message } };
  if (details) body.error.details = details;
  return Response.json(body, { status });
}
