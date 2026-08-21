import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDom } from '../public/modules/dom.js';
import { bootstrapAuthenticatedApp } from '../public/modules/app-bootstrap.js';
import { createViewRouter } from '../public/modules/view-router.js';
import { createTransactionController } from '../public/modules/transactions.js';
import { buildMonthRanges, createMonthlyStatsController } from '../public/modules/monthly-stats.js';
import { createIdempotentBinder } from '../public/modules/events.js';
import {
  extractAIData,
  removeAIDataTag,
  parseAIResponse,
  parseTransactionTypeFromAI,
  parseGoodsFromAIResponse,
  parseFormFromQuestion,
  parseGoodsFromQuestion,
} from '../public/modules/ai-parse.js';

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

test('transaction submission preserves a user note in the API body', async () => {
  const calls = [];
  const state = { filters: { startDate: '2026-08-01', endDate: '2026-08-31', seller: 'company' } };
  const dom = {
    inputProfit: { value: '' },
    inputPrice: { value: '100' },
    inputCost: { value: '0' },
    inputRate: { value: '10' },
    inputSource: { value: '苏苏' },
    inputBrand: { value: 'acme' },
    inputDate: { value: '2026-08-22' },
    inputProduct: { value: '测试商品' },
    inputAccount: { value: '银行卡' },
    inputNote: { value: '这是备注' },
    submitBtn: { disabled: false },
  };
  const controller = createTransactionController({
    api: {
      async createTransaction(body) { calls.push(body); },
      async getSummary() { return { data: {} }; },
      async listTransactions() { return { data: [], meta: { pagination: {} } }; },
    },
    state,
    setState: () => {},
    dom,
    renderSummary: () => {},
    renderList: () => {},
    showToast: () => {},
    closeModal: () => {},
    refreshHeaderTotal: async () => {},
    getSelectedChannel: () => 'quota',
    getCurrentSeller: () => 'company',
    getEditingId: () => null,
    onRefresh: async () => {},
    capitalizeBrand: value => value.toUpperCase(),
  });

  await controller.handleSubmit({ preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].note, '这是备注');
  assert.equal(calls[0].brand, 'ACME');
  assert.equal(dom.submitBtn.disabled, false);
});

test('monthly stats builds calendar-safe ranges and renders clickable months', () => {
  const ranges = buildMonthRanges(2028);
  assert.equal(ranges.length, 12);
  assert.deepEqual(ranges[1], {
    year: 2028,
    month: '02',
    start: '2028-02-01',
    end: '2028-02-29',
  });

  const listeners = [];
  const dom = {
    yearFilter: { value: '2028' },
    monthlyList: {
      innerHTML: '',
      querySelectorAll() {
        return [{ dataset: { year: '2028', month: '02' }, addEventListener: (_type, fn) => listeners.push(fn) }];
      },
    },
  };
  const selected = [];
  const controller = createMonthlyStatsController({
    api: { getSummary: async () => ({ data: { totalProfit: 0, transactionCount: 0 } }) },
    dom,
    formatCurrency: value => `¥${value}`,
    showToast: () => {},
    onMonthSelected: month => selected.push(month),
  });

  controller.renderMonthlyStats([{ year: 2028, month: '02', companyProfit: 100, personalProfit: 50, companyCount: 1, personalCount: 1 }]);
  assert.match(dom.monthlyList.innerHTML, /2028年2月/);
  listeners[0]();
  assert.deepEqual(selected, ['2028-02']);
});

test('event binder registers once and can recover after a failed bind', () => {
  let attempts = 0;
  const binder = createIdempotentBinder(() => {
    attempts += 1;
    if (attempts === 1) throw new Error('bind failed');
  });

  assert.throws(() => binder(), /bind failed/);
  assert.equal(binder(), true);
  assert.equal(binder(), false);
  assert.equal(attempts, 2);
});

test('AI parsers convert structured responses into transaction drafts', () => {
  const response = '<ai-data>{"customerPay":120,"toCompany":90,"profit":30,"quota":100,"transactionType":"personal","goods":[{"name":"卡包","amount":120}]}</ai-data>已整理';
  assert.deepEqual(extractAIData(response), {
    customerPay: 120,
    toCompany: 90,
    profit: 30,
    quota: 100,
    transactionType: 'personal',
    goods: [{ name: '卡包', amount: 120 }],
  });
  assert.equal(removeAIDataTag(response), '已整理');
  assert.deepEqual(parseAIResponse(response), { customerPay: 120, toCompany: 90, profit: 30, excess: 0, quota: 100 });
  assert.equal(parseTransactionTypeFromAI(response), 'personal');
  assert.deepEqual(parseGoodsFromAIResponse(response), [{ name: '卡包', amount: 120 }]);
});

test('AI parsers retain legacy markdown and question fallbacks', () => {
  const response = '**交易类型：**公司交易\n\n**货物明细：**\n- 黑金：4,500元\n- 合计：4,500元\n\n给公司的钱：4,000元\n额度：4,500元';
  assert.deepEqual(parseAIResponse(response), { customerPay: 0, toCompany: 4000, profit: 0, excess: 0, quota: 4500 });
  assert.equal(parseTransactionTypeFromAI(response), 'company');
  assert.deepEqual(parseGoodsFromAIResponse(response), [{ name: '黑金', amount: 4500 }]);
  assert.deepEqual(parseFormFromQuestion('个人交易：额度1,000元，卖9折，成本8折'), {
    type: 'personal', quota: 1000, cost: 0.08, price: 0.09,
  });
  assert.deepEqual(parseGoodsFromQuestion('实际货物：卡包：120元、徽章：30元'), [
    { name: '卡包', amount: 120 },
    { name: '徽章', amount: 30 },
  ]);
});
