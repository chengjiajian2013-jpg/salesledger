// SalesLedger — 应用主入口 v2（seller + commission + profit preview）

import { api } from './modules/api.js';
import { state, setState, subscribe, getState } from './modules/state.js';
import { COMMISSION_DEFAULTS, calcProfit, formatRate } from './modules/commission.js';
import { formatCurrency, formatDate, todayStr, escapeHtml } from './modules/format.js';

// ═══ DOM ═══
const $ = (s) => document.querySelector(s);
const el = {
  headerSubtitle: $('#headerSubtitle'),
  statRevenue: $('#statRevenue'), statCost: $('#statCost'), statProfit: $('#statProfit'),
  sellerTabs: $('#sellerTabs'),
  filterStart: $('#filterStart'), filterEnd: $('#filterEnd'), filterChannel: $('#filterChannel'),
  recordCount: $('#recordCount'),
  txnList: $('#txnList'),
  pagination: $('#pagination'), prevPage: $('#prevPage'), nextPage: $('#nextPage'), pageInfo: $('#pageInfo'),
  fab: $('#fab'),
  modalOverlay: $('#modalOverlay'), modalTitle: $('#modalTitle'),
  txnForm: $('#txnForm'),
  inputDate: $('#inputDate'), inputProduct: $('#inputProduct'),
  inputCost: $('#inputCost'), inputPrice: $('#inputPrice'),
  inputRate: $('#inputRate'), rateField: $('#rateField'), rateHint: $('#rateHint'),
  profitPreview: $('#profitPreview'), profitValue: $('#profitValue'), profitFormula: $('#profitFormula'),
  manualProfitField: $('#manualProfitField'), inputProfit: $('#inputProfit'),
  accountField: $('#accountField'), inputAccount: $('#inputAccount'), accountHint: $('#accountHint'),
  inputNote: $('#inputNote'),
  channelTabs: $('#channelTabs'),
  submitBtn: $('#submitBtn'),
  toastContainer: $('#toastContainer'),
};

let currentSeller = 'company';
let selectedChannel = 'quota';

// ═══ Toast ═══
function showToast(msg, type = 'info') {
  const div = document.createElement('div');
  div.className = 'toast' + (type === 'error' ? ' toast--error' : '');
  div.textContent = msg;
  el.toastContainer.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 2000);
}

// ═══ 利润实时预览 ═══
function updateProfitPreview() {
  const channel = selectedChannel;
  const price = parseFloat(el.inputPrice.value) || 0;
  const cost = parseFloat(el.inputCost.value) || 0;
  const ratePct = parseFloat(el.inputRate.value) || 0;
  const rate = ratePct / 100;

  if (channel === 'other') {
    el.profitPreview.style.display = 'none';
    el.manualProfitField.style.display = 'block';
    el.rateField.style.display = 'none';
    return;
  }
  el.profitPreview.style.display = 'block';
  el.manualProfitField.style.display = 'none';
  el.rateField.style.display = 'block';

  const profit = Math.round((price - cost) * rate * 100) / 100;
  el.profitValue.textContent = formatCurrency(profit);

  const formulas = {
    quota: `售价 ${formatCurrency(price)} × ${ratePct}% = ${formatCurrency(profit)}`,
    direct: `(${formatCurrency(price)} - ${formatCurrency(cost)}) × ${ratePct}% = ${formatCurrency(profit)}`,
    recovery: `(${formatCurrency(price)} - ${formatCurrency(cost)}) × ${ratePct}% = ${formatCurrency(profit)}`,
  };
  el.profitFormula.textContent = formulas[channel] || '';
}

// ═══ 渠道切换 ═══
function selectChannel(channel) {
  selectedChannel = channel;
  el.channelTabs.querySelectorAll('.channel-tab').forEach(btn => {
    btn.classList.toggle('channel-tab--active', btn.dataset.channel === channel);
  });
  // 填入默认比例
  const defaults = COMMISSION_DEFAULTS[currentSeller][channel];
  el.inputRate.value = (defaults.defaultRate * 100).toFixed(1).replace(/\.0$/, '');
  el.rateHint.textContent = channel === 'other' ? '其他渠道直接填写利润' : `默认 ${formatRate(defaults.defaultRate)}，可调整`;
  updateProfitPreview();
}

// ═══ Seller 切换 ═══
function selectSeller(seller) {
  currentSeller = seller;
  el.sellerTabs.querySelectorAll('.seller-tab').forEach(btn => {
    btn.classList.toggle('seller-tab--active', btn.dataset.seller === seller);
  });
  // 仅公司交易显示款项去向
  el.accountField.style.display = seller === 'company' ? 'block' : 'none';
  setState({ filters: { seller, page: 1 } });
  refreshAll();
}

// ═══ Modal ═══
function openCreateModal() {
  el.modalTitle.textContent = '记一笔 - ' + (currentSeller === 'company' ? '公司' : '个人');
  el.txnForm.reset();
  el.inputDate.value = todayStr();
  el.accountField.style.display = currentSeller === 'company' ? 'block' : 'none';
  selectChannel('quota');
  clearErrors();
  el.modalOverlay.classList.add('modal-overlay--open');
  setTimeout(() => el.inputProduct.focus(), 300);
}

async function openEditModal(id) {
  const txn = state.transactions.find(t => t.id === id);
  if (!txn) return;
  el.modalTitle.textContent = '编辑记录';
  clearErrors();
  currentSeller = txn.seller;
  el.sellerTabs.querySelectorAll('.seller-tab').forEach(btn => {
    btn.classList.toggle('seller-tab--active', btn.dataset.seller === txn.seller);
  });
  el.inputDate.value = txn.date;
  el.inputProduct.value = txn.product;
  el.inputCost.value = txn.cost || '';
  el.inputPrice.value = txn.price || '';
  el.inputAccount.value = txn.account || '';
  el.inputNote.value = txn.note || '';
  selectChannel(txn.channel);
  el.inputRate.value = ((txn.commissionRate || 0) * 100).toFixed(1).replace(/\.0$/, '');
  if (txn.channel === 'other') {
    el.inputProfit.value = txn.profit;
  }
  updateProfitPreview();
  el.modalOverlay.classList.add('modal-overlay--open');
}

// ═══ 复制公司记录为个人记录 ═══
function openCopyToPersonalModal(id) {
  const txn = state.transactions.find(t => t.id === id);
  if (!txn) return;
  el.modalTitle.textContent = `复制为个人 · #${txn.id}`;
  clearErrors();
  currentSeller = 'personal';
  el.sellerTabs.querySelectorAll('.seller-tab').forEach(btn => {
    btn.classList.toggle('seller-tab--active', btn.dataset.seller === 'personal');
  });
  el.txnForm.reset();
  el.inputDate.value = txn.date;
  el.inputProduct.value = txn.product;
  el.inputCost.value = txn.cost != null ? txn.cost : '';
  el.inputPrice.value = txn.price != null ? txn.price : '';
  el.inputAccount.value = txn.account || '';
  el.inputNote.value = `自 #${txn.id} 复制`;
  selectChannel(txn.channel);
  updateProfitPreview();
  el.modalOverlay.classList.add('modal-overlay--open');
  setTimeout(() => el.inputRate.focus(), 300);
}

function closeModal() {
  el.modalOverlay.classList.remove('modal-overlay--open');
}

function clearErrors() {
  document.querySelectorAll('.form-field__error').forEach(e => e.textContent = '');
}

// ═══ 数据加载 ═══
async function loadSummary() {
  try {
    const { startDate, endDate, seller } = state.filters;
    const res = await api.getSummary({ startDate, endDate, seller });
    const data = res.data || res;
    setState({ summary: data });
    renderSummary(data);
  } catch (e) { console.error('[Summary]', e); }
}

async function loadTransactions() {
  setState({ ui: { loading: true } });
  try {
    const f = state.filters;
    const res = await api.listTransactions(f);
    const data = res.data || res;
    const pagination = (res.meta && res.meta.pagination) || (data.meta && data.meta.pagination) || {};
    setState({ transactions: data, meta: { pagination } });
    renderList(data, pagination);
  } catch (e) {
    showToast(e.message || '加载失败', 'error');
  } finally {
    setState({ ui: { loading: false } });
  }
}

async function refreshAll() {
  await Promise.all([loadSummary(), loadTransactions()]);
}

// ═══ 渲染 ═══
const CHANNEL_LABELS = { quota: '额度', direct: '直款', recovery: '回收', other: '其他' };

function renderSummary(s) {
  if (!s) { el.headerSubtitle.textContent = '暂无数据'; return; }
  el.statRevenue.textContent = formatCurrency(s.totalRevenue);
  el.statCost.textContent = formatCurrency(s.totalCost);
  el.statProfit.textContent = formatCurrency(s.totalProfit);
  const sellerLabel = state.filters.seller === 'personal' ? '个人' : '公司';
  el.headerSubtitle.textContent = `${sellerLabel} · ${s.transactionCount} 笔 · 均利 ${formatCurrency(s.averageProfit)}`;
}

function renderList(data, pg) {
  el.recordCount.textContent = `${pg.totalItems} 笔`;
  if (!data || data.length === 0) {
    el.txnList.innerHTML = `<div class="empty-state"><div class="empty-state__text">暂无记录<br>点击右下角 + 记第一笔</div></div>`;
    el.pagination.style.display = 'none';
    return;
  }
  el.txnList.innerHTML = data.map(t => `
    <div class="txn-item" data-id="${t.id}">
      <div class="txn-item__info">
        <div class="txn-item__title">
          <span class="channel-badge channel-badge--${t.channel}">${CHANNEL_LABELS[t.channel] || t.channel}</span>
          ${escapeHtml(t.product)}
        </div>
        <div class="txn-item__meta">
          ${formatDate(t.date)} · 佣金 ${(t.commissionRate * 100).toFixed(1).replace(/\.0$/, '')}%
          ${t.cost ? ` · 成本 ${formatCurrency(t.cost)}` : ''}${t.price ? ` · 售价 ${formatCurrency(t.price)}` : ''}
          ${t.account ? ` · 到账: ${escapeHtml(t.account)}` : ''}
        </div>
      </div>
      <div class="txn-item__amount">+${formatCurrency(t.profit)}</div>
      ${t.seller === 'company' ? `<button class="txn-item__copy" data-id="${t.id}" title="复制为个人记录，单独配置利润">复制</button>` : ''}
      <button class="txn-item__delete" data-id="${t.id}" title="删除">×</button>
    </div>
  `).join('');

  el.txnList.querySelectorAll('.txn-item__delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('确定删除？')) return;
      try { await api.deleteTransaction(btn.dataset.id); showToast('已删除'); refreshAll(); }
      catch (err) { showToast(err.message, 'error'); }
    });
  });
  el.txnList.querySelectorAll('.txn-item__copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCopyToPersonalModal(Number(btn.dataset.id));
    });
  });
  el.txnList.querySelectorAll('.txn-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.txn-item__delete') || e.target.closest('.txn-item__copy')) return;
      openEditModal(Number(item.dataset.id));
    });
  });

  if (pg.totalPages > 1) {
    el.pagination.style.display = 'flex';
    el.pageInfo.textContent = `${pg.page} / ${pg.totalPages}`;
    el.prevPage.disabled = pg.page <= 1;
    el.nextPage.disabled = pg.page >= pg.totalPages;
  } else {
    el.pagination.style.display = 'none';
  }
}

// ═══ 提交 ═══
async function handleSubmit(e) {
  e.preventDefault();
  const channel = selectedChannel;
  const isOther = channel === 'other';

  let profit;
  if (isOther) {
    profit = parseFloat(el.inputProfit.value) || 0;
    if (profit <= 0) { showToast('请填写利润', 'error'); return; }
  } else {
    const price = parseFloat(el.inputPrice.value) || 0;
    const cost = parseFloat(el.inputCost.value) || 0;
    const rate = (parseFloat(el.inputRate.value) || 0) / 100;
    if (price <= 0) { showToast('请填写售价', 'error'); return; }
    profit = Math.round((price - cost) * rate * 100) / 100;
  }

  const body = {
    seller: currentSeller,
    date: el.inputDate.value,
    product: el.inputProduct.value.trim(),
    channel,
    cost: parseFloat(el.inputCost.value) || 0,
    price: parseFloat(el.inputPrice.value) || 0,
    commission_rate: isOther ? 0 : (parseFloat(el.inputRate.value) || 0) / 100,
    profit,
    account: el.inputAccount.value.trim(),
    note: el.inputNote.value.trim(),
  };

  if (!body.date || !body.product) { showToast('请填写日期和商品名', 'error'); return; }

  el.submitBtn.disabled = true;
  try {
    await api.createTransaction(body);
    showToast('已记录 ✓');
    closeModal();
    refreshAll();
  } catch (err) {
    showToast(err.message || '保存失败', 'error');
  } finally {
    el.submitBtn.disabled = false;
  }
}

// ═══ 事件 ═══
function bindEvents() {
  el.fab.addEventListener('click', openCreateModal);
  el.modalOverlay.addEventListener('click', (e) => { if (e.target === el.modalOverlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  el.sellerTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.seller-tab');
    if (btn) selectSeller(btn.dataset.seller);
  });

  el.channelTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.channel-tab');
    if (btn) selectChannel(btn.dataset.channel);
  });

  // 实时预览
  el.inputPrice.addEventListener('input', updateProfitPreview);
  el.inputCost.addEventListener('input', updateProfitPreview);
  el.inputRate.addEventListener('input', updateProfitPreview);

  el.txnForm.addEventListener('submit', handleSubmit);

  // 筛选
  let ft;
  const onFilter = () => {
    clearTimeout(ft);
    ft = setTimeout(() => {
      setState({ filters: {
        startDate: el.filterStart.value, endDate: el.filterEnd.value,
        channel: el.filterChannel.value, page: 1,
      } });
      refreshAll();
    }, 300);
  };
  el.filterStart.addEventListener('change', onFilter);
  el.filterEnd.addEventListener('change', onFilter);
  el.filterChannel.addEventListener('change', onFilter);

  el.prevPage.addEventListener('click', () => {
    const p = getState().filters.page;
    if (p > 1) { setState({ filters: { page: p - 1 } }); loadTransactions(); }
  });
  el.nextPage.addEventListener('click', () => {
    const p = getState().filters.page;
    const tp = getState().meta.pagination.totalPages;
    if (p < tp) { setState({ filters: { page: p + 1 } }); loadTransactions(); }
  });
}

// ═══ 初始化 ═══
async function init() {
  el.filterStart.value = state.filters.startDate;
  el.filterEnd.value = state.filters.endDate;
  bindEvents();
  await refreshAll();
}

document.addEventListener('DOMContentLoaded', init);
