import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDom } from '../public/modules/dom.js';
import { bootstrapAuthenticatedApp } from '../public/modules/app-bootstrap.js';

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
