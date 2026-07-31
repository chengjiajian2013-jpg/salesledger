// SalesLedger — 统计接口（v2：支持按 seller 分组）

export async function handleSummary(request, env) {
  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const seller = url.searchParams.get('seller');

  if (!startDate || !endDate) {
    return jsonError('INVALID_QUERY', 'startDate 和 endDate 必填', 400);
  }

  const days = Math.floor((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
  if (days > 366) return jsonError('INVALID_QUERY', '日期范围不能超过 366 天', 400);

  let where = 'WHERE date >= ? AND date <= ?';
  const bindings = [startDate, endDate];
  if (seller) { where += ' AND seller = ?'; bindings.push(seller); }

  const total = await env.DB
    .prepare(`
      SELECT
        COALESCE(SUM(price), 0)  AS totalRevenue,
        COALESCE(SUM(cost), 0)   AS totalCost,
        COALESCE(SUM(profit), 0) AS totalProfit,
        COUNT(*)                 AS transactionCount
      FROM transactions ${where}
    `)
    .bind(...bindings)
    .first();

  const totalProfit = round2(total.totalProfit);
  const count = total.transactionCount;
  const averageProfit = count > 0 ? round2(totalProfit / count) : 0;

  const byChannel = await env.DB
    .prepare(`
      SELECT channel,
        COALESCE(SUM(profit), 0) AS profit,
        COUNT(*) AS count
      FROM transactions ${where}
      GROUP BY channel
      ORDER BY profit DESC
    `)
    .bind(...bindings)
    .all();

  const daily = await env.DB
    .prepare(`
      SELECT date,
        COALESCE(SUM(profit), 0) AS profit,
        COUNT(*) AS count
      FROM transactions ${where}
      GROUP BY date
      ORDER BY date ASC
    `)
    .bind(...bindings)
    .all();

  return Response.json({
    data: {
      period: { startDate, endDate },
      filter: { seller: seller || 'all' },
      totalRevenue: round2(total.totalRevenue),
      totalCost: round2(total.totalCost),
      totalProfit,
      transactionCount: count,
      averageProfit,
      byChannel: byChannel.results.map(c => ({
        channel: c.channel, profit: round2(c.profit), count: c.count,
      })),
      daily: daily.results.map(d => ({
        date: d.date, profit: round2(d.profit), count: d.count,
      })),
    },
  });
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function jsonError(code, message, status = 400) {
  return Response.json({ error: { code, message } }, { status });
}
