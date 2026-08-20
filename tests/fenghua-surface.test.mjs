import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('main surface exposes a two-option app switcher without replacing Joeyzou', async () => {
  const html = await read('../public/index.html');
  assert.match(html, /id="appSwitcher"/);
  assert.match(html, /data-app="joeyzou"/);
  assert.match(html, /data-app="fenghua"/);
  assert.match(html, /id="joeyzouWorkspace"/);
  assert.match(html, /id="fenghuaWorkspace"/);
});

test('fenghua workspace contains ledger and todo tabs with accessible controls', async () => {
  const html = await read('../public/index.html');
  assert.match(html, /data-fenghua-view="ledger"/);
  assert.match(html, /data-fenghua-view="todos"/);
  assert.match(html, /id="fenghuaEntryDialog"/);
  assert.match(html, /id="fenghuaTodoForm"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /data-todo-filter="all"[^>]+aria-pressed="true"/);
  assert.match(html, /data-todo-filter="pending"[^>]+aria-pressed="false"/);
  assert.match(html, /data-entry-type="expense"[^>]+aria-pressed="true"/);
  assert.match(html, /data-entry-type="income"[^>]+aria-pressed="false"/);
  assert.match(html, /id="fenghuaReport"/);
  assert.match(html, /id="fenghuaCategoryList"/);
  assert.match(html, /role="progressbar"/);
});

test('frontend API module defines isolated fenghua resources', async () => {
  const api = await read('../public/modules/api.js');
  assert.match(api, /listFenghuaEntries/);
  assert.match(api, /createFenghuaEntry/);
  assert.match(api, /listFenghuaTodos/);
  assert.match(api, /updateFenghuaTodo/);
});

test('fenghua controls never interpolate user text into HTML attributes', async () => {
  const moduleSource = await read('../public/modules/fenghua.js');
  assert.doesNotMatch(moduleSource, /aria-label=\\?"(?:编辑|删除)\$\{/);
  assert.match(moduleSource, /closeSwitcher\(\{ restoreFocus: true \}\)/);
  assert.match(moduleSource, /setAttribute\('aria-pressed'/);
});

test('worker and schema register protected fenghua resources', async () => {
  const [worker, schema] = await Promise.all([
    read('../src/worker.js'),
    read('../src/schema.js'),
  ]);
  assert.match(worker, /\/api\/v1\/fenghua\/entries/);
  assert.match(worker, /\/api\/v1\/fenghua\/todos/);
  assert.match(schema, /fenghua_entries/);
  assert.match(schema, /fenghua_todos/);
});

test('fenghua has an independent direct entry route', async () => {
  const [worker, app, fenghua] = await Promise.all([
    read('../src/worker.js'),
    read('../public/app.js'),
    read('../public/modules/fenghua.js'),
  ]);
  assert.ok(worker.includes("pathname === '/fenghua'"));
  assert.match(worker, /Response\.redirect\(url\.toString\(\), 308\)/);
  assert.ok(fenghua.includes("location.pathname === '/fenghua'"));
  assert.match(fenghua, /switchApp\('fenghua'\)/);
  assert.match(app, /document\.title = '风华记账'/);
});
