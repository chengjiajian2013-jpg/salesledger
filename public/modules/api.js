// SalesLedger — API 通信层

const BASE = '/api/v1';

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(BASE + path, location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.code = data?.error?.code;
    err.details = data?.error?.details;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  listTransactions: (params) => request('/transactions', { params }),
  getTransaction: (id) => request(`/transactions/${id}`),
  createTransaction: (body) => request('/transactions', { method: 'POST', body }),
  updateTransaction: (id, body) => request(`/transactions/${id}`, { method: 'PATCH', body }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
  getSummary: (params) => request('/summary', { params }),
  parse: (body) => request('/parse', { method: 'POST', body }),
  getOptions: () => request('/options'),
  health: () => request('/health'),
};
