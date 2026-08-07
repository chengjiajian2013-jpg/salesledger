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
