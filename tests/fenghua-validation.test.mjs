import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateLedgerEntry,
  validateMonth,
  validateTodo,
} from '../src/fenghuaValidation.mjs';

test('validateMonth accepts calendar months and rejects malformed values', () => {
  assert.equal(validateMonth('2026-08'), true);
  assert.equal(validateMonth('2026-13'), false);
  assert.equal(validateMonth('August'), false);
});

test('ledger entries require a matching preset category and positive amount', () => {
  const valid = validateLedgerEntry({
    type: 'expense',
    amount: 88.5,
    category: 'food',
    date: '2026-08-17',
    note: '晚餐',
  });
  assert.deepEqual(valid, []);

  const invalid = validateLedgerEntry({
    type: 'income',
    amount: 0,
    category: 'food',
    date: '2026-08-17',
    note: '',
  });
  assert.deepEqual(invalid.map(error => error.field).sort(), ['amount', 'category']);
});

test('ledger amounts use yuan precision and reject sub-cent values', () => {
  assert.equal(validateLedgerEntry({
    type: 'expense',
    amount: 0.001,
    category: 'food',
    date: '2026-08-17',
  })[0].field, 'amount');

  assert.equal(validateLedgerEntry({
    type: 'expense',
    amount: 10.001,
    category: 'food',
    date: '2026-08-17',
  })[0].field, 'amount');
});

test('partial ledger validation checks only submitted fields', () => {
  assert.deepEqual(validateLedgerEntry({ note: '修改备注' }, { partial: true }), []);
  assert.equal(validateLedgerEntry({ amount: -1 }, { partial: true })[0].field, 'amount');
});

test('todos require concise content and accept an optional due date', () => {
  assert.deepEqual(validateTodo({ content: '预约体检', dueDate: '2026-08-20' }), []);
  assert.deepEqual(validateTodo({ content: '买牛奶', dueDate: null }), []);

  const invalid = validateTodo({ content: '   ', dueDate: '20/08/2026' });
  assert.deepEqual(invalid.map(error => error.field).sort(), ['content', 'dueDate']);
});

test('todo completion must be boolean when supplied', () => {
  assert.deepEqual(validateTodo({ isCompleted: true }, { partial: true }), []);
  assert.equal(validateTodo({ isCompleted: 1 }, { partial: true })[0].field, 'isCompleted');
  assert.equal(validateTodo({ dueDate: false }, { partial: true })[0].field, 'dueDate');
});
