// SalesLedger —— 校验中间件（服务端唯一真值）

const CHANNELS = ['quota', 'direct', 'recovery', 'other'];
const SELLERS = ['company', 'personal'];

export function validateTransaction(input, { partial = false } = {}) {
  const errors = [];
  const v = input || {};

  // seller
  if (!partial || v.seller !== undefined) {
    if (!v.seller) errors.push({ field: 'seller', code: 'REQUIRED', message: '销售类型不能为空' });
    else if (!SELLERS.includes(v.seller)) {
      errors.push({ field: 'seller', code: 'INVALID_ENUM', message: `销售类型必须是 ${SELLERS.join(' / ')}` });
    }
  }

  // date
  if (!partial || v.date !== undefined) {
    if (!v.date) errors.push({ field: 'date', code: 'REQUIRED', message: '日期不能为空' });
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) {
      errors.push({ field: 'date', code: 'INVALID_FORMAT', message: '日期格式应为 YYYY-MM-DD' });
    } else if (isNaN(Date.parse(v.date))) {
      errors.push({ field: 'date', code: 'INVALID_DATE', message: '日期不合法' });
    } else {
      const d = new Date(v.date + 'T00:00:00Z');
      const max = new Date();
      max.setUTCDate(max.getUTCDate() + 7);
      if (d > max) errors.push({ field: 'date', code: 'DATE_IN_FUTURE', message: '日期不能超过今天 7 天' });
    }
  }

  // product
  if (!partial || v.product !== undefined) {
    if (!v.product) errors.push({ field: 'product', code: 'REQUIRED', message: '商品名不能为空' });
    else if (String(v.product).length > 200) {
      errors.push({ field: 'product', code: 'LENGTH_OUT_OF_RANGE', message: '商品名不能超过 200 字符' });
    }
  }

  // channel
  if (!partial || v.channel !== undefined) {
    if (!v.channel) errors.push({ field: 'channel', code: 'REQUIRED', message: '渠道不能为空' });
    else if (!CHANNELS.includes(v.channel)) {
      errors.push({ field: 'channel', code: 'INVALID_ENUM', message: `渠道必须是 ${CHANNELS.join(' / ')}` });
    }
  }

  // cost（可选，但不能为负）
  if (v.cost !== undefined && v.cost !== null && v.cost !== '') {
    if (typeof v.cost !== 'number' || isNaN(v.cost)) {
      errors.push({ field: 'cost', code: 'INVALID_TYPE', message: '成本必须是数字' });
    } else if (v.cost < 0) errors.push({ field: 'cost', code: 'MIN_VALUE', message: '成本不能为负数' });
  }

  // price（可选，但不能为负）
  if (v.price !== undefined && v.price !== null && v.price !== '') {
    if (typeof v.price !== 'number' || isNaN(v.price)) {
      errors.push({ field: 'price', code: 'INVALID_TYPE', message: '售价必须是数字' });
    } else if (v.price < 0) errors.push({ field: 'price', code: 'MIN_VALUE', message: '售价不能为负数' });
    else if (v.price > 9999999) errors.push({ field: 'price', code: 'MAX_VALUE', message: '售价不能超过 9,999,999' });
  }

  // commission_rate（必填，0~1）
  if (!partial || v.commission_rate !== undefined) {
    if (v.commission_rate === undefined || v.commission_rate === null) {
      if (!partial) errors.push({ field: 'commission_rate', code: 'REQUIRED', message: '佣金比例不能为空' });
    } else if (typeof v.commission_rate !== 'number' || isNaN(v.commission_rate)) {
      errors.push({ field: 'commission_rate', code: 'INVALID_TYPE', message: '佣金比例必须是数字' });
    } else if (v.commission_rate < 0 || v.commission_rate > 1) {
      errors.push({ field: 'commission_rate', code: 'OUT_OF_RANGE', message: '佣金比例必须在 0%~100%' });
    }
  }

  // profit（必填）
  if (!partial || v.profit !== undefined) {
    if (v.profit === undefined || v.profit === null) {
      if (!partial) errors.push({ field: 'profit', code: 'REQUIRED', message: '利润不能为空' });
    } else if (typeof v.profit !== 'number' || isNaN(v.profit)) {
      errors.push({ field: 'profit', code: 'INVALID_TYPE', message: '利润必须是数字' });
    }
  }

  // note
  if (v.note !== undefined && v.note !== null) {
    if (String(v.note).length > 500) {
      errors.push({ field: 'note', code: 'LENGTH_OUT_OF_RANGE', message: '备注不能超过 500 字符' });
    }
  }

  return errors;
}
