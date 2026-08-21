import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDom } from '../public/modules/dom.js';
import { bootstrapAuthenticatedApp } from '../public/modules/app-bootstrap.js';
import { createViewRouter } from '../public/modules/view-router.js';

test('collectDom uses the supplied document-like root', () => {
  const calls = [];
  const root = {
    querySelector(selector) {
      calls.push(selector);
      return { selector };
    },
  };

  const dom = collectDom(root);

  assert.equal(dom.headerMonthlyTotal.selector, '#headerMonthlyTotal');
  assert.equal(dom.headerSubtitle.selector, '#headerSubtitle');
  assert.equal(dom.parseWarning.selector, '#parseWarning');
  assert.ok(calls.length > 50);
});

test('collectDom rejects a missing document-like root', () => {
  assert.throws(() => collectDom(), /document-like root/);
});

test('authenticated bootstrap invokes core and Fenghua once', async () => {
  const calls = [];
  const originalDocument = globalThis.document;
  globalThis.document = {
    readyState: 'complete',
    addEventListener() {
      throw new Error('should not register after DOMContentLoaded');
    },
  };

  try {
    const returnedRun = bootstrapAuthenticatedApp({
      initCoreApp: () => {
        calls.push('core-init');
        return async () => calls.push('core-start');
      },
      initFenghuaWorkspace: () => calls.push('fenghua'),
    });
    await returnedRun();
    await returnedRun();
    assert.deepEqual(calls, ['core-init', 'core-start', 'fenghua']);
  } finally {
    globalThis.document = originalDocument;
  }
});

test('view router toggles workspace visibility and delegates loading', () => {
  const buttons = ['transactions', 'monthly', 'ai'].map(view => ({
    dataset: { view },
    classList: { values: [], toggle(name, active) { this.values.push([name, active]); } },
  }));
  const makePanel = () => ({ style: { display: 'initial' } });
  const dom = {
    viewTabs: { querySelectorAll: () => buttons },
    sellerTabs: makePanel(),
    statsGrid: makePanel(),
    transactionsView: makePanel(),
    monthlyView: makePanel(),
    aiView: makePanel(),
    fab: makePanel(),
  };
  const loaded = [];
  const router = createViewRouter({
    dom,
    onTransactions: () => loaded.push('transactions'),
    onMonthly: () => loaded.push('monthly'),
    onAI: () => loaded.push('ai'),
  });

  assert.equal(router.switchView('monthly'), true);
  assert.equal(router.getCurrentView(), 'monthly');
  assert.equal(dom.sellerTabs.style.display, 'none');
  assert.equal(dom.transactionsView.style.display, 'none');
  assert.equal(dom.monthlyView.style.display, 'block');
  assert.equal(dom.aiView.style.display, 'none');
  assert.equal(dom.fab.style.display, 'flex');
  assert.deepEqual(loaded, ['monthly']);

  assert.equal(router.switchView('ai'), true);
  assert.equal(dom.aiView.style.display, 'block');
  assert.equal(dom.fab.style.display, 'none');
  assert.deepEqual(loaded, ['monthly', 'ai']);
  assert.equal(router.switchView('unknown'), false);
  assert.equal(router.getCurrentView(), 'ai');
});
