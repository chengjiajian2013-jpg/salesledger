export const LEDGER_CATEGORIES = {
  expense: ['food', 'transport', 'shopping', 'home', 'medical', 'leisure', 'other'],
  income: ['salary', 'bonus', 'side', 'gift', 'refund', 'other'],
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export function validateMonth(value) {
  const match = MONTH_PATTERN.exec(String(value || ''));
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function isValidDate(value) {
  if (!DATE_PATTERN.test(String(value || ''))) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function validateLedgerEntry(input, { partial = false } = {}) {
  const value = input || {};
  const errors = [];

  if (!partial || value.type !== undefined) {
    if (!['income', 'expense'].includes(value.type)) {
      errors.push(fieldError('type', '收支类型必须是收入或支出'));
    }
  }

  if (!partial || value.amount !== undefined) {
    if (typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount < 0.01) {
      errors.push(fieldError('amount', '金额不能少于 0.01 元'));
    } else if (value.amount > 99999999) {
      errors.push(fieldError('amount', '金额不能超过 99,999,999'));
    } else if (Math.abs(value.amount * 100 - Math.round(value.amount * 100)) > 1e-8) {
      errors.push(fieldError('amount', '金额最多保留两位小数'));
    }
  }

  if (!partial || value.category !== undefined) {
    const allowed = value.type
      ? LEDGER_CATEGORIES[value.type] || []
      : Object.values(LEDGER_CATEGORIES).flat();
    if (!allowed.includes(value.category)) {
      errors.push(fieldError('category', '请选择与收支类型匹配的分类'));
    }
  }

  if (!partial || value.date !== undefined) {
    if (!isValidDate(value.date)) {
      errors.push(fieldError('date', '请选择有效日期'));
    }
  }

  if (value.note !== undefined && value.note !== null) {
    if (typeof value.note !== 'string' || value.note.trim().length > 200) {
      errors.push(fieldError('note', '备注不能超过 200 个字符'));
    }
  }

  return errors;
}

export function validateTodo(input, { partial = false } = {}) {
  const value = input || {};
  const errors = [];

  if (!partial || value.content !== undefined) {
    if (typeof value.content !== 'string' || !value.content.trim()) {
      errors.push(fieldError('content', '请输入待办事项'));
    } else if (value.content.trim().length > 120) {
      errors.push(fieldError('content', '待办事项不能超过 120 个字符'));
    }
  }

  if (value.dueDate !== undefined && value.dueDate !== null && value.dueDate !== '') {
    if (!isValidDate(value.dueDate)) {
      errors.push(fieldError('dueDate', '请选择有效截止日期'));
    }
  }

  if (value.isCompleted !== undefined && typeof value.isCompleted !== 'boolean') {
    errors.push(fieldError('isCompleted', '完成状态必须是布尔值'));
  }

  return errors;
}

function fieldError(field, message) {
  return { field, code: 'INVALID_VALUE', message };
}
