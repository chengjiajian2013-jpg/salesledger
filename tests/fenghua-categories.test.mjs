import test from 'node:test';
import assert from 'node:assert/strict';

import { handleFenghuaCategories } from '../src/fenghuaCategories.js';
import { handleFenghuaEntries } from '../src/fenghua.js';

function request(method, body, url = 'https://example.test/api/v1/fenghua/categories') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('custom categories are listed by type and created with a stable key', async () => {
  const calls = [];
  const env = {
    DB: {
      prepare(sql) {
        calls.push(sql);
        return {
          bind(...values) {
            return {
              async all() {
                assert.match(sql, /FROM fenghua_categories/);
                assert.deepEqual(values, ['expense']);
                return { results: [{ id: 42, category_key: 'custom:42', type: 'expense', name: '宠物', created_at: '2026-08-20', updated_at: '2026-08-20' }] };
              },
              async first() {
                assert.match(sql, /SELECT id(?:,| FROM) fenghua_categories|SELECT id, category_key/);
                if (/WHERE id =/.test(sql)) return { id: 42, category_key: 'custom:42', type: 'expense', name: '宠物', created_at: '2026-08-20', updated_at: '2026-08-20' };
                return null;
              },
              async run() {
                assert.match(sql, /INSERT INTO fenghua_categories|UPDATE fenghua_categories/);
                return { meta: { last_row_id: 42 } };
              },
            };
          },
        };
      },
    },
  };

  const listResponse = await handleFenghuaCategories(request('GET', undefined, 'https://example.test/api/v1/fenghua/categories?type=expense'), env);
  assert.equal(listResponse.status, 200);
  assert.deepEqual((await listResponse.json()).data[0], { id: 42, key: 'custom:42', type: 'expense', name: '宠物', createdAt: '2026-08-20', updatedAt: '2026-08-20' });

  const createResponse = await handleFenghuaCategories(request('POST', { type: 'expense', name: '宠物' }), env);
  assert.equal(createResponse.status, 201);
  assert.equal((await createResponse.json()).data.key, 'custom:42');
  assert.equal(calls.length, 5);
});

test('custom category names cannot be duplicated within a type', async () => {
  const env = { DB: { prepare() { return { bind() { return { first: async () => ({ id: 1 }) }; } }; } } };
  const response = await handleFenghuaCategories(request('POST', { type: 'expense', name: ' 宠物 ' }), env);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'CATEGORY_EXISTS');
});

test('entries accept a custom category only when it belongs to the entry type', async () => {
  const row = { id: 9, type: 'expense', amount: 18, category: 'custom:42', date: '2026-08-20', note: '', category_name: '宠物' };
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              async first() {
                if (/FROM fenghua_categories/.test(sql)) return values[0] === 'custom:42' && values[1] === 'expense' ? { id: 42 } : null;
                if (/FROM fenghua_entries WHERE id/.test(sql)) return row;
                return null;
              },
              async run() { return { meta: { last_row_id: 9 } }; },
            };
          },
        };
      },
    },
  };
  const response = await handleFenghuaEntries(request('POST', row, 'https://example.test/api/v1/fenghua/entries'), env);
  assert.equal(response.status, 201);
  assert.equal((await response.json()).data.category, 'custom:42');
});
