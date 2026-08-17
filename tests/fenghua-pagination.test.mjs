import test from 'node:test';
import assert from 'node:assert/strict';

import { collectPaginated } from '../public/modules/api.js';

test('collectPaginated combines every page while preserving first-page metadata', async () => {
  const calls = [];
  const response = await collectPaginated(async params => {
    calls.push(params);
    const page = params.page;
    return {
      data: page === 1
        ? Array.from({ length: 100 }, (_, index) => ({ id: index + 1 }))
        : [{ id: 101 }],
      meta: {
        summary: { income: 1000, expense: 200, balance: 800 },
        pagination: { page, pageSize: 100, totalItems: 101, totalPages: 2 },
      },
    };
  }, { month: '2026-08' });

  assert.deepEqual(calls, [
    { month: '2026-08', page: 1, pageSize: 100 },
    { month: '2026-08', page: 2, pageSize: 100 },
  ]);
  assert.equal(response.data.length, 101);
  assert.deepEqual(response.meta.summary, { income: 1000, expense: 200, balance: 800 });
});
