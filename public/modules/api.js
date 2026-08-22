// SalesLedger — API 通信层

import { getToken, clearToken } from './auth.js';

const BASE = '/api/v1';

// 加载动画控制
let loadingCount = 0;
let loadingOverlay = null;

function showLoading() {
  if (!loadingOverlay) {
    loadingOverlay = document.getElementById('loadingOverlay');
  }
  loadingCount++;
  if (loadingOverlay && loadingCount > 0) {
    loadingOverlay.classList.add('active');
  }
}

function hideLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingOverlay && loadingCount === 0) {
    loadingOverlay.classList.remove('active');
  }
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(BASE + path, location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  showLoading();

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;

    let data;
    try { data = await res.json(); } catch { data = null; }

    if (!res.ok) {
      // 401 未授权，清除 Token 并触发重新登录
      if (res.status === 401) {
        clearToken();
        window.location.reload();
        return;
      }

      const err = new Error(data?.error?.message || `HTTP ${res.status}`);
      err.code = data?.error?.code;
      err.details = data?.error?.details;
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    hideLoading();
  }
}

async function downloadReport(params) {
  const url = new URL(BASE + '/reports/export', location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  });
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  showLoading();
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 401) {
        clearToken();
        window.location.reload();
        return;
      }
      let error = null;
      try { error = await res.json(); } catch { /* keep generic error */ }
      const err = new Error(error?.error?.message || `HTTP ${res.status}`);
      err.code = error?.error?.code;
      err.status = res.status;
      throw err;
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const encodedName = disposition.match(/filename="([^"]+)"/i)?.[1];
    let filename = `${params?.ledger === 'personal' ? '个人账本' : '公司账本'}-${params?.month || ''}.xlsx`;
    if (utf8Name) {
      try { filename = decodeURIComponent(utf8Name); } catch { /* use the safe default */ }
    } else if (encodedName) {
      filename = encodedName;
    }
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return filename;
  } finally {
    hideLoading();
  }
}

export async function collectPaginated(fetchPage, params = {}) {
  const pageSize = 100;
  const baseParams = { ...params };
  delete baseParams.page;
  delete baseParams.pageSize;

  const first = await fetchPage({ ...baseParams, page: 1, pageSize });
  const data = [...(first?.data || [])];
  const totalPages = Math.max(1, Number(first?.meta?.pagination?.totalPages) || 1);

  for (let page = 2; page <= totalPages; page++) {
    const response = await fetchPage({ ...baseParams, page, pageSize });
    data.push(...(response?.data || []));
  }

  return { ...first, data };
}

export const api = {
  listTransactions: (params) => request('/transactions', { params }),
  getTransaction: (id) => request(`/transactions/${id}`),
  createTransaction: (body) => request('/transactions', { method: 'POST', body }),
  updateTransaction: (id, body) => request(`/transactions/${id}`, { method: 'PATCH', body }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
  getSummary: (params) => request('/summary', { params }),
  downloadReport,
  parse: (body) => request('/parse', { method: 'POST', body }),
  getOptions: () => request('/options'),
  listFenghuaEntries: (params) => collectPaginated(
    pageParams => request('/fenghua/entries', { params: pageParams }),
    params,
  ),
  createFenghuaEntry: (body) => request('/fenghua/entries', { method: 'POST', body }),
  updateFenghuaEntry: (id, body) => request(`/fenghua/entries/${id}`, { method: 'PATCH', body }),
  deleteFenghuaEntry: (id) => request(`/fenghua/entries/${id}`, { method: 'DELETE' }),
  listFenghuaCategories: (params) => request('/fenghua/categories', { params }),
  createFenghuaCategory: (body) => request('/fenghua/categories', { method: 'POST', body }),
  listFenghuaTodos: (params) => collectPaginated(
    pageParams => request('/fenghua/todos', { params: pageParams }),
    params,
  ),
  createFenghuaTodo: (body) => request('/fenghua/todos', { method: 'POST', body }),
  updateFenghuaTodo: (id, body) => request(`/fenghua/todos/${id}`, { method: 'PATCH', body }),
  deleteFenghuaTodo: (id) => request(`/fenghua/todos/${id}`, { method: 'DELETE' }),
  health: () => request('/health'),
};
