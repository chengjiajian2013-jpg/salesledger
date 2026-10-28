// 紫微斗数每日运势 API 客户端
import { getAuthHeaders } from './auth.js';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8787/api/v1'
  : '/api/v1';

/**
 * 获取用户列表
 */
export async function getZiweiUsers() {
  const response = await fetch(`${API_BASE}/ziwei/users`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('获取用户列表失败');
  }

  const result = await response.json();
  return result.data;
}

/**
 * 获取指定用户的今日运势
 * @param {string} userId - 用户ID (joey/wife)
 */
export async function getDailyFortune(userId) {
  const response = await fetch(`${API_BASE}/ziwei/daily/${userId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('获取今日运势失败');
  }

  const result = await response.json();
  return result.data;
}

/**
 * 获取完整命盘
 * @param {string} userId - 用户ID
 */
export async function getFullChart(userId) {
  const response = await fetch(`${API_BASE}/ziwei/chart/${userId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('获取命盘失败');
  }

  const result = await response.json();
  return result.data;
}
