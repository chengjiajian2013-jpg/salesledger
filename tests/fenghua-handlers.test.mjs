import test from 'node:test';
import assert from 'node:assert/strict';

import { handleFenghuaEntries } from '../src/fenghua.js';
import { handleFenghuaTodos } from '../src/todos.js';

test('entry and todo creation reject non-object JSON with validation errors', async () => {
  const env = { DB: { prepare: () => assert.fail('invalid bodies must not query the database') } };

  for (const handler of [handleFenghuaEntries, handleFenghuaTodos]) {
    for (const body of ['null', '[]']) {
      const response = await handler(new Request('https://example.test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }), env);

      assert.equal(response.status, 422);
      assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
    }
  }
});

test('todo creation preserves an explicitly completed state', async () => {
  const row = {};
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              async run() {
                assert.match(sql, /INSERT INTO fenghua_todos/);
                Object.assign(row, {
                  id: 1,
                  content: values[0],
                  due_date: values[1],
                  is_completed: values[2],
                  created_at: '2026-08-18 00:00:00',
                  updated_at: '2026-08-18 00:00:00',
                });
                return { meta: { last_row_id: 1 } };
              },
              async first() {
                assert.match(sql, /FROM fenghua_todos WHERE id/);
                return row;
              },
            };
          },
        };
      },
    },
  };

  const response = await handleFenghuaTodos(new Request('https://example.test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '归档票据', dueDate: null, isCompleted: true }),
  }), env);

  assert.equal(response.status, 201);
  assert.equal((await response.json()).data.isCompleted, true);
  assert.equal(row.is_completed, 1);
});
