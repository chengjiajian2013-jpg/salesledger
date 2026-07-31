// SalesLedger — 佣金配置
// 利润率默认值（表单里可调）

export const COMMISSION_DEFAULTS = {
  company: {
    quota:    { label: '额度', defaultRate: 0.02 },
    direct:   { label: '直款', defaultRate: 0.10 },
    recovery: { label: '回收', defaultRate: 0.40 },
    other:    { label: '其他', defaultRate: 0 },
  },
  personal: {
    quota:    { label: '额度', defaultRate: 0.02 },
    direct:   { label: '直款', defaultRate: 1.00 },
    recovery: { label: '回收', defaultRate: 0.40 },
    other:    { label: '其他', defaultRate: 0 },
  },
};

// 渠道列表（通用）
export const CHANNELS = ['quota', 'direct', 'recovery', 'other'];

// 计算利润（前端预览用，真值在用户输入/提交时确定）
// profit = (price - cost) * rate
// other 渠道：profit 直接手填，忽略公式
export function calcProfit({ channel, price, cost, rate }) {
  if (channel === 'other') return null; // 手填
  const p = Number(price) || 0;
  const c = Number(cost) || 0;
  const r = Number(rate) || 0;
  return Math.round((p - c) * r * 100) / 100;
}

// 格式化比例为"X%"显示
export function formatRate(rate) {
  return ((Number(rate) || 0) * 100).toFixed(1).replace(/\.0$/, '') + '%';
}
