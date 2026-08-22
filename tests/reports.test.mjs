import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import {
  buildCompanyReportRows,
  buildPersonalReportRows,
  buildCompanyFooter,
  getReportPeriod,
  buildReportWorkbook,
  handleReportExport,
} from '../src/reports.js';

test('company report blanks cost and sale price for quota transactions', () => {
  const [quota] = buildCompanyReportRows([{
    brand: 'Chanel', date: '2026-08-01', product: 'CF', channel: 'quota',
    cost: 28000, price: 35000, commission_rate: 0.02, account: '微信',
  }]);

  assert.equal(quota.cost, null);
  assert.equal(quota.price, null);
  assert.equal(quota.quotaAmount, 35000);
  assert.equal(quota.quotaCommission, 700);
});

test('company footer keeps the commission total label and sums each commission column', () => {
  const footer = buildCompanyFooter([1200, 300, 500]);

  assert.deepEqual(footer.labels, ['换货提成 2%', '直款提成（利润 10%）', '直客回收 40%']);
  assert.deepEqual(footer.values, [1200, 300, 500]);
  assert.equal(footer.totalLabel, '提成合计');
});

test('personal report keeps the simple nine-column shape', () => {
  const [row] = buildPersonalReportRows([{
    date: '2026-08-02', brand: 'LV', product: '包', channel: 'direct',
    cost: 2000, price: 3500, commission_rate: 0.1, profit: 150, note: '对账',
  }]);

  assert.deepEqual(Object.keys(row), ['date', 'brand', 'product', 'channel', 'cost', 'price', 'commissionRate', 'profit', 'note']);
  assert.equal(row.commissionRate, 10);
});

test('report month validation returns inclusive month boundaries', () => {
  assert.deepEqual(getReportPeriod('2028-02'), {
    month: '2028-02', startDate: '2028-02-01', endDate: '2028-02-29',
  });
  assert.throws(() => getReportPeriod('2028-2'), /YYYY-MM/);
});

test('company workbook contains UTF-8 labels and per-column commission totals', () => {
  const bytes = buildReportWorkbook('company', [{
    date: '2026-08-01', brand: 'LV', product: 'Speedy', channel: 'quota',
    cost: 1000, price: 2000, commission_rate: 0.02, account: '',
  }], '2026-08');
  const files = unzipSync(bytes);
  const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);

  assert.match(sheet, /售出日期/);
  assert.doesNotMatch(sheet, /mergeCell ref="I5:K5"/);
  assert.match(sheet, /提成合计/);
  assert.match(sheet, /<c r="I5"[^>]*><v>40<\/v>/);
  assert.doesNotMatch(sheet, /2026-08-01.*1000.*2000/);
});

test('report export queries one ledger for the requested month and returns an xlsx', async () => {
  let query;
  let bindings;
  const env = {
    DB: {
      prepare(sql) {
        query = sql;
        return {
          bind(...values) {
            bindings = values;
            return { all: async () => ({ results: [] }) };
          },
        };
      },
    },
  };
  const response = await handleReportExport(
    new Request('https://example.test/api/v1/reports/export?month=2026-08&ledger=personal'),
    env,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /spreadsheetml/);
  assert.match(response.headers.get('Content-Disposition'), /filename\*=UTF-8''%E4%B8%AA%E4%BA%BA%E8%B4%A6%E6%9C%AC-2026-08\.xlsx/);
  assert.match(query, /WHERE seller = \?/);
  assert.deepEqual(bindings, ['personal', '2026-08-01', '2026-08-31']);
});

test('report export rejects malformed month without touching the database', async () => {
  let prepared = false;
  const response = await handleReportExport(
    new Request('https://example.test/api/v1/reports/export?month=2026-8&ledger=company'),
    { DB: { prepare() { prepared = true; } } },
  );

  assert.equal(response.status, 400);
  assert.equal(prepared, false);
});

test('monthly statistics exposes the report controls and protected route', async () => {
  const [html, api, worker] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/modules/api.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/worker.js', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="reportModalOverlay"/);
  assert.match(html, /id="reportMonth"/);
  assert.match(html, /id="reportLedger"/);
  assert.match(html, /id="exportReports"/);
  assert.match(api, /downloadReport/);
  assert.match(worker, /\/api\/v1\/reports\/export/);
});
