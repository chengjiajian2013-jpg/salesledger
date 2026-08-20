import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeExpenseCategories } from '../public/modules/fenghuaReports.js';

test('expense report aggregates and sorts categories by monthly spend', () => {
  const report = summarizeExpenseCategories([
    { type: 'expense', category: 'food', amount: 28.5 },
    { type: 'expense', category: 'shopping', amount: 120 },
    { type: 'income', category: 'salary', amount: 5000 },
    { type: 'expense', category: 'food', amount: 11.5 },
    { type: 'expense', category: 'transport', amount: 20 },
  ], { food: '餐饮', shopping: '购物', transport: '交通' });

  assert.equal(report.totalExpense, 180);
  assert.deepEqual(report.categories.map(item => item.label), ['购物', '餐饮', '交通']);
  assert.deepEqual(report.categories.map(item => item.amount), [120, 40, 20]);
  assert.equal(report.categories[0].share, 120 / 180);
});

test('expense report ignores invalid amounts and supports an empty month', () => {
  assert.deepEqual(summarizeExpenseCategories([
    { type: 'income', category: 'salary', amount: 100 },
    { type: 'expense', category: 'food', amount: 0 },
    { type: 'expense', category: 'shopping', amount: 'bad' },
  ]), { totalExpense: 0, categories: [] });
});
