// SalesLedger — 应用主入口 v2（seller + commission + profit preview）

import { api } from './modules/api.js';
import { state, setState, subscribe, getState } from './modules/state.js';
import { COMMISSION_DEFAULTS, calcProfit, formatRate } from './modules/commission.js';
import { formatCurrency, formatDate, todayStr, escapeHtml, capitalizeBrand } from './modules/format.js';
import { isAuthenticated, login } from './modules/auth.js';

// ═══ 认证检查 ═══
const loginPage = document.getElementById('loginPage');
const appContainer = document.getElementById('app');
const loginDots = document.getElementById('loginDots');
const loginError = document.getElementById('loginError');

if (!isAuthenticated()) {
  // 未登录，显示登录页
  loginPage.style.display = 'flex';
  appContainer.style.display = 'none';

  let password = '';
  const MAX_LENGTH = 4;

  // 更新密码点显示
  function updateDots() {
    const dots = loginDots.querySelectorAll('.login-card__dot');
    dots.forEach((dot, index) => {
      dot.classList.remove('login-card__dot--filled', 'login-card__dot--error');
      if (index < password.length) {
        dot.classList.add('login-card__dot--filled');
      }
    });
  }

  // 显示错误动画
  function showError(message) {
    loginError.textContent = message;
    loginError.classList.add('login-card__error--visible');

    const dots = loginDots.querySelectorAll('.login-card__dot');
    dots.forEach(dot => {
      dot.classList.add('login-card__dot--error');
    });

    setTimeout(() => {
      password = '';
      updateDots();
      loginError.classList.remove('login-card__error--visible');
    }, 1000);
  }

  // 尝试登录
  async function attemptLogin() {
    if (password.length !== MAX_LENGTH) return;

    // 显示加载动画
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('active');

    try {
      await login(password);
      // 登录成功，刷新页面进入应用
      window.location.reload();
    } catch (err) {
      // 隐藏加载动画
      loadingOverlay.classList.remove('active');
      showError('密码错误');
    }
  }

  // 数字键盘点击事件
  document.querySelectorAll('.login-card__key').forEach(key => {
    key.addEventListener('click', async () => {
      const value = key.dataset.key;

      if (!value) return;

      if (value === 'delete') {
        password = password.slice(0, -1);
        updateDots();
      } else if (password.length < MAX_LENGTH) {
        password += value;
        updateDots();

        // 输入满 4 位自动验证
        if (password.length === MAX_LENGTH) {
          await attemptLogin();
        }
      }
    });
  });

  // 物理键盘支持
  document.addEventListener('keydown', async (e) => {
    if (e.key >= '0' && e.key <= '9' && password.length < MAX_LENGTH) {
      password += e.key;
      updateDots();
      if (password.length === MAX_LENGTH) {
        await attemptLogin();
      }
    } else if (e.key === 'Backspace') {
      password = password.slice(0, -1);
      updateDots();
    }
  });

} else {
  // 已登录，显示应用主界面
  loginPage.style.display = 'none';
  appContainer.style.display = 'block';
  initApp();
}

// ═══ 应用初始化 ═══
function initApp() {

// ═══ DOM ═══
const $ = (s) => document.querySelector(s);
const el = {
  statsGrid: $('#statsGrid'),
  sellerTabs: $('#sellerTabs'),
  viewTabs: $('#viewTabs'),
  transactionsView: $('#transactionsView'),
  monthlyView: $('#monthlyView'),
  filterMonth: $('#filterMonth'),
  prevMonth: $('#prevMonth'),
  nextMonth: $('#nextMonth'),
  filterChannel: $('#filterChannel'),
  recordCount: $('#recordCount'),
  txnList: $('#txnList'),
  pagination: $('#pagination'), prevPage: $('#prevPage'), nextPage: $('#nextPage'), pageInfo: $('#pageInfo'),
  yearFilter: $('#yearFilter'),
  monthlyList: $('#monthlyList'),
  fab: $('#fab'),
  modalOverlay: $('#modalOverlay'), modalTitle: $('#modalTitle'),
  txnForm: $('#txnForm'),
  inputDate: $('#inputDate'), inputProduct: $('#inputProduct'),
  inputCost: $('#inputCost'), inputPrice: $('#inputPrice'),
  costRequired: $('#costRequired'), priceRequired: $('#priceRequired'),
  inputRate: $('#inputRate'), rateField: $('#rateField'), rateHint: $('#rateHint'),
  rateMinus: $('#rateMinus'), ratePlus: $('#ratePlus'),
  inputSource: $('#inputSource'), sourceField: $('#sourceField'),
  inputBrand: $('#inputBrand'), brandField: $('#brandField'),
  datalistSource: $('#datalistSource'), datalistBrand: $('#datalistBrand'),
  profitPreview: $('#profitPreview'), profitValue: $('#profitValue'), profitFormula: $('#profitFormula'),
  manualProfitField: $('#manualProfitField'), inputProfit: $('#inputProfit'),
  accountField: $('#accountField'), inputAccount: $('#inputAccount'), accountHint: $('#accountHint'),
  inputNote: $('#inputNote'),
  channelTabs: $('#channelTabs'),
  submitBtn: $('#submitBtn'),
  toastContainer: $('#toastContainer'),
  // 智能解析
  parseToggle: $('#parseToggle'), parseBody: $('#parseBody'),
  parseInput: $('#parseInput'), parseBtn: $('#parseBtn'), parseClear: $('#parseClear'),
  parseWarning: $('#parseWarning'),
};

let currentSeller = 'company';
let selectedChannel = 'quota';
let editingId = null;  // 编辑模式追踪：null=创建，数字=编辑
let currentView = 'transactions';  // transactions | monthly

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

// ═══ 佣金比例步进器 ═══
let adjusting = false;
function adjustRate(delta) {
  if (adjusting) return; // 防止连续点击卡顿
  adjusting = true;

  const current = parseFloat(el.inputRate.value) || 0;
  const next = Math.min(100, Math.max(0, Math.round((current + delta) * 10) / 10));
  el.inputRate.value = next.toFixed(1).replace(/\.0$/, '');
  updateProfitPreview();

  setTimeout(() => { adjusting = false; }, 100);
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
  updateFieldRules(channel);
  updateProfitPreview();
}

// 成本/售价必填规则随渠道切换
function updateFieldRules(channel) {
  const priceReq = channel !== 'other';            // 额度/直款/回收 售价必填
  const costReq  = channel === 'direct' || channel === 'recovery'; // 仅直款/回收 成本必填
  el.priceRequired.textContent = priceReq ? '必填' : '可选';
  el.priceRequired.style.color = priceReq ? 'var(--danger)' : 'var(--text-3)';
  el.inputPrice.required = priceReq;
  el.costRequired.textContent  = costReq ? '必填' : '可选';
  el.costRequired.style.color  = costReq ? 'var(--danger)' : 'var(--text-3)';
  el.inputCost.required = costReq;
}

// ═══ Seller 切换 ═══
function selectSeller(seller, skipRefresh = false) {
  currentSeller = seller;
  el.sellerTabs.querySelectorAll('.seller-tab').forEach(btn => {
    btn.classList.toggle('seller-tab--active', btn.dataset.seller === seller);
  });
  // 仅公司交易显示款项去向
  el.accountField.style.display = seller === 'company' ? 'block' : 'none';

  syncSourceField(seller);

  if (!skipRefresh) {
    setState({ filters: { seller, page: 1 } });
    refreshAll();
  }
}

// ═══ 视图切换 ═══
function switchView(view) {
  currentView = view;
  el.viewTabs.querySelectorAll('.view-tab').forEach(btn => {
    btn.classList.toggle('view-tab--active', btn.dataset.view === view);
  });

  if (view === 'transactions') {
    // 交易明细：显示 seller-tabs 和统计卡片
    el.sellerTabs.style.display = 'flex';
    el.statsGrid.style.display = 'grid';
    el.transactionsView.style.display = 'block';
    el.monthlyView.style.display = 'none';
    refreshAll();
  } else {
    // 月度统计：隐藏 seller-tabs，只显示月均+年总数
    el.sellerTabs.style.display = 'none';
    el.statsGrid.style.display = 'none';
    el.transactionsView.style.display = 'none';
    el.monthlyView.style.display = 'block';
    loadMonthlyStats();
  }
}

// ═══ 月份导航 ═══
function getMonthFromFilter() {
  return el.filterMonth.value || getCurrentMonth();
}

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function setMonth(yearMonth) {
  el.filterMonth.value = yearMonth;
  const [year, month] = yearMonth.split('-').map(Number);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  setState({ filters: { startDate: start, endDate: end, page: 1 } });
  refreshAll();
}

function adjustMonth(delta) {
  const current = getMonthFromFilter();
  const [year, month] = current.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  setMonth(newMonth);
}

// 货源：公司固定为苏苏（锁定），个人可编辑
function syncSourceField(seller) {
  if (seller === 'company') {
    el.inputSource.value = '苏苏';
    el.inputSource.readOnly = true;
    el.inputSource.classList.add('form-field__input--locked');
  } else {
    el.inputSource.readOnly = false;
    el.inputSource.classList.remove('form-field__input--locked');
  }
}

// 加载货源/品牌名下拉建议
async function loadOptions() {
  try {
    const res = await api.getOptions();
    const data = res.data || res;
    const sources = data.sources || [];
    const brands = data.brands || [];
    // 个人模式下建议列表也包含苏苏，方便选择
    const sourceOptions = currentSeller === 'personal' && !sources.includes('苏苏')
      ? [...sources, '苏苏']
      : sources;
    el.datalistSource.innerHTML = sourceOptions.map(v => `<option value="${escapeHtml(v)}">`).join('');
    el.datalistBrand.innerHTML = brands.map(v => `<option value="${escapeHtml(v)}">`).join('');
  } catch (e) {
    console.warn('[Options]', e);
  }
}

// ═══ Modal ═══
function openCreateModal() {
  editingId = null;  // 明确是创建模式
  el.modalTitle.textContent = '记一笔';

  // 设置表单颜色
  const modal = document.getElementById('modal');
  modal.className = 'modal modal--' + currentSeller;

  el.txnForm.reset();
  el.inputDate.value = todayStr();
  el.accountField.style.display = currentSeller === 'company' ? 'block' : 'none';
  syncSourceField(currentSeller);
  selectChannel('quota');
  clearErrors();
  resetParse();
  loadOptions();
  el.modalOverlay.classList.add('modal-overlay--open');
  setTimeout(() => el.inputProduct.focus(), 300);
}

async function openEditModal(id) {
  editingId = id;  // 设置为编辑模式
  const txn = state.transactions.find(t => t.id === id);
  if (!txn) return;
  el.modalTitle.textContent = '编辑记录';

  // 设置表单颜色
  const modal = document.getElementById('modal');
  modal.className = 'modal modal--' + txn.seller;

  clearErrors();
  resetParse();
  selectSeller(txn.seller, true);  // 切换 seller，但不刷新数据
  el.inputDate.value = txn.date;
  el.inputProduct.value = txn.product;
  el.inputCost.value = txn.cost || '';
  el.inputPrice.value = txn.price || '';
  el.inputSource.value = txn.source || '';
  el.inputBrand.value = txn.brand || '';
  el.inputAccount.value = txn.account || '';
  el.inputNote.value = txn.note || '';
  selectChannel(txn.channel);
  el.inputRate.value = ((txn.commissionRate || 0) * 100).toFixed(1).replace(/\.0$/, '');
  if (txn.channel === 'other') {
    el.inputProfit.value = txn.profit;
  }
  updateProfitPreview();
  loadOptions();
  el.modalOverlay.classList.add('modal-overlay--open');
}

// ═══ 复制公司记录为个人记录 ═══
function openCopyToPersonalModal(id) {
  editingId = null;  // 复制操作是创建新记录
  const txn = state.transactions.find(t => t.id === id);
  if (!txn) return;
  el.modalTitle.textContent = `复制为个人 · #${txn.id}`;
  clearErrors();
  resetParse();
  selectSeller('personal', true);  // 切换到个人模式，但不刷新数据
  el.txnForm.reset();
  el.inputDate.value = txn.date;
  el.inputProduct.value = txn.product;
  el.inputCost.value = txn.cost != null ? txn.cost : '';
  el.inputPrice.value = txn.price != null ? txn.price : '';
  // 复制为个人：货源默认取源记录的货源，可改
  el.inputSource.value = txn.source || '';
  el.inputBrand.value = txn.brand || '';
  el.inputAccount.value = txn.account || '';
  el.inputNote.value = `自 #${txn.id} 复制`;
  selectChannel(txn.channel);
  updateProfitPreview();
  loadOptions();
  el.modalOverlay.classList.add('modal-overlay--open');
  setTimeout(() => el.inputRate.focus(), 300);
}

function closeModal() {
  el.modalOverlay.classList.remove('modal-overlay--open');
}

function clearErrors() {
  document.querySelectorAll('.form-field__error').forEach(e => e.textContent = '');
}

// ═══ 智能解析（DeepSeek） ═══
function toggleParse(open) {
  const show = open != null ? open : el.parseBody.style.display === 'none';
  el.parseBody.style.display = show ? 'block' : 'none';
}

function resetParse() {
  el.parseInput.value = '';
  el.parseWarning.classList.remove('parse-bar__warning--visible');
  el.parseBody.style.display = 'none';
}

async function runParse() {
  const text = el.parseInput.value.trim();
  if (!text) { showToast('请先粘贴或输入描述', 'error'); return; }

  el.parseBtn.disabled = true;
  el.parseBtn.classList.add('parse-btn--loading');
  el.parseWarning.classList.remove('parse-bar__warning--visible');
  try {
    const res = await api.parse({ text, seller: currentSeller, today: todayStr() });
    const d = res.data || res;
    applyParseResult(d);
    showToast('解析完成，请核对后保存');
    toggleParse(false); // 解析成功后收起
  } catch (err) {
    showToast(err.message || '解析失败', 'error');
  } finally {
    el.parseBtn.disabled = false;
    el.parseBtn.classList.remove('parse-btn--loading');
  }
}

// 把解析草稿填入表单
function applyParseResult(d) {
  if (d.date) el.inputDate.value = d.date;
  if (d.product) el.inputProduct.value = d.product;
  if (d.source) el.inputSource.value = d.source;
  if (d.brand) el.inputBrand.value = d.brand;
  // 渠道切换会重置比例默认值，所以先切渠道
  selectChannel(d.channel || 'quota');
  if (d.cost) el.inputCost.value = d.cost;
  if (d.price) el.inputPrice.value = d.price;
  // 显式给出的比例覆盖渠道默认值
  if (d.commissionRate != null && d.commissionRate >= 0) {
    el.inputRate.value = (d.commissionRate * 100).toFixed(1).replace(/\.0$/, '');
  }
  if (d.account) el.inputAccount.value = d.account;
  if (d.note) el.inputNote.value = d.note;
  if (d.channel === 'other' && d.profit) el.inputProfit.value = d.profit;
  updateProfitPreview();

  // 可信度提示
  if (d.confidence === 'low') {
    el.parseWarning.classList.add('parse-bar__warning--visible');
  }
}

// ═══ 数据加载 ═══
async function loadSummary() {
  try {
    const { startDate, endDate, seller } = state.filters;
    const res = await api.getSummary({ startDate, endDate, seller });
    const data = res.data || res;
    setState({ summary: data });
    renderSummary(data);
  } catch (e) {
    console.error('[Summary]', e);
    showToast('统计数据加载失败', 'error');
  }
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

// ═══ 月度统计 ═══
async function loadMonthlyStats() {
  const year = el.yearFilter.value || new Date().getFullYear();
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const month = String(m).padStart(2, '0');
    const start = `${year}-${month}-01`;
    const lastDay = new Date(year, m, 0).getDate();
    const end = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    months.push({ year, month, start, end });
  }
  
  try {
    // 并行请求每月的公司和个人数据
    const results = await Promise.all(
      months.map(async (m) => {
        try {
          const [companyRes, personalRes] = await Promise.all([
            api.getSummary({ startDate: m.start, endDate: m.end, seller: 'company' }),
            api.getSummary({ startDate: m.start, endDate: m.end, seller: 'personal' }),
          ]);
          const company = companyRes.data || companyRes;
          const personal = personalRes.data || personalRes;
          return {
            ...m,
            companyProfit: company.totalProfit || 0,
            personalProfit: personal.totalProfit || 0,
            companyCount: company.transactionCount || 0,
            personalCount: personal.transactionCount || 0,
          };
        } catch {
          return { ...m, companyProfit: 0, personalProfit: 0, companyCount: 0, personalCount: 0 };
        }
      })
    );
    renderMonthlyStats(results.reverse()); // 最新月份在上
  } catch (e) {
    showToast('月度统计加载失败', 'error');
  }
}

function renderMonthlyStats(months) {
  if (!months || months.length === 0) {
    el.monthlyList.innerHTML = '<div class="empty-state"><div class="empty-state__text">暂无数据</div></div>';
    return;
  }

  const BASE_SALARY = 8000; // 公司底薪

  el.monthlyList.innerHTML = months.map(m => {
    const companyTotal = m.companyProfit + BASE_SALARY; // 公司收入 = 利润 + 底薪
    const totalIncome = companyTotal + m.personalProfit; // 总收入 = 公司总收入 + 个人利润
    const totalCount = m.companyCount + m.personalCount;
    if (totalCount === 0) return ''; // 跳过没有交易的月份

    return `
      <div class="monthly-card" data-year="${m.year}" data-month="${m.month}">
        <div class="monthly-card__header">
          <div class="monthly-card__month">${m.year}年${parseInt(m.month)}月</div>
          <div class="monthly-card__count">${totalCount} 笔</div>
        </div>
        <div class="monthly-card__stats">
          <div class="monthly-card__stat">
            <div class="monthly-card__stat-label">公司收入</div>
            <div class="monthly-card__stat-value">${formatCurrency(companyTotal)}</div>
            <div class="monthly-card__stat-detail">底薪¥8,000 + 利润${formatCurrency(m.companyProfit)}</div>
          </div>
          <div class="monthly-card__stat">
            <div class="monthly-card__stat-label">个人收入</div>
            <div class="monthly-card__stat-value">${formatCurrency(m.personalProfit)}</div>
          </div>
          <div class="monthly-card__stat monthly-card__stat--profit">
            <div class="monthly-card__stat-label">总收入</div>
            <div class="monthly-card__stat-value">${formatCurrency(totalIncome)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // 点击月度卡片跳转到交易明细
  el.monthlyList.querySelectorAll('.monthly-card').forEach(card => {
    card.addEventListener('click', () => {
      const year = card.dataset.year;
      const month = card.dataset.month;
      setMonth(`${year}-${month}`);
      switchView('transactions');
    });
  });
}

// ═══ 渲染 ═══
const CHANNEL_LABELS = { quota: '额度', direct: '直款', recovery: '回收', other: '其他' };

function renderSummary(s) {
  if (!s) { el.headerSubtitle.textContent = '暂无数据'; return; }
  const seller = state.filters.seller;
  const profit = s.totalProfit;
  const BASE_SALARY = 8000;

  let cards;
  if (seller === 'company') {
    cards = [
      { label: '底薪', value: formatCurrency(BASE_SALARY), cls: 'stat-card--base' },
      { label: '提成', value: formatCurrency(profit) },
      { label: '总数', value: formatCurrency(BASE_SALARY + profit), cls: 'stat-card--profit' },
    ];
  } else {
    cards = [
      { label: '佣金', value: formatCurrency(profit) },
      { label: '总数', value: formatCurrency(profit), cls: 'stat-card--profit' },
    ];
  }

  el.statsGrid.className = 'stats-grid' + (cards.length === 2 ? ' stats-grid--2' : '');
  el.statsGrid.innerHTML = cards.map(c => `
    <div class="stat-card ${c.cls || ''}">
      <div class="stat-card__label">${c.label}</div>
      <div class="stat-card__value">${c.value}</div>
    </div>
  `).join('');

  // headerSubtitle 已移除，不再显示
  // 均利显示在交易明细右边
  el.recordCount.textContent = `${s.transactionCount} 笔 · 均利 ${formatCurrency(s.averageProfit)}`;
}

function renderList(data, pg) {
  // recordCount 现在在 renderSummary 中设置（包含均利），这里不再覆盖
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
          ${t.brand ? `<span class="txn-item__brand">${escapeHtml(t.brand)}</span>` : ''}
        </div>
        <div class="txn-item__meta">
          ${formatDate(t.date)} · ${t.source ? escapeHtml(t.source) : (t.seller === 'company' ? '苏苏' : '—')} · 佣金 ${(t.commissionRate * 100).toFixed(1).replace(/\.0$/, '')}%
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
    // 按渠道校验必填
    if (price <= 0) { showToast('请填写售价', 'error'); return; }
    if ((channel === 'direct' || channel === 'recovery') && cost <= 0) { showToast('请填写成本', 'error'); return; }
    profit = Math.round((price - cost) * rate * 100) / 100;
  }

  const body = {
    seller: currentSeller,
    source: el.inputSource.value.trim(),
    brand: capitalizeBrand(el.inputBrand.value),
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
    if (editingId) {
      // 编辑模式：更新现有记录
      await api.updateTransaction(editingId, body);
      showToast('已更新 ✓');
    } else {
      // 创建模式：创建新记录
      await api.createTransaction(body);
      showToast('已记录 ✓');
    }
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

  // 视图切换
  el.viewTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-tab');
    if (btn) switchView(btn.dataset.view);
  });

  // 月份导航
  el.prevMonth.addEventListener('click', () => adjustMonth(-1));
  el.nextMonth.addEventListener('click', () => adjustMonth(1));
  el.filterMonth.addEventListener('change', () => setMonth(el.filterMonth.value));

  // 年份筛选
  el.yearFilter.addEventListener('change', loadMonthlyStats);

  el.channelTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.channel-tab');
    if (btn) selectChannel(btn.dataset.channel);
  });

  // 实时预览
  el.inputPrice.addEventListener('input', updateProfitPreview);
  el.inputCost.addEventListener('input', updateProfitPreview);
  el.inputRate.addEventListener('input', updateProfitPreview);

  // 比例步进按钮（步长 0.5%）
  el.rateMinus.addEventListener('click', () => adjustRate(-0.5));
  el.ratePlus.addEventListener('click', () => adjustRate(0.5));

  // 智能解析
  el.parseToggle.addEventListener('click', () => {
    const willOpen = el.parseBody.style.display === 'none';
    toggleParse(true);
    if (willOpen) setTimeout(() => el.parseInput.focus(), 250);
  });
  el.parseBtn.addEventListener('click', runParse);
  el.parseClear.addEventListener('click', resetParse);
  // 解析框内 Cmd/Ctrl+Enter 快速解析
  el.parseInput.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runParse();
  });

  el.txnForm.addEventListener('submit', handleSubmit);

  // 筛选（渠道）
  let ft;
  const onFilter = () => {
    clearTimeout(ft);
    ft = setTimeout(() => {
      setState({ filters: {
        channel: el.filterChannel.value, page: 1,
      } });
      refreshAll();
    }, 300);
  };
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

// ═══ 应用启动 ═══
async function startApp() {
  // 初始化月份选择器为当月
  el.filterMonth.value = getCurrentMonth();
  setMonth(getCurrentMonth());

  // 初始化年份选择器（最近3年）
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  el.yearFilter.innerHTML = years.map(y => `<option value="${y}">${y}年</option>`).join('');

  bindEvents();
  await refreshAll();
}

// 启动应用
document.addEventListener('DOMContentLoaded', startApp);

} // end of initApp()
