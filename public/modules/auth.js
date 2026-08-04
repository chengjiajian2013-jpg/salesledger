// SalesLedger — 前端认证模块
// Token 管理和登录逻辑

const TOKEN_KEY = 'salesledger_token';

// 获取 Token
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

// 设置 Token
export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

// 清除 Token
export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

// 检查是否已登录
export function isAuthenticated() {
  return !!getToken();
}

// 登录
export async function login(password) {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || '登录失败');
  }

  const data = await response.json();
  setToken(data.data.token);
  return data.data.token;
}

// 登出
export function logout() {
  clearToken();
  window.location.reload();
}
