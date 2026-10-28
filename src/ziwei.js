// 紫微斗数每日运势后端 API
// 使用 iztro 库进行排盘计算

import { jsonResponse, jsonError } from './utils.js';

// 用户信息配置
const USERS = {
  joey: {
    id: 'joey',
    name: 'Jian',
    displayName: 'Jian',
    gender: '男',
    birthDate: '1994-12-08',
    birthTime: 6, // 午时（默认值，待确认准确时辰）
    birthPlace: '上海',
    isLunar: false,
  },
  wife: {
    id: 'wife',
    name: '老婆',
    displayName: '老婆',
    gender: '女',
    birthDate: '1995-02-27',
    birthTime: 6, // 午时（默认值，待确认准确时辰）
    birthPlace: '上海',
    isLunar: false,
  },
};

/**
 * 获取用户列表
 */
export async function handleGetZiweiUsers() {
  const users = Object.values(USERS).map(u => ({
    id: u.id,
    name: u.displayName,
  }));

  return jsonResponse({ users });
}

/**
 * 获取今日运势
 */
export async function handleGetDailyFortune(request, env, userId) {
  const user = USERS[userId];
  if (!user) {
    return jsonError('USER_NOT_FOUND', '用户不存在', 404);
  }

  try {
    // 注意: iztro 需要通过 CDN 在前端加载
    // 这里返回基础数据，排盘计算在前端完成
    const today = new Date();

    return jsonResponse({
      user: {
        id: user.id,
        name: user.displayName,
      },
      birthInfo: {
        date: user.birthDate,
        time: user.birthTime,
        gender: user.gender,
        isLunar: user.isLunar,
      },
      today: today.toISOString().split('T')[0],
    });
  } catch (error) {
    console.error('[Ziwei Error]', error);
    return jsonError('CALCULATION_ERROR', '运势计算失败', 500);
  }
}

/**
 * 获取完整命盘数据
 */
export async function handleGetFullChart(request, env, userId) {
  const user = USERS[userId];
  if (!user) {
    return jsonError('USER_NOT_FOUND', '用户不存在', 404);
  }

  return jsonResponse({
    user: {
      id: user.id,
      name: user.displayName,
    },
    birthInfo: {
      date: user.birthDate,
      time: user.birthTime,
      gender: user.gender,
      place: user.birthPlace,
      isLunar: user.isLunar,
    },
  });
}
