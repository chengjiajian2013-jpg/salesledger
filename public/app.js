// SalesLedger — 应用主入口 v2（seller + commission + profit preview）

import { api } from './modules/api.js';
import { state, setState, subscribe, getState } from './modules/state.js';
import { COMMISSION_DEFAULTS, calcProfit, formatRate } from './modules/commission.js';
import { formatCurrency, formatDate, todayStr, escapeHtml, capitalizeBrand } from './modules/format.js';
import { isAuthenticated, login } from './modules/auth.js';
import { callAI } from './modules/ai.js';
import { getAllChats, createChat, getChat, addMessage, deleteChat, getChatMessages } from './modules/aiStorage.js';

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
  headerMonthlyTotal: $('#headerMonthlyTotal'),
  statsGrid: $('#statsGrid'),
  sellerTabs: $('#sellerTabs'),
  viewTabs: $('#viewTabs'),
  transactionsView: $('#transactionsView'),
  monthlyView: $('#monthlyView'),
  aiView: $('#aiView'),
  aiNewChat: $('#aiNewChat'),
  aiChatList: $('#aiChatList'),
  aiMessages: $('#aiMessages'),
  aiInput: $('#aiInput'),
  aiSend: $('#aiSend'),
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
    el.aiView.style.display = 'none';
    refreshAll();
  } else if (view === 'monthly') {
    // 月度统计：隐藏 seller-tabs，只显示月均+年总数
    el.sellerTabs.style.display = 'none';
    el.statsGrid.style.display = 'none';
    el.transactionsView.style.display = 'none';
    el.monthlyView.style.display = 'block';
    el.aiView.style.display = 'none';
    loadMonthlyStats();
  } else if (view === 'ai') {
    // AI助手：隐藏 seller-tabs、统计和FAB按钮
    el.sellerTabs.style.display = 'none';
    el.statsGrid.style.display = 'none';
    el.transactionsView.style.display = 'none';
    el.monthlyView.style.display = 'none';
    el.aiView.style.display = 'block';
    el.fab.style.display = 'none';
    loadAIView();
  } else {
    // 其他视图恢复FAB按钮
    el.fab.style.display = 'flex';
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
    updateHeaderMonthlyTotal(); // 更新header的当月总计
  } catch (e) {
    console.error('[Summary]', e);
    showToast('统计数据加载失败', 'error');
  }
}

// 更新header的当月总计（公司+个人）
async function updateHeaderMonthlyTotal() {
  if (!el.headerMonthlyTotal) return;

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const endDate = `${year}-${month}-${lastDay}`;

    // 获取公司和个人的当月统计
    const [companyRes, personalRes] = await Promise.all([
      api.getSummary({ startDate, endDate, seller: 'company' }),
      api.getSummary({ startDate, endDate, seller: 'personal' })
    ]);

    // 防御性检查
    if (!companyRes || !personalRes) {
      console.warn('[HeaderMonthlyTotal] API返回数据为空');
      return;
    }

    const companyData = companyRes.data || companyRes;
    const personalData = personalRes.data || personalRes;

    const BASE_SALARY = 8000; // 公司底薪
    const companyProfit = parseFloat(companyData.totalProfit) || 0;
    const personalProfit = parseFloat(personalData.totalProfit) || 0;
    const companyTotal = companyProfit + BASE_SALARY;
    const personalTotal = personalProfit;
    const monthlyTotal = companyTotal + personalTotal;

    // 更新显示
    const valueSpan = el.headerMonthlyTotal.querySelector('span:last-child');
    if (valueSpan) {
      valueSpan.textContent = `¥${Math.round(monthlyTotal).toLocaleString()}`;
    }
  } catch (e) {
    console.error('[HeaderMonthlyTotal]', e);
    // 失败时显示默认值
    const valueSpan = el.headerMonthlyTotal.querySelector('span:last-child');
    if (valueSpan) {
      valueSpan.textContent = '¥0';
    }
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
  updateHeaderMonthlyTotal(); // 同时更新header的当月总计
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

  // AI助手事件
  el.aiNewChat.addEventListener('click', handleNewChat);
  el.aiSend.addEventListener('click', handleSendMessage);
  el.aiInput.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSendMessage();
    }
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

// ═══ AI助手功能 ═══
let currentChatId = null;

// 加载AI视图
function loadAIView() {
  const chats = getAllChats();

  // 如果没有对话，创建第一个
  if (chats.length === 0) {
    const newChat = createChat();
    currentChatId = newChat.id;
  } else if (!currentChatId) {
    // 默认选中第一个对话
    currentChatId = chats[0].id;
  }

  renderChatList();
  renderMessages();

  // 加载当前对话的暂存数据
  loadSavedFormData();

  // 确保表单展开
  const aiFormContent = document.getElementById('aiFormContent');
  const aiFormToggle = document.getElementById('aiFormToggle');
  if (aiFormContent && aiFormToggle) {
    aiFormContent.classList.remove('ai-form__content--collapsed');
    setTimeout(() => {
      aiFormContent.style.maxHeight = aiFormContent.scrollHeight + 'px';
    }, 100);
    aiFormToggle.textContent = '收起';
  }

  // 设置侧边栏初始状态为隐藏
  const aiSidebar = document.getElementById('aiSidebar');
  const aiMain = document.querySelector('.ai-main');
  const aiToggleSidebar = document.getElementById('aiToggleSidebar');
  if (aiSidebar && aiMain && aiToggleSidebar) {
    aiSidebar.classList.add('ai-sidebar--collapsed');
    aiMain.classList.add('ai-main--expanded');
    aiToggleSidebar.textContent = '☰';
  }

  // 默认选中个人交易
  const personalBtn = document.querySelector('.ai-form__btn[data-field="type"][data-value="personal"]');
  if (personalBtn && !formData.type) {
    personalBtn.click();
  }
}

// 渲染对话列表
function renderChatList() {
  const chats = getAllChats();

  if (chats.length === 0) {
    el.aiChatList.innerHTML = '<div style="text-align:center;color:var(--text-3);font-size:0.75rem;padding:20px;">暂无对话</div>';
    return;
  }

  el.aiChatList.innerHTML = chats.map(chat => {
    const active = chat.id === currentChatId ? ' ai-chat-item--active' : '';
    return `
      <div class="ai-chat-item${active}" data-id="${chat.id}">
        ${escapeHtml(chat.title)}
        <button class="ai-chat-item__delete" data-id="${chat.id}" title="删除">×</button>
      </div>
    `;
  }).join('');

  // 绑定点击事件
  el.aiChatList.querySelectorAll('.ai-chat-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('ai-chat-item__delete')) {
        currentChatId = item.dataset.id;
        renderChatList();
        renderMessages();
        loadSavedFormData(); // 切换对话时加载暂存数据
      }
    });
  });

  // 绑定删除事件
  el.aiChatList.querySelectorAll('.ai-chat-item__delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (confirm('确定删除这个对话？')) {
        deleteChat(id);
        if (currentChatId === id) {
          const chats = getAllChats();
          currentChatId = chats.length > 0 ? chats[0].id : null;
        }
        renderChatList();
        renderMessages();
      }
    });
  });
}

// 渲染消息
function renderMessages() {
  if (!currentChatId) {
    el.aiMessages.innerHTML = '<div style="text-align:center;color:var(--text-3);padding:40px;">选择或创建一个对话开始</div>';
    return;
  }

  const chat = getChat(currentChatId);
  if (!chat || chat.messages.length === 0) {
    el.aiMessages.innerHTML = '<div style="text-align:center;color:var(--text-3);padding:40px;">输入你的问题，AI助手会帮你计算</div>';
    return;
  }

  el.aiMessages.innerHTML = chat.messages.map(msg => {
    const className = msg.role === 'user' ? 'ai-message--user' : 'ai-message--assistant';
    return `<div class="ai-message ${className}">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>`;
  }).join('');

  // 滚动到底部
  el.aiMessages.scrollTop = el.aiMessages.scrollHeight;
}

// 新建对话
function handleNewChat() {
  const newChat = createChat();
  currentChatId = newChat.id;
  renderChatList();
  renderMessages();
  el.aiInput.focus();
}

// 发送消息
async function handleSendMessage() {
  const content = el.aiInput.value.trim();
  if (!content) return;

  // 如果没有当前对话，创建一个
  if (!currentChatId) {
    const newChat = createChat();
    currentChatId = newChat.id;
    renderChatList();
  }

  // 添加用户消息
  addMessage(currentChatId, 'user', content);
  el.aiInput.value = '';
  renderMessages();

  // 禁用发送按钮
  el.aiSend.disabled = true;
  el.aiSend.textContent = '思考中...';

  try {
    // 获取对话历史并调用AI
    const messages = getChatMessages(currentChatId);
    const response = await callAI(messages);

    // 添加AI回复
    addMessage(currentChatId, 'assistant', response);
    renderChatList(); // 更新列表（可能标题变了）
    renderMessages();
  } catch (error) {
    console.error('AI调用失败:', error);

    // 显示更友好的错误消息
    let errorMsg = 'AI调用失败，请稍后重试';
    if (error.message.includes('503')) {
      errorMsg = 'AI服务暂时不可用，请稍后重试';
    } else if (error.message.includes('429')) {
      errorMsg = '请求过于频繁，请稍后再试';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorMsg = '网络连接失败，请检查网络';
    } else if (error.message) {
      errorMsg = `AI调用失败: ${error.message}`;
    }

    el.aiMessages.innerHTML += `<div class="ai-message ai-message--error">❌ ${escapeHtml(errorMsg)}</div>`;
    el.aiMessages.scrollTop = el.aiMessages.scrollHeight;
  } finally {
    // 恢复发送按钮
    el.aiSend.disabled = false;
    el.aiSend.textContent = '发送';
    el.aiInput.focus();
  }
}

// ═══ AI视图交互增强 ═══
// 折叠/展开侧边栏
const aiToggleSidebar = document.getElementById('aiToggleSidebar');
const aiSidebar = document.getElementById('aiSidebar');
const aiMain = document.querySelector('.ai-main');
let sidebarCollapsed = true;  // 初始状态为隐藏

if (aiToggleSidebar) {
  aiToggleSidebar.addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    if (sidebarCollapsed) {
      aiSidebar.classList.add('ai-sidebar--collapsed');
      if (aiMain) aiMain.classList.add('ai-main--expanded');
      aiToggleSidebar.textContent = '☰';
    } else {
      aiSidebar.classList.remove('ai-sidebar--collapsed');
      if (aiMain) aiMain.classList.remove('ai-main--expanded');
      aiToggleSidebar.textContent = '✕';
    }
  });
}

// 交互式表单
const aiForm = document.getElementById('aiForm');
const aiFormToggle = document.getElementById('aiFormToggle');
const aiFormContent = document.getElementById('aiFormContent');
const formSubmit = document.getElementById('formSubmit');
const formSave = document.getElementById('formSave');
const formQuota = document.getElementById('formQuota');
const formCost = document.getElementById('formCost');
const formPrice = document.getElementById('formPrice');
const formCostGroup = document.getElementById('formCostGroup');
const goodsItems = document.getElementById('goodsItems');
const addGoodsBtn = document.getElementById('addGoodsBtn');
const totalGoodsDisplay = document.getElementById('totalGoodsDisplay');

let formData = {
  type: null,
  goods: []
};
let formExpanded = true;

// 从localStorage加载暂存数据（按对话ID）
function loadSavedFormData() {
  if (!currentChatId) return;

  try {
    const key = `aiFormData_${currentChatId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      const data = JSON.parse(saved);

      // 恢复交易类型
      if (data.type) {
        formData.type = data.type;
        // 先清除所有交易类型按钮的active状态
        document.querySelectorAll('.ai-form__btn[data-field="type"]').forEach(b => {
          b.classList.remove('ai-form__btn--active');
        });
        // 设置正确的按钮为active
        const btn = document.querySelector(`.ai-form__btn[data-field="type"][data-value="${data.type}"]`);
        if (btn) {
          btn.classList.add('ai-form__btn--active');
          if (data.type === 'personal') {
            formCostGroup.style.display = 'block';
          } else {
            formCostGroup.style.display = 'none';
          }
        }
      }

      // 恢复额度总计
      if (data.quota) formQuota.value = data.quota;

      // 恢复成本折扣
      if (data.cost) formCost.value = data.cost;

      // 恢复卖价折扣
      if (data.price) formPrice.value = data.price;

      // 恢复货物明细
      if (data.goods && data.goods.length > 0) {
        // 清空现有货物项
        while (goodsItems.children.length > 0) {
          goodsItems.removeChild(goodsItems.lastChild);
        }

        // 重新创建货物项
        data.goods.forEach((good) => {
          // 支持旧数据格式（直接是数字）和新数据格式（包含name和amount）
          const goodName = typeof good === 'object' ? (good.name || '') : '';
          const goodAmount = typeof good === 'object' ? good.amount : good;

          const item = createGoodsItem(goodName, goodAmount);
          goodsItems.appendChild(item);
        });

        updateTotalGoods();
      }

      // 恢复输入框内容
      if (data.inputText && el.aiInput) {
        el.aiInput.value = data.inputText;
      }

      // 更新表单内容高度，防止按钮被裁剪
      if (formExpanded && aiFormContent) {
        setTimeout(() => {
          aiFormContent.style.maxHeight = aiFormContent.scrollHeight + 'px';
        }, 50);
      }
    }
  } catch (e) {
    console.error('加载暂存数据失败:', e);
  }
}

// 创建货物项的HTML元素
function createGoodsItem(name = '', amount = '') {
  const item = document.createElement('div');
  item.className = 'ai-form__quota-item';
  item.innerHTML = `
    <input type="text" class="ai-form__input goods-name" placeholder="商品名称" style="width:80px;flex-shrink:0;" value="" maxlength="20">
    <input type="text" inputmode="decimal" class="ai-form__input goods-amount" placeholder="货物金额（元）" style="flex:1;" data-number-only value="">
    <button type="button" class="ai-form__btn-remove" style="width:32px;height:38px;border:1px solid var(--danger);color:var(--danger);background:var(--surface);border-radius:var(--radius-sm);cursor:pointer;">−</button>
  `;

  // 设置值
  const nameInput = item.querySelector('.goods-name');
  const amountInput = item.querySelector('.goods-amount');
  if (nameInput) nameInput.value = name;
  if (amountInput) amountInput.value = amount;

  // 添加数字限制
  if (amountInput) restrictNumberInput(amountInput);

  // 绑定删除按钮
  item.querySelector('.ai-form__btn-remove').addEventListener('click', () => {
    if (goodsItems.children.length > 1) {
      item.remove();
      updateTotalGoods();
      // 更新表单高度
      if (formExpanded && aiFormContent) {
        aiFormContent.style.maxHeight = aiFormContent.scrollHeight + 'px';
      }
    }
  });

  return item;
}

// 页面加载时恢复数据（延迟执行，确保currentChatId已设置）
if (aiForm) {
  // 不立即执行，等待loadAIView中调用
}

// 收起/展开表单
if (aiFormToggle && aiFormContent) {
  aiFormToggle.addEventListener('click', () => {
    formExpanded = !formExpanded;
    if (formExpanded) {
      aiFormContent.classList.remove('ai-form__content--collapsed');
      aiFormContent.style.maxHeight = aiFormContent.scrollHeight + 'px';
      aiFormToggle.textContent = '收起';
    } else {
      aiFormContent.style.maxHeight = '0';
      aiFormContent.classList.add('ai-form__content--collapsed');
      aiFormToggle.textContent = '展开';
    }
  });

  // 初始化：默认展开状态
  if (formExpanded) {
    aiFormContent.classList.remove('ai-form__content--collapsed');
    setTimeout(() => {
      aiFormContent.style.maxHeight = aiFormContent.scrollHeight + 'px';
    }, 0);
    aiFormToggle.textContent = '收起';
  }
}

// 计算货物总额
function updateTotalGoods() {
  let total = 0;
  goodsItems.querySelectorAll('.goods-amount').forEach(input => {
    const val = parseFloat(input.value);
    if (val && val > 0) {
      total += val;
    }
  });

  if (total > 0) {
    let displayText = `(总计: ${total.toFixed(0)}元)`;

    // 计算差额（额度总计 - 实际货物总计），单独括号显示
    const quota = parseFloat(formQuota.value);
    if (quota && quota > 0) {
      const diff = quota - total;
      if (diff > 0) {
        displayText += ` (-${diff.toFixed(0)}元)`;
      } else if (diff < 0) {
        displayText += ` (+${Math.abs(diff).toFixed(0)}元)`;
      }
    }

    totalGoodsDisplay.textContent = displayText;
  } else {
    totalGoodsDisplay.textContent = '';
  }
}

// 监听货物输入变化
if (goodsItems) {
  goodsItems.addEventListener('input', (e) => {
    if (e.target.classList.contains('goods-amount')) {
      updateTotalGoods();
    }
  });
}

// 监听额度总计输入变化
if (formQuota) {
  formQuota.addEventListener('input', () => {
    updateTotalGoods();
  });
}

// 限制所有数字输入框只能输入数字和小数点
function restrictNumberInput(input) {
  input.addEventListener('input', (e) => {
    let value = e.target.value;
    let originalValue = value;

    // 只保留数字和小数点
    value = value.replace(/[^\d.]/g, '');

    // 只保留第一个小数点
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }

    // 只有当值发生变化时才更新，避免死循环
    if (value !== originalValue) {
      e.target.value = value;
    }
  });
}

// 为已存在的数字输入框添加限制
if (formQuota) restrictNumberInput(formQuota);
if (formCost) restrictNumberInput(formCost);
if (formPrice) restrictNumberInput(formPrice);
goodsItems.querySelectorAll('.goods-amount').forEach(input => restrictNumberInput(input));

// 添加货物项
if (addGoodsBtn) {
  addGoodsBtn.addEventListener('click', () => {
    const item = createGoodsItem('', '');
    goodsItems.appendChild(item);

    // 更新表单高度
    if (formExpanded && aiFormContent) {
      aiFormContent.style.maxHeight = aiFormContent.scrollHeight + 'px';
    }
  });
}

// 删除货物项（初始项）
goodsItems.querySelectorAll('.ai-form__btn-remove').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const item = e.target.closest('.ai-form__quota-item');
    if (goodsItems.children.length > 1) {
      item.remove();
      updateTotalGoods();
    }
  });
});

// 暂存按钮
if (formSave) {
  formSave.addEventListener('click', () => {
    if (!currentChatId) {
      alert('请先创建或选择一个对话');
      return;
    }

    // 收集货物明细（包含名称和金额）
    const goods = [];
    goodsItems.querySelectorAll('.ai-form__quota-item').forEach(item => {
      const nameInput = item.querySelector('.goods-name');
      const amountInput = item.querySelector('.goods-amount');
      const amount = parseFloat(amountInput.value);
      if (amount && amount > 0) {
        goods.push({
          name: nameInput ? nameInput.value : '',
          amount: amount
        });
      }
    });

    const saveData = {
      type: formData.type,
      quota: formQuota.value,
      cost: formCost.value,
      price: formPrice.value,
      goods: goods,
      inputText: el.aiInput ? el.aiInput.value : '' // 保存输入框内容
    };

    const key = `aiFormData_${currentChatId}`;
    localStorage.setItem(key, JSON.stringify(saveData));
    alert('表单已暂存到当前对话');
  });
}

// 按钮选择逻辑
document.querySelectorAll('.ai-form__btn[data-field]').forEach(btn => {
  btn.addEventListener('click', () => {
    const field = btn.dataset.field;
    const value = btn.dataset.value;

    // 同一组按钮只能选一个
    document.querySelectorAll(`.ai-form__btn[data-field="${field}"]`).forEach(b => {
      b.classList.remove('ai-form__btn--active');
    });
    btn.classList.add('ai-form__btn--active');

    // 保存数据
    formData[field] = value;

    // 如果是交易类型，显示/隐藏成本折扣
    if (field === 'type') {
      if (value === 'personal') {
        formCostGroup.style.display = 'block';
      } else {
        formCostGroup.style.display = 'none';
      }
    }
  });
});

// 表单提交
if (formSubmit) {
  formSubmit.addEventListener('click', () => {
    // 收集货物明细
    formData.goods = [];
    goodsItems.querySelectorAll('.goods-amount').forEach(input => {
      const val = parseFloat(input.value);
      if (val && val > 0) {
        formData.goods.push(val);
      }
    });

    const quota = parseFloat(formQuota.value);
    const totalGoods = formData.goods.reduce((a, b) => a + b, 0);
    const cost = parseFloat(formCost.value);
    const price = parseFloat(formPrice.value);

    // 验证 - 使用更友好的提示
    let errorMsg = '';
    if (!formData.type) {
      errorMsg = '请选择交易类型';
    } else if (!quota || quota <= 0) {
      errorMsg = '请输入额度总计';
    } else if (formData.goods.length === 0 || totalGoods <= 0) {
      errorMsg = '请输入至少一个有效的货物金额';
    } else if (!price || price <= 0 || price > 1) {
      errorMsg = '请输入有效的卖价折扣（0-1之间）';
    } else if (formData.type === 'personal' && (!cost || cost <= 0 || cost > 1)) {
      errorMsg = '个人交易需要输入成本折扣（0-1之间）';
    }

    if (errorMsg) {
      // 使用toast代替alert
      showToast(errorMsg, 'error');
      return;
    }

    // 计算超出部分
    const excess = totalGoods > quota ? totalGoods - quota : 0;

    // 生成问题文本
    let question = '';
    if (formData.type === 'personal') {
      // 个人交易：不计算给公司的钱，只算利润和客户支付
      question = `个人交易：我有${quota}的额度`;
      question += `，成本${(cost * 100).toFixed(0)}折，卖${(price * 100).toFixed(0)}折`;
      if (formData.goods.length > 1) {
        question += `，实际货物${totalGoods}元（由${formData.goods.join('+')}组成）`;
      } else {
        question += `，实际货物${totalGoods}元`;
      }
      if (excess > 0) {
        question += `，超出${excess}元由公司承担折损`;
      }
      question += `。帮我算：1.我的利润是多少；2.客户需要付多少钱`;
    } else {
      // 公司交易：计算客户实际支付和给公司的钱
      question = `公司交易：额度${quota}元，${(price * 100).toFixed(0)}折`;

      // 添加货物明细（每个货物的折扣计算）
      if (formData.goods.length > 1) {
        question += `，实际货物总计${totalGoods}元，包括：`;
        const goodsDetails = formData.goods.map(g => `${g}元×${price}=${(g * price).toFixed(2)}元`).join('，');
        question += goodsDetails;
      } else {
        question += `，实际货物${totalGoods}元×${price}=${(totalGoods * price).toFixed(2)}元`;
      }

      // 计算客户实际支付
      const customerPay = totalGoods * price;
      question += `。客户实际支付：${customerPay.toFixed(2)}元`;

      // 如果超额，说明给公司的钱
      if (excess > 0) {
        // 给公司的钱 = 客户实际支付 - 自己垫付的超额部分
        const toCompany = customerPay - excess;
        question += `。超额${excess}元由我自己垫付。给公司的钱：${toCompany.toFixed(2)}元（客户支付${customerPay.toFixed(2)}元 - 自己垫付${excess}元）`;
      } else {
        // 没有超额，给公司的钱就是客户实际支付
        question += `。给公司的钱：${customerPay.toFixed(2)}元`;
      }

      question += `。请帮我整理收款明细，方便我收钱`;
    }

    // 填充到输入框并发送
    el.aiInput.value = question;
    handleSendMessage();

    // 清除当前对话的暂存数据
    if (currentChatId) {
      const key = `aiFormData_${currentChatId}`;
      localStorage.removeItem(key);
    }

    // 收起表单
    if (aiFormToggle && aiFormContent) {
      formExpanded = false;
      aiFormContent.style.maxHeight = '0';
      aiFormContent.classList.add('ai-form__content--collapsed');
      aiFormToggle.textContent = '展开';
    }

    // 清空表单
    document.querySelectorAll('.ai-form__btn--active').forEach(b => {
      b.classList.remove('ai-form__btn--active');
    });
    formQuota.value = '';
    goodsItems.querySelectorAll('.goods-amount').forEach(input => {
      input.value = '';
    });
    goodsItems.querySelectorAll('.goods-name').forEach(input => {
      input.value = '';
    });
    // 只保留第一个货物项
    while (goodsItems.children.length > 1) {
      goodsItems.removeChild(goodsItems.lastChild);
    }
    // 清空第一个货物项的商品名称
    const firstGoodsName = goodsItems.querySelector('.goods-name');
    if (firstGoodsName) firstGoodsName.value = '';
    formCost.value = '';
    formPrice.value = '';
    formCostGroup.style.display = 'none';
    formData = { type: null, goods: [] };
    updateTotalGoods();
  });
}

// 显示表单
if (aiForm) {
  aiForm.style.display = 'block';
}

} // end of initApp()
