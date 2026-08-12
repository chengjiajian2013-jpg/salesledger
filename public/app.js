// SalesLedger — 应用主入口 v2（seller + commission + profit preview）

import { api } from './modules/api.js';
import { state, setState, subscribe, getState } from './modules/state.js';
import { COMMISSION_DEFAULTS, calcProfit, formatRate } from './modules/commission.js';
import { formatCurrency, formatDate, todayStr, escapeHtml, capitalizeBrand } from './modules/format.js';
import { isAuthenticated, login } from './modules/auth.js';
import { callAI } from './modules/ai.js';
import { getAllChats, createChat, getChat, addMessage, deleteChat, getChatMessages, updateChat, saveFormData, getFormData } from './modules/aiStorageApi.js';

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
  aiRecordBar: $('#aiRecordBar'),
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

// 更新模态框中的类型指示器
function updateSellerIndicator() {
  // 动态获取元素，因为模态框内容可能在页面加载后才渲染
  const sellerIndicator = document.getElementById('sellerIndicator');
  const sellerSwitch = document.getElementById('sellerSwitch');

  if (!sellerIndicator || !sellerSwitch) return;

  // 更新文本
  if (currentSeller === 'personal') {
    sellerIndicator.textContent = '个人';
    sellerSwitch.textContent = '切换公司';
  } else {
    sellerIndicator.textContent = '公司';
    sellerSwitch.textContent = '切换个人';
  }

  // 更新模态框颜色
  const modal = document.getElementById('modal');
  if (modal) {
    modal.className = 'modal modal--' + currentSeller;
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
  updateSellerIndicator();
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
  // 智能解析功能已移除，保留空函数以防旧代码调用
  if (!el.parseBody) return;
  const show = open != null ? open : el.parseBody.style.display === 'none';
  el.parseBody.style.display = show ? 'block' : 'none';
}

function resetParse() {
  // 智能解析功能已移除，但保留空函数以防旧代码调用
  if (!el.parseInput || !el.parseWarning || !el.parseBody) return;
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

  // 类型切换按钮（使用事件委托，因为按钮在模态框内）
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'sellerSwitch') {
      const newSeller = currentSeller === 'personal' ? 'company' : 'personal';
      selectSeller(newSeller, true);
      updateSellerIndicator();
    }
  });

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

  // 智能解析（已移除，保留空检查避免错误）
  if (el.parseToggle) {
    el.parseToggle.addEventListener('click', () => {
      const willOpen = el.parseBody.style.display === 'none';
      toggleParse(true);
      if (willOpen) setTimeout(() => el.parseInput.focus(), 250);
    });
  }
  if (el.parseBtn) {
    el.parseBtn.addEventListener('click', runParse);
  }
  if (el.parseClear) {
    el.parseClear.addEventListener('click', resetParse);
  }
  if (el.parseInput) {
    // 解析框内 Cmd/Ctrl+Enter 快速解析
    el.parseInput.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runParse();
    });
  }

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

  // 输入框内容变化时保存
  el.aiInput.addEventListener('input', () => {
    saveCurrentFormData();
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
async function loadAIView() {
  const chats = await getAllChats();

  // 如果没有对话，创建第一个
  if (chats.length === 0) {
    const newChat = await createChat();
    currentChatId = newChat.id;
  } else if (!currentChatId) {
    // 默认选中第一个对话
    currentChatId = chats[0].id;
  }

  await renderChatList();
  await renderMessages();

  // 加载当前对话的暂存数据
  await loadSavedFormData();

  // 只在对话没有消息时展开表单（新对话）
  const aiFormContent = document.getElementById('aiFormContent');
  const aiFormToggle = document.getElementById('aiFormToggle');
  const chat = currentChatId ? await getChat(currentChatId) : null;
  const hasMessages = chat && chat.messages && chat.messages.length > 0;
  const isClosed = chat && chat.status === 'closed';

  if (aiFormContent && aiFormToggle) {
    if (!hasMessages && !isClosed) {
      // 新对话且未结束：展开表单
      aiFormContent.classList.remove('ai-form__content--collapsed');
      setTimeout(() => {
        aiFormContent.style.maxHeight = aiFormContent.scrollHeight + 'px';
      }, 100);
      aiFormToggle.textContent = '收起';
      formExpanded = true;  // 同步状态变量
    } else {
      // 已有消息或已结束：收起表单
      aiFormContent.style.maxHeight = '0';
      aiFormContent.classList.add('ai-form__content--collapsed');
      aiFormToggle.textContent = '展开';
      formExpanded = false;  // 同步状态变量
    }
  }

  // 如果对话已关闭，隐藏输入区域和表单操作按钮
  const aiInputContainer = document.querySelector('.ai-input-container');
  const formActionsContainer = document.querySelector('.ai-form__actions');
  const addGoodsBtn = document.getElementById('addGoodsBtn');

  if (aiInputContainer) {
    if (isClosed) {
      aiInputContainer.style.display = 'none';
    } else {
      aiInputContainer.style.display = 'flex';
    }
  }

  if (formActionsContainer) {
    if (isClosed) {
      formActionsContainer.style.display = 'none';
    } else {
      formActionsContainer.style.display = 'flex';
    }
  }

  if (addGoodsBtn) {
    if (isClosed) {
      addGoodsBtn.style.display = 'none';
    } else {
      addGoodsBtn.style.display = 'block';
    }
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
async function renderChatList() {
  const chats = await getAllChats();

  if (chats.length === 0) {
    el.aiChatList.innerHTML = '<div style="text-align:center;color:var(--text-3);font-size:0.75rem;padding:20px;">暂无对话</div>';
    return;
  }

  el.aiChatList.innerHTML = chats.map(chat => {
    const active = chat.id === currentChatId ? ' ai-chat-item--active' : '';
    const closedIcon = chat.status === 'closed' ? ' ✅' : '';
    return `
      <div class="ai-chat-item${active}" data-id="${chat.id}">
        ${escapeHtml(chat.title)}${closedIcon}
        <button class="ai-chat-item__delete" data-id="${chat.id}" title="删除">×</button>
      </div>
    `;
  }).join('');

  // 绑定点击事件
  el.aiChatList.querySelectorAll('.ai-chat-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      if (!e.target.classList.contains('ai-chat-item__delete')) {
        currentChatId = item.dataset.id;
        await renderChatList();
        await renderMessages();
        await loadSavedFormData(); // 切换对话时加载暂存数据

        // 根据对话状态显示/隐藏按钮
        const chat = await getChat(currentChatId);
        const isClosed = chat && chat.status === 'closed';
        const aiInputContainer = document.querySelector('.ai-input-container');
        const formActionsContainer = document.querySelector('.ai-form__actions');
        const addGoodsBtn = document.getElementById('addGoodsBtn');

        if (aiInputContainer) {
          aiInputContainer.style.display = isClosed ? 'none' : 'flex';
        }
        if (formActionsContainer) {
          formActionsContainer.style.display = isClosed ? 'none' : 'flex';
        }
        if (addGoodsBtn) {
          addGoodsBtn.style.display = isClosed ? 'none' : 'block';
        }
      }
    });
  });

  // 绑定删除事件
  el.aiChatList.querySelectorAll('.ai-chat-item__delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (confirm('确定删除这个对话？')) {
        await deleteChat(id);
        if (currentChatId === id) {
          const chats = await getAllChats();
          currentChatId = chats.length > 0 ? chats[0].id : null;
        }
        await renderChatList();
        await renderMessages();
      }
    });
  });
}

// 渲染消息
async function renderMessages() {
  if (!currentChatId) {
    el.aiMessages.innerHTML = '<div style="text-align:center;color:var(--text-3);padding:40px;">选择或创建一个对话开始</div>';
    // 隐藏录入按钮
    if (el.aiRecordBar) el.aiRecordBar.style.display = 'none';
    // 显示输入区域
    el.aiInput.disabled = false;
    el.aiSend.disabled = false;
    el.aiInput.style.display = '';
    const aiEndBtn = document.getElementById('aiEndBtn');
    if (aiEndBtn) { aiEndBtn.disabled = false; aiEndBtn.style.display = ''; }
    return;
  }

  const chat = await getChat(currentChatId);
  if (!chat || !chat.messages || chat.messages.length === 0) {
    el.aiMessages.innerHTML = '<div style="text-align:center;color:var(--text-3);padding:40px;">输入你的问题，AI助手会帮你计算</div>';
    // 隐藏录入按钮
    if (el.aiRecordBar) el.aiRecordBar.style.display = 'none';
    // 显示输入区域和按钮（新对话或空对话）
    el.aiInput.disabled = false;
    el.aiSend.disabled = false;
    el.aiInput.style.display = '';
    el.aiSend.style.display = '';
    const aiEndBtn = document.getElementById('aiEndBtn');
    if (aiEndBtn) {
      aiEndBtn.disabled = false;
      aiEndBtn.style.display = '';
    }
    const aiInputButtons = document.querySelector('.ai-input__buttons');
    if (aiInputButtons) aiInputButtons.style.display = '';
    return;
  }

  // 检查对话是否已结束
  const isClosed = chat.status === 'closed';
  if (isClosed) {
    // 显示录入按钮
    if (el.aiRecordBar) el.aiRecordBar.style.display = 'block';
    // 隐藏输入区域和按钮
    el.aiInput.style.display = 'none';
    el.aiSend.style.display = 'none';
    const aiEndBtn = document.getElementById('aiEndBtn');
    if (aiEndBtn) aiEndBtn.style.display = 'none';
    const aiInputButtons = document.querySelector('.ai-input__buttons');
    if (aiInputButtons) aiInputButtons.style.display = 'none';
  } else {
    // 隐藏录入按钮
    if (el.aiRecordBar) el.aiRecordBar.style.display = 'none';
    // 显示输入区域和按钮
    el.aiInput.style.display = '';
    el.aiSend.style.display = '';
    const aiEndBtn = document.getElementById('aiEndBtn');
    if (aiEndBtn) aiEndBtn.style.display = '';
    const aiInputButtons = document.querySelector('.ai-input__buttons');
    if (aiInputButtons) aiInputButtons.style.display = '';
  }

  el.aiMessages.innerHTML = chat.messages.map((msg, idx) => {
    const className = msg.role === 'user' ? 'ai-message--user' : 'ai-message--assistant';
    const copyBtn = msg.role === 'assistant' ? `<button class="ai-message__copy" data-idx="${idx}" title="复制">📋</button>` : '';
    // 如果是AI回复，移除<ai-data>标签后再显示
    const displayContent = msg.role === 'assistant' ? removeAIDataTag(msg.content) : msg.content;
    return `<div class="ai-message ${className}">${escapeHtml(displayContent).replace(/\n/g, '<br>')}${copyBtn}</div>`;
  }).join('');

  // 绑定复制按钮事件
  el.aiMessages.querySelectorAll('.ai-message__copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      if (chat.messages[idx]) {
        // 复制时移除<ai-data>标签
        const contentToCopy = removeAIDataTag(chat.messages[idx].content);
        navigator.clipboard.writeText(contentToCopy).then(() => {
          showToast('已复制到剪贴板', 'info');
        }).catch(() => {
          showToast('复制失败', 'error');
        });
      }
    });
  });

  // 滚动到底部
  el.aiMessages.scrollTop = el.aiMessages.scrollHeight;
}

// 新建对话
async function handleNewChat() {
  try {
    const newChat = await createChat();
    currentChatId = newChat.id;

    // 清空表单数据并设置默认值
    formData = { type: '', quota: '', cost: '0.8', price: '0.89', goods: [] };
    if (formQuota) formQuota.value = '';
    if (formCost) formCost.value = '0.8';
    if (formPrice) formPrice.value = '0.89';
    if (el.aiInput) el.aiInput.value = '';

    // 清空货物列表，保留一个空项
    if (goodsItems) {
      goodsItems.innerHTML = '';
      const item = createGoodsItem('', '');
      goodsItems.appendChild(item);
    }

    // 重置交易类型按钮
    document.querySelectorAll('.ai-form__btn[data-field="type"]').forEach(b => {
      b.classList.remove('ai-form__btn--active');
    });

    await renderChatList();
    await renderMessages();

    // 显示输入区域和表单操作按钮（新对话是活跃的）
    const aiInputContainer = document.querySelector('.ai-input-container');
    const formActionsContainer = document.querySelector('.ai-form__actions');
    const addGoodsBtn = document.getElementById('addGoodsBtn');
    if (aiInputContainer) aiInputContainer.style.display = 'flex';
    if (formActionsContainer) formActionsContainer.style.display = 'flex';
    if (addGoodsBtn) addGoodsBtn.style.display = 'block';

    // 默认选中个人交易
    const personalBtn = document.querySelector('.ai-form__btn[data-field="type"][data-value="personal"]');
    if (personalBtn) {
      personalBtn.click();
    }

    el.aiInput.focus();
  } catch (error) {
    console.error('[handleNewChat]', error);
    showToast('创建对话失败：' + (error.message || '未知错误'), 'error');
  }
}

// 发送消息
async function handleSendMessage() {
  const content = el.aiInput.value.trim();
  if (!content) return;

  // 如果没有当前对话，创建一个
  if (!currentChatId) {
    const newChat = await createChat();
    currentChatId = newChat.id;
    await renderChatList();
  }

  // 添加用户消息
  await addMessage(currentChatId, 'user', content);
  el.aiInput.value = '';
  await renderMessages();

  // 禁用发送按钮
  el.aiSend.disabled = true;
  el.aiSend.textContent = '思考中...';

  try {
    // 获取对话历史并调用AI
    const messages = await getChatMessages(currentChatId);
    const response = await callAI(messages);

    // 添加AI回复
    await addMessage(currentChatId, 'assistant', response);
    await renderChatList(); // 更新列表（可能标题变了）
    await renderMessages();
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

// 点击主区域（右侧）自动收起侧边栏
if (aiMain) {
  aiMain.addEventListener('click', () => {
    if (!sidebarCollapsed) {
      sidebarCollapsed = true;
      if (aiSidebar) aiSidebar.classList.add('ai-sidebar--collapsed');
      if (aiMain) aiMain.classList.add('ai-main--expanded');
      if (aiToggleSidebar) aiToggleSidebar.textContent = '☰';
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
async function loadSavedFormData() {
  if (!currentChatId) return;

  try {
    const data = await getFormData(currentChatId);

    // 如果没有数据，清空表单
    if (!data) {
      clearFormData();
      return;
    }

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
    } else {
      // 没有交易类型，清空按钮状态
      document.querySelectorAll('.ai-form__btn[data-field="type"]').forEach(b => {
        b.classList.remove('ai-form__btn--active');
      });
      formCostGroup.style.display = 'none';
    }

    // 恢复额度总计
    if (data.quota) {
      formQuota.value = data.quota;
    } else {
      formQuota.value = '';
    }

    // 恢复成本折扣
    if (data.cost) {
      formCost.value = data.cost;
    } else {
      formCost.value = '0.8';
    }

    // 恢复卖价折扣
    if (data.price) {
      formPrice.value = data.price;
    } else {
      formPrice.value = '0.89';
    }

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
    } else {
      // 没有货物数据，清空并保留一个空项
      while (goodsItems.children.length > 0) {
        goodsItems.removeChild(goodsItems.lastChild);
      }
      const item = createGoodsItem('', '');
      goodsItems.appendChild(item);
      updateTotalGoods();
    }

    // 恢复输入框内容
    if (data.input_text && el.aiInput) {
      el.aiInput.value = data.input_text;
    } else if (el.aiInput) {
      el.aiInput.value = '';
    }

    // 更新表单内容高度，防止按钮被裁剪
    if (formExpanded && aiFormContent) {
      setTimeout(() => {
        aiFormContent.style.maxHeight = aiFormContent.scrollHeight + 'px';
      }, 50);
    }
  } catch (e) {
    console.error('加载暂存数据失败:', e);
  }
}

// 清空表单数据
function clearFormData() {
  // 清空交易类型
  document.querySelectorAll('.ai-form__btn[data-field="type"]').forEach(b => {
    b.classList.remove('ai-form__btn--active');
  });
  formCostGroup.style.display = 'none';

  // 清空输入框
  if (formQuota) formQuota.value = '';
  if (formCost) formCost.value = '0.8';
  if (formPrice) formPrice.value = '0.89';
  if (el.aiInput) el.aiInput.value = '';

  // 清空货物列表，保留一个空项
  while (goodsItems.children.length > 0) {
    goodsItems.removeChild(goodsItems.lastChild);
  }
  const item = createGoodsItem('', '');
  goodsItems.appendChild(item);
  updateTotalGoods();
}

// 保存表单数据到数据库
async function saveCurrentFormData() {
  if (!currentChatId) return;

  try {
    // 收集当前货物列表
    const goods = [];
    goodsItems.querySelectorAll('.ai-form__quota-item').forEach(item => {
      const name = item.querySelector('.goods-name')?.value || '';
      const amount = item.querySelector('.goods-amount')?.value || '';
      if (name || amount) {
        goods.push({ name, amount });
      }
    });

    const formDataToSave = {
      type: formData.type || 'personal',
      quota: formQuota.value || '',
      cost: formCost.value || '',
      price: formPrice.value || '',
      goods: goods,
      input_text: el.aiInput.value.trim(),
    };

    await saveFormData(currentChatId, formDataToSave);
  } catch (e) {
    console.error('[saveCurrentFormData]', e);
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

  // 监听输入变化
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      saveCurrentFormData();
    });
  }
  if (amountInput) {
    amountInput.addEventListener('input', () => {
      updateTotalGoods();
      saveCurrentFormData();
    });
  }

  // 绑定删除按钮
  item.querySelector('.ai-form__btn-remove').addEventListener('click', () => {
    if (goodsItems.children.length > 1) {
      item.remove();
      updateTotalGoods();
      saveCurrentFormData();
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
    saveCurrentFormData();
  });
}

// 监听成本和售价变化
if (formCost) {
  formCost.addEventListener('input', () => {
    saveCurrentFormData();
  });
}

if (formPrice) {
  formPrice.addEventListener('input', () => {
    saveCurrentFormData();
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

// 步进器按钮事件处理
document.addEventListener('click', (e) => {
  const stepperBtn = e.target.closest('.ai-form__stepper-btn');
  if (!stepperBtn) return;

  const targetId = stepperBtn.dataset.target;
  const action = stepperBtn.dataset.action;
  const input = document.getElementById(targetId);

  if (!input) return;

  let value = parseFloat(input.value) || 0;
  const step = 0.01; // 每次增减0.01

  if (action === 'increase') {
    value = Math.min(value + step, 1); // 最大1
  } else if (action === 'decrease') {
    value = Math.max(value - step, 0); // 最小0
  }

  input.value = value.toFixed(2);

  // 触发input事件以保存数据
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

// 设置默认值
if (formCost && !formCost.value) formCost.value = '0.8';
if (formPrice && !formPrice.value) formPrice.value = '0.89';


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

    // 保存到数据库
    saveCurrentFormData();
  });
});

// 表单提交
if (formSubmit) {
  formSubmit.addEventListener('click', () => {
    // 收集货物明细（包含名称和金额）
    formData.goods = [];
    goodsItems.querySelectorAll('.ai-form__quota-item').forEach(item => {
      const nameInput = item.querySelector('.goods-name');
      const amountInput = item.querySelector('.goods-amount');
      const amount = parseFloat(amountInput.value);
      if (amount && amount > 0) {
        formData.goods.push({
          name: nameInput ? nameInput.value : '',
          amount: amount
        });
      }
    });

    const quota = parseFloat(formQuota.value);
    const totalGoods = formData.goods.reduce((a, b) => a + b.amount, 0);
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
        const goodsDesc = formData.goods.map(g => `${g.name ? g.name + '：' : ''}${g.amount}元`).join('、');
        question += `，实际货物共${totalGoods}元（${goodsDesc}）`;
      } else {
        const g = formData.goods[0];
        question += `，实际货物${g.name ? g.name + '：' : ''}${totalGoods}元`;
      }
      // 不要添加"由公司承担折损"，个人交易自己承担超额亏损
      question += `。帮我算：1.我的利润是多少；2.客户需要付多少钱`;
    } else {
      // 公司交易：计算客户实际支付和给公司的钱
      question = `公司交易：额度${quota}元，${(price * 100).toFixed(0)}折`;

      // 添加货物明细（包含商品名称）
      if (formData.goods.length > 1) {
        question += `，实际货物总计${totalGoods}元，包括：`;
        const goodsDetails = formData.goods.map(g => `${g.name ? g.name + '：' : ''}${g.amount}元×${price}=${(g.amount * price).toFixed(2)}元`).join('，');
        question += goodsDetails;
      } else {
        const g = formData.goods[0];
        question += `，实际货物${g.name ? g.name + '：' : ''}${totalGoods}元×${price}=${(totalGoods * price).toFixed(2)}元`;
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
    formCost.value = '0.8';
    formPrice.value = '0.89';
    formCostGroup.style.display = 'none';
    formData = { type: null, cost: '0.8', price: '0.89', goods: [] };
    updateTotalGoods();
  });
}

// 显示表单
if (aiForm) {
  aiForm.style.display = 'block';
}

// 结束对话按钮
const aiEndBtn = document.getElementById('aiEndBtn');
const aiRecordBar = document.getElementById('aiRecordBar');
const aiRecordBtn = document.getElementById('aiRecordBtn');

if (aiEndBtn) {
  aiEndBtn.addEventListener('click', async () => {
    if (!currentChatId) {
      showToast('请先选择一个对话', 'error');
      return;
    }

    const chat = await getChat(currentChatId);
    if (!chat || !chat.messages || chat.messages.length === 0) {
      showToast('对话中没有内容', 'error');
      return;
    }

    // 确认弹窗
    if (!confirm('确定要结束这个对话吗？结束后可以录入交易明细。')) {
      return;
    }

    try {
      // 更新对话状态为已关闭
      await updateChat(currentChatId, { status: 'closed' });

      // 显示录入按钮
      if (aiRecordBar) aiRecordBar.style.display = 'block';

      // 隐藏输入框和按钮
      el.aiInput.style.display = 'none';
      el.aiSend.style.display = 'none';
      aiEndBtn.style.display = 'none';
      const aiInputButtons = document.querySelector('.ai-input__buttons');
      if (aiInputButtons) aiInputButtons.style.display = 'none';

      // 更新列表显示
      await renderChatList();

      showToast('对话已结束，可以录入交易明细', 'info');
    } catch (error) {
      console.error('结束对话失败:', error);
      showToast('结束对话失败，请重试', 'error');
    }
  });
}

// 录入交易明细按钮
if (aiRecordBtn) {
  aiRecordBtn.addEventListener('click', async () => {
    if (!currentChatId) return;

    const chat = await getChat(currentChatId);
    if (!chat || !chat.messages || chat.messages.length === 0) return;

    // 获取最后一条AI回复
    const lastAssistantMsg = [...chat.messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistantMsg) {
      alert('没有找到AI回复');
      return;
    }

    console.log('===== 录入调试信息 =====');
    console.log('对话ID:', currentChatId);
    console.log('消息总数:', chat.messages.length);
    console.log('最后AI回复:', lastAssistantMsg.content.substring(0, 200));

    // 解析AI回复中的数值
    const result = parseAIResponse(lastAssistantMsg.content);
    console.log('解析结果:', result);

    // 从数据库获取表单数据
    const savedFormData = await getFormData(currentChatId);
    console.log('表单数据:', savedFormData);
    let formInfo = null;
    let goodsList = [];

    // 优先从AI回复中解析货物列表（因为用户可能追问修改，导致表单数据不准确）
    goodsList = parseGoodsFromAIResponse(lastAssistantMsg.content);
    console.log('从AI回复解析的货物:', goodsList);

    // 如果AI回复中没有货物明细，尝试从第一条用户消息解析
    if (goodsList.length === 0) {
      const firstUserMsg = chat.messages.find(m => m.role === 'user');
      if (firstUserMsg) {
        goodsList = parseGoodsFromQuestion(firstUserMsg.content);
        console.log('从用户消息解析的货物:', goodsList);
      }
    }

    // 如果还是没有，最后尝试从表单数据获取
    if (goodsList.length === 0 && savedFormData && savedFormData.goods) {
      goodsList = savedFormData.goods;
      console.log('从表单数据获取的货物:', goodsList);
    }

    // 交易类型必须从AI回复中提取，不使用表单数据的type
    const typeFromAI = parseTransactionTypeFromAI(lastAssistantMsg.content);
    console.log('AI回复中的交易类型:', typeFromAI);

    if (savedFormData) {
      // 使用数据库中的表单数据（不包括type）
      formInfo = {
        type: typeFromAI || 'personal',  // 完全依赖AI回复
        quota: parseFloat(savedFormData.quota) || result.quota || 0,
        price: parseFloat(savedFormData.price) || 0,
        cost: parseFloat(savedFormData.cost) || 0,
      };
    } else {
      // 兜底：从对话历史中解析
      const firstUserMsg = chat.messages.find(m => m.role === 'user');
      if (firstUserMsg) {
        formInfo = parseFormFromQuestion(firstUserMsg.content);
      }

      // 如果还没有额度，使用AI解析的
      if (formInfo && formInfo.quota === 0 && result.quota > 0) {
        formInfo.quota = result.quota;
      }

      // 交易类型强制使用AI回复
      if (typeFromAI && formInfo) {
        formInfo.type = typeFromAI;
      }
    }

    console.log('最终表单信息:', formInfo);
    console.log('最终货物列表:', goodsList);
    console.log('======================');

    // 打开录入模态框
    openTransactionModal(result, formInfo, goodsList);
  });
}

// 从AI回复中提取结构化JSON数据
function extractAIData(content) {
  // 匹配 <ai-data>...</ai-data> 标签
  const match = content.match(/<ai-data>(.*?)<\/ai-data>/s);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch (e) {
      console.error('解析AI数据JSON失败:', e);
      return null;
    }
  }
  return null;
}

// 从AI回复中移除<ai-data>标签（用于显示）
function removeAIDataTag(content) {
  return content.replace(/<ai-data>.*?<\/ai-data>/s, '').trim();
}

// 解析AI回复中的数值
function parseAIResponse(content) {
  // 优先尝试从<ai-data>标签提取JSON数据
  const aiData = extractAIData(content);
  if (aiData) {
    return {
      customerPay: aiData.customerPay || 0,
      toCompany: aiData.toCompany || 0,
      profit: aiData.profit || 0,
      excess: aiData.excess || 0,
      quota: aiData.quota || 0
    };
  }

  // 兜底：使用正则解析（兼容旧版AI回复）
  const result = {
    customerPay: 0,    // 客户支付
    toCompany: 0,      // 给公司的钱
    profit: 0,         // 利润
    excess: 0,         // 超额
    quota: 0           // 额度
  };

  // 匹配"客户支付"部分的"合计"金额
  // 格式：**客户支付：**\n- xxx\n- 合计：**45500元**
  const customerPaySection = content.match(/\*\*客户(?:实际)?(?:支付|需支付)[：:]\*\*([\s\S]*?)(?=\n\n|\*\*|$)/);
  if (customerPaySection) {
    const totalMatch = customerPaySection[1].match(/合计[：:]\s*\*?\*?([\d,]+(?:\.\d+)?)\s*元/);
    if (totalMatch) {
      result.customerPay = parseFloat(totalMatch[1].replace(/,/g, ''));
    }
  }

  // 匹配"给公司的钱"
  const toCompanyMatch = content.match(/给公司的钱[：:]\s*([\d,]+(?:\.\d+)?)\s*元/);
  if (toCompanyMatch) {
    result.toCompany = parseFloat(toCompanyMatch[1].replace(/,/g, ''));
  }

  // 匹配"利润"（可能带加粗）
  // 格式：你的实际利润：4590 - 88 = **4502元**
  const profitMatch = content.match(/(?:实际)?利润[：:]\s*[\d,\s\-+×().]*?\*?\*?([\d,]+(?:\.\d+)?)\s*元/);
  if (profitMatch) {
    result.profit = parseFloat(profitMatch[1].replace(/,/g, ''));
  }

  // 匹配"超额部分"
  const excessMatch = content.match(/超额(?:部分)?[：:]\s*([\d,]+(?:\.\d+)?)\s*元/);
  if (excessMatch) {
    result.excess = parseFloat(excessMatch[1].replace(/,/g, ''));
  }

  // 匹配"额度"
  const quotaMatch = content.match(/额度[：:]\s*([\d,]+(?:\.\d+)?)\s*元/);
  if (quotaMatch) {
    result.quota = parseFloat(quotaMatch[1].replace(/,/g, ''));
  }

  return result;
}

// 从AI回复中提取交易类型
function parseTransactionTypeFromAI(aiResponse) {
  // 优先尝试从<ai-data>标签提取JSON数据
  const aiData = extractAIData(aiResponse);
  if (aiData && aiData.transactionType) {
    return aiData.transactionType; // 'personal' 或 'company'
  }

  // 兜底：使用正则解析（兼容旧版AI回复）
  // 匹配 "**交易类型：**个人交易" 或 "**交易类型：**公司交易"
  const typeMatch = aiResponse.match(/\*\*交易类型[：:]\*\*\s*(个人交易|公司交易)/);
  if (typeMatch) {
    return typeMatch[1] === '个人交易' ? 'personal' : 'company';
  }

  // 兜底：匹配开头的 "好的，让我帮你算一下这笔个人交易" 或 "好的，这是公司交易"
  if (aiResponse.includes('个人交易')) {
    return 'personal';
  } else if (aiResponse.includes('公司交易')) {
    return 'company';
  }

  return null;
}

// 从AI回复中解析货物列表
function parseGoodsFromAIResponse(aiResponse) {
  // 优先尝试从<ai-data>标签提取JSON数据
  const aiData = extractAIData(aiResponse);
  if (aiData && aiData.goods && aiData.goods.length > 0) {
    return aiData.goods.map(item => ({
      name: item.name,
      amount: item.amount
    }));
  }

  // 兜底：使用正则解析（兼容旧版AI回复）
  const goods = [];

  // 匹配 "**货物明细：**" 部分
  // 格式1: "- cf黑金：45000元"
  // 格式2: "- cf黑金：45000元（89折）"
  const goodsSection = aiResponse.match(/\*\*货物明细[：:]\*\*([\s\S]*?)(?=\n\n|$)/);

  if (goodsSection) {
    const lines = goodsSection[1].split('\n');
    for (const line of lines) {
      // 匹配 "- 商品名：金额元" 或 "- 商品名：金额元（折扣）"
      const match = line.match(/-\s*([^：:]+)[：:]\s*([\d,]+(?:\.\d+)?)\s*元/);
      if (match) {
        const name = match[1].trim();
        const amount = parseFloat(match[2].replace(/,/g, ''));
        // 过滤掉"总计"、"合计"等汇总行
        if (amount > 0 && !name.match(/^(总计|合计|小计)$/)) {
          goods.push({ name, amount });
        }
      }
    }
  }

  // 如果货物明细部分没找到，尝试从交易信息中的货物总价部分解析
  // 格式: "货物总价：51800元（cf黑金45000元 + 卡包6800元）"
  if (goods.length === 0) {
    const totalMatch = aiResponse.match(/货物总价[：:]\s*[\d,]+(?:\.\d+)?\s*元[（(]([^)）]+)[)）]/);
    if (totalMatch) {
      const itemsText = totalMatch[1];
      // 匹配 "商品名金额元" 模式
      const itemMatches = itemsText.matchAll(/([^+、，,]+?)([\d,]+(?:\.\d+)?)\s*元/g);
      for (const match of itemMatches) {
        const name = match[1].trim();
        const amount = parseFloat(match[2].replace(/,/g, ''));
        if (amount > 0) {
          goods.push({ name, amount });
        }
      }
    }
  }

  return goods;
}

// 从问题中解析表单信息
function parseFormFromQuestion(question) {
  const info = {
    type: 'company',
    quota: 0,
    price: 0,
    cost: 0
  };

  if (question.includes('个人交易')) {
    info.type = 'personal';
  } else if (question.includes('公司交易')) {
    info.type = 'company';
  }

  // 匹配额度
  const quotaMatch = question.match(/额度\s*([\d,]+\.?\d*)\s*元/);
  if (quotaMatch) {
    info.quota = parseFloat(quotaMatch[1].replace(/,/g, ''));
  }

  // 匹配折扣
  const priceMatch = question.match(/(\d+)折/);
  if (priceMatch) {
    info.price = parseInt(priceMatch[1]) / 100;
  }

  // 匹配成本折扣（个人交易）
  const costMatch = question.match(/成本(\d+)折/);
  if (costMatch) {
    info.cost = parseInt(costMatch[1]) / 100;
  }

  return info;
}

// 从问题中解析商品列表
function parseGoodsFromQuestion(question) {
  const goods = [];

  // 提取"货物明细："或"实际货物"后面的内容
  let goodsSection = '';
  const sectionMatch = question.match(/(?:货物明细|实际货物)[^：:]*[：:](.*?)(?:。|客户|帮我|$)/s);
  if (sectionMatch) {
    goodsSection = sectionMatch[1];
  }

  // 匹配格式：商品名称：金额元
  if (goodsSection) {
    const goodsRegex = /([一-龥_a-zA-Z]+)[：:]\s*([\d,]+\.?\d*)\s*元/g;
    let match;
    while ((match = goodsRegex.exec(goodsSection)) !== null) {
      goods.push({
        name: match[1],
        amount: parseFloat(match[2].replace(/,/g, ''))
      });
    }
  }

  // 如果没找到商品名称，尝试从整个问题中提取（排除额度、成本等关键词）
  if (goods.length === 0) {
    const goodsRegex = /([一-龥_a-zA-Z]+)[：:]\s*([\d,]+\.?\d*)\s*元/g;
    let match;
    while ((match = goodsRegex.exec(question)) !== null) {
      const name = match[1];
      // 排除非商品名称的关键词
      if (!['额度', '成本', '利润', '超额', '客户', '公司', '货物'].includes(name)) {
        goods.push({
          name: name,
          amount: parseFloat(match[2].replace(/,/g, ''))
        });
      }
    }
  }

  return goods;
}

// 打开交易录入模态框
function openTransactionModal(result, formInfo, goodsList) {
  // 切换到交易明细视图
  switchView('transactions');

  // 确保FAB显示
  el.fab.style.display = 'flex';

  // 根据类型切换卖家
  if (formInfo && (formInfo.type === 'company' || formInfo.type === 'personal')) {
    selectSeller(formInfo.type, true);
  }

  // 设置模态框颜色
  const modal = document.getElementById('modal');
  modal.className = 'modal modal--' + currentSeller;

  // 清除表单并打开模态框
  editingId = null;
  el.txnForm.reset();
  selectChannel('quota');
  clearErrors();
  loadOptions();  // 加载货源和品牌名下拉菜单

  // 更新类型指示器
  updateSellerIndicator();

  // 填充数据
  const today = new Date().toISOString().split('T')[0];
  el.inputDate.value = today;

  // 填充商品名称（格式：商品名金额+商品名金额）
  if (goodsList && goodsList.length > 0) {
    const productNames = goodsList.map(g => {
      if (g.name && g.amount) {
        return `${g.name}${g.amount}`;
      } else if (g.name) {
        return g.name;
      } else {
        return `${g.amount}元`;
      }
    }).join('+');
    el.inputProduct.value = productNames;
  }

  // 根据类型填充
  if (formInfo && formInfo.type === 'company') {
    // 公司交易：售价=额度总额，款项去向=给公司的钱
    el.inputPrice.value = formInfo.quota.toFixed(2);
    el.inputCost.value = '0';
    // 给公司的钱填到款项去向和备注
    el.inputAccount.value = `给公司：${result.toCompany.toFixed(2)}元`;
    el.inputNote.value = `AI计算：额度${formInfo.quota}元，给公司${result.toCompany.toFixed(2)}元，客户支付${result.customerPay.toFixed(2)}元`;
  } else {
    // 个人交易：售价=额度总额，成本留空（默认不填）
    el.inputPrice.value = formInfo.quota.toFixed(2);
    el.inputCost.value = '';  // 成本留空

    // 根据实际成本折扣和卖价折扣计算利润率
    if (formInfo.cost && formInfo.price) {
      const profitRate = (formInfo.price - formInfo.cost) * 100;
      el.inputRate.value = profitRate.toFixed(1).replace(/\.0$/, '');
    }

    el.inputNote.value = `AI计算：额度${formInfo.quota}元，利润${result.profit.toFixed(2)}元，客户支付${result.customerPay.toFixed(2)}元`;
  }

  // 打开模态框
  el.modalOverlay.classList.add('modal-overlay--open');
  setTimeout(() => el.inputProduct.focus(), 300);

  // 更新利润预览
  updateProfitPreview();

  showToast('已自动填充交易数据，请确认后保存', 'info');
}

} // end of initApp()
