// SalesLedger — Cloudflare Workers 入口
// 路由分发 + 错误处理 + 自动建表 + 静态资源

import { handleTransactions, handleTransactionItem } from './transactions.js';
import { handleSummary } from './summary.js';
import { SCHEMA_STATEMENTS } from './schema.js';

// 单例：确保只初始化一次
let schemaPromise = null;
function ensureSchema(env) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      for (const stmt of SCHEMA_STATEMENTS) {
        await env.DB.prepare(stmt).run();
      }
    })().catch(err => {
      schemaPromise = null;
      console.error('[Schema Init]', err);
      throw err;
    });
  }
  return schemaPromise;
}

// 静态资源回退
async function serveAssets(request, env) {
  const url = new URL(request.url);
  let pathname = url.pathname;
  if (pathname === '/') pathname = '/index.html';

  // ASSETS.fetch 接受路径字符串或 Request
  try {
    return await env.ASSETS.fetch('https://placeholder' + pathname);
  } catch (e) {
    console.error('[Assets]', pathname, e?.message);
    return new Response('Not Found: ' + pathname, { status: 404 });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // 预检请求
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API 路由
    if (path.startsWith('/api/')) {
      try {
        await ensureSchema(env);

        let response;

        if (path === '/api/v1/health') {
          response = Response.json({ data: { status: 'ok', version: '1.0.0' } });
        } else if (path === '/api/v1/transactions' && ['GET', 'POST'].includes(method)) {
          response = await handleTransactions(request, env);
        } else if (path.match(/^\/api\/v1\/transactions\/\d+$/) && ['GET', 'PATCH', 'DELETE'].includes(method)) {
          const id = parseInt(path.split('/').pop(), 10);
          response = await handleTransactionItem(request, env, id);
        } else if (path === '/api/v1/summary' && method === 'GET') {
          response = await handleSummary(request, env);
        } else {
          response = jsonError('RESOURCE_NOT_FOUND', '接口不存在: ' + path, 404);
        }

        Object.entries(corsHeaders).forEach(([k, v]) => response.headers.append(k, v));
        return response;
      } catch (err) {
        console.error('[Worker API Error]', err);
        const isDev = env.ENV === 'development';
        const msg = isDev ? ('服务器内部错误: ' + (err?.message || String(err))) : '服务器内部错误';
        const resp = jsonError('INTERNAL_ERROR', msg, 500);
        Object.entries(corsHeaders).forEach(([k, v]) => resp.headers.append(k, v));
        return resp;
      }
    }

    // 静态资源
    return serveAssets(request, env);
  },
};

export function jsonError(code, message, status = 400, details = null) {
  const body = { error: { code, message } };
  if (details) body.error.details = details;
  return Response.json(body, { status });
}
