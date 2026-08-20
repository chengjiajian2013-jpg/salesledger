import { api } from './api.js';
import { escapeHtml, formatCurrency, todayStr } from './format.js';
import { summarizeExpenseCategories } from './fenghuaReports.js';

const CATEGORY_GROUPS = {
  expense: [
    ['food', '餐饮', '餐'],
    ['transport', '交通', '行'],
    ['shopping', '购物', '购'],
    ['home', '居住', '居'],
    ['medical', '医疗', '医'],
    ['leisure', '休闲', '闲'],
    ['other', '其他', '其'],
  ],
  income: [
    ['salary', '工资', '薪'],
    ['bonus', '奖金', '奖'],
    ['side', '副业', '副'],
    ['gift', '礼金', '礼'],
    ['refund', '退款', '退'],
    ['other', '其他', '其'],
  ],
};
const CATEGORY_CREATE_VALUE = '__create_category__';

let initialized = false;
let activeApp = 'joeyzou';
let activeView = 'ledger';
let month = currentMonth();
let entries = [];
let todos = [];
let todoFilter = 'all';
let editingEntryId = null;
let entriesLoaded = false;
let todosLoaded = false;
let statusTimer = null;
let dialogReturnFocus = null;
let dom;
const customCategories = { expense: [], income: [] };
let categoriesLoaded = false;
let categoryBeforeCreate = '';

export function initFenghuaWorkspace() {
  if (initialized) return;
  initialized = true;
  dom = collectDom();
  dom.month.value = month;
  bindEvents();
  updateMonthCaption();
  setEntryType('expense');
  if (location.pathname === '/fenghua' || location.pathname === '/fenghua/') {
    switchApp('fenghua');
  }
}

function collectDom() {
  const byId = id => document.getElementById(id);
  return {
    app: byId('app'),
    switcher: byId('appSwitcher'),
    switcherTrigger: byId('appSwitcherTrigger'),
    switcherMenu: byId('appSwitcherMenu'),
    switcherLabel: byId('appSwitcherLabel'),
    switcherMark: byId('appSwitcherMark'),
    joeyzouWorkspace: byId('joeyzouWorkspace'),
    fenghuaWorkspace: byId('fenghuaWorkspace'),
    joeyzouControls: byId('joeyzouHeaderControls'),
    fenghuaControls: byId('fenghuaHeaderControls'),
    headerTotal: byId('headerMonthlyTotal'),
    tabs: [...document.querySelectorAll('[data-fenghua-view]')],
    panels: [...document.querySelectorAll('[data-fenghua-panel]')],
    month: byId('fenghuaMonth'),
    monthCaption: byId('fenghuaMonthCaption'),
    prevMonth: byId('fenghuaPrevMonth'),
    nextMonth: byId('fenghuaNextMonth'),
    balance: byId('fenghuaBalance'),
    income: byId('fenghuaIncome'),
    expense: byId('fenghuaExpense'),
    reportInsight: byId('fenghuaReportInsight'),
    reportTotal: byId('fenghuaReportTotal'),
    categoryList: byId('fenghuaCategoryList'),
    entryCount: byId('fenghuaEntryCount'),
    entryList: byId('fenghuaEntryList'),
    fab: byId('fenghuaFab'),
    status: byId('fenghuaStatus'),
    dialog: byId('fenghuaEntryDialog'),
    dialogTitle: byId('fenghuaDialogTitle'),
    dialogClose: byId('fenghuaDialogClose'),
    form: byId('fenghuaEntryForm'),
    formError: byId('fenghuaFormError'),
    typeControl: byId('fenghuaTypeControl'),
    type: byId('fenghuaEntryType'),
    amount: byId('fenghuaEntryAmount'),
    category: byId('fenghuaEntryCategory'),
    categoryCreator: byId('fenghuaCategoryCreator'),
    newCategoryName: byId('fenghuaNewCategoryName'),
    createCategory: byId('fenghuaCreateCategory'),
    date: byId('fenghuaEntryDate'),
    note: byId('fenghuaEntryNote'),
    deleteEntry: byId('fenghuaDeleteEntry'),
    todoForm: byId('fenghuaTodoForm'),
    todoContent: byId('fenghuaTodoContent'),
    todoDate: byId('fenghuaTodoDate'),
    todoFilters: byId('fenghuaTodoFilters'),
    todoList: byId('fenghuaTodoList'),
    todoCount: byId('fenghuaTodoCount'),
    todoSummary: byId('fenghuaTodoSummary'),
  };
}

function bindEvents() {
  dom.switcherTrigger.addEventListener('click', toggleSwitcher);
  dom.switcherMenu.addEventListener('click', event => {
    const option = event.target.closest('[data-app]');
    if (option) switchApp(option.dataset.app);
  });
  document.addEventListener('click', event => {
    if (!dom.switcher.contains(event.target)) closeSwitcher();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dom.switcherTrigger.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      closeSwitcher({ restoreFocus: true });
    }
  });

  dom.tabs.forEach(tab => tab.addEventListener('click', () => switchFenghuaView(tab.dataset.fenghuaView)));
  dom.prevMonth.addEventListener('click', () => shiftMonth(-1));
  dom.nextMonth.addEventListener('click', () => shiftMonth(1));
  dom.month.addEventListener('change', () => {
    if (!dom.month.value) return;
    month = dom.month.value;
    updateMonthCaption();
    loadEntries();
  });

  dom.fab.addEventListener('click', () => openEntryDialog());
  dom.dialogClose.addEventListener('click', closeEntryDialog);
  dom.dialog.addEventListener('click', event => {
    if (event.target === dom.dialog) closeEntryDialog();
  });
  dom.dialog.addEventListener('close', () => {
    dialogReturnFocus?.focus();
    dialogReturnFocus = null;
  });
  dom.typeControl.addEventListener('click', event => {
    const button = event.target.closest('[data-entry-type]');
    if (button) setEntryType(button.dataset.entryType);
  });
  dom.form.addEventListener('submit', saveEntry);
  dom.category.addEventListener('change', handleCategoryChange);
  dom.createCategory.addEventListener('click', createCategory);
  dom.deleteEntry.addEventListener('click', deleteEditingEntry);
  dom.entryList.addEventListener('click', event => {
    const editButton = event.target.closest('[data-edit-entry]');
    const retryButton = event.target.closest('[data-retry-entries]');
    if (editButton) openEntryDialog(Number(editButton.dataset.editEntry));
    if (retryButton) loadEntries();
  });

  dom.todoForm.addEventListener('submit', createTodo);
  dom.todoFilters.addEventListener('click', event => {
    const button = event.target.closest('[data-todo-filter]');
    if (!button) return;
    todoFilter = button.dataset.todoFilter;
    dom.todoFilters.querySelectorAll('[data-todo-filter]').forEach(item => {
      const isActive = item === button;
      item.classList.toggle('fenghua-todo-filter--active', isActive);
      item.setAttribute('aria-pressed', String(isActive));
    });
    renderTodos();
  });
  dom.todoList.addEventListener('click', event => {
    const toggleButton = event.target.closest('[data-toggle-todo]');
    const deleteButton = event.target.closest('[data-delete-todo]');
    const retryButton = event.target.closest('[data-retry-todos]');
    if (toggleButton) toggleTodo(Number(toggleButton.dataset.toggleTodo));
    if (deleteButton) deleteTodo(Number(deleteButton.dataset.deleteTodo));
    if (retryButton) loadTodos();
  });
}

function toggleSwitcher() {
  const isOpen = dom.switcherTrigger.getAttribute('aria-expanded') === 'true';
  dom.switcherTrigger.setAttribute('aria-expanded', String(!isOpen));
  dom.switcherMenu.hidden = isOpen;
  if (!isOpen) dom.switcherMenu.querySelector(`[data-app="${activeApp}"]`)?.focus();
}

function closeSwitcher({ restoreFocus = false } = {}) {
  const wasOpen = dom.switcherTrigger.getAttribute('aria-expanded') === 'true';
  dom.switcherTrigger.setAttribute('aria-expanded', 'false');
  dom.switcherMenu.hidden = true;
  if (restoreFocus && wasOpen) dom.switcherTrigger.focus();
}

async function switchApp(appName) {
  if (!['joeyzou', 'fenghua'].includes(appName)) return;
  activeApp = appName;
  const isFenghua = activeApp === 'fenghua';

  dom.app.classList.toggle('app--fenghua', isFenghua);
  dom.joeyzouWorkspace.hidden = isFenghua;
  dom.fenghuaWorkspace.hidden = !isFenghua;
  dom.joeyzouControls.hidden = isFenghua;
  dom.fenghuaControls.hidden = !isFenghua;
  dom.headerTotal.hidden = isFenghua;
  dom.switcherLabel.textContent = isFenghua ? '风华记账' : 'Joeyzou记账本';
  dom.switcherMark.textContent = isFenghua ? '风' : 'J';
  dom.switcherMenu.querySelectorAll('[data-app]').forEach(option => {
    const isActive = option.dataset.app === appName;
    option.classList.toggle('app-switcher__option--active', isActive);
    option.setAttribute('aria-checked', String(isActive));
  });
  closeSwitcher();
  dom.switcherTrigger.focus();

  if (isFenghua) {
    if (!categoriesLoaded) await loadCategories();
    if (!entriesLoaded) await loadEntries();
    if (!todosLoaded) await loadTodos();
  }
}

function switchFenghuaView(view) {
  activeView = view === 'todos' ? 'todos' : 'ledger';
  dom.tabs.forEach(tab => {
    const isActive = tab.dataset.fenghuaView === activeView;
    tab.classList.toggle('fenghua-tab--active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  dom.panels.forEach(panel => {
    const isActive = panel.dataset.fenghuaPanel === activeView;
    panel.hidden = !isActive;
    panel.classList.toggle('fenghua-view--active', isActive);
  });
  dom.fab.hidden = activeView !== 'ledger';
  if (activeView === 'todos' && !todosLoaded) loadTodos();
}

async function loadEntries() {
  setStatus('正在读取账本…');
  dom.entryList.innerHTML = loadingMarkup('正在读取本月明细');
  dom.reportInsight.textContent = '正在整理类目支出';
  dom.reportTotal.textContent = formatCurrency(0);
  dom.categoryList.innerHTML = reportLoadingMarkup();
  try {
    const response = await api.listFenghuaEntries({ month });
    entries = response.data || [];
    entriesLoaded = true;
    const summary = response.meta?.summary || { income: 0, expense: 0, balance: 0 };
    dom.income.textContent = formatCurrency(summary.income);
    dom.expense.textContent = formatCurrency(summary.expense);
    dom.balance.textContent = formatCurrency(summary.balance);
    dom.entryCount.textContent = `${response.meta?.pagination?.totalItems ?? entries.length} 笔`;
    renderExpenseReport();
    renderEntries();
    setStatus('');
  } catch (error) {
    dom.entryList.innerHTML = errorMarkup('账本暂时无法读取', '请检查网络后重试', 'data-retry-entries');
    dom.reportInsight.textContent = '统计暂时无法读取';
    dom.categoryList.innerHTML = reportEmptyMarkup('请重新加载本月账本');
    setStatus(error.message || '读取账本失败');
  }
}

function renderExpenseReport() {
  const labels = Object.fromEntries([
    ...CATEGORY_GROUPS.expense.map(([id, label]) => [id, label]),
    ...customCategories.expense.map(category => [category.key, category.name]),
  ]);
  const report = summarizeExpenseCategories(entries, labels);
  dom.reportTotal.textContent = formatCurrency(report.totalExpense);

  if (!report.categories.length) {
    dom.reportInsight.textContent = '本月还没有支出记录';
    dom.categoryList.innerHTML = reportEmptyMarkup('记下支出后，这里会显示类目排行');
    return;
  }

  const top = report.categories[0];
  dom.reportInsight.textContent = `${top.label}支出最高，占本月消费 ${formatPercent(top.share)}`;
  dom.categoryList.innerHTML = report.categories.map((category, index) => {
    const percent = formatPercent(category.share);
    return `
      <div class="fenghua-category-row${index === 0 ? ' fenghua-category-row--top' : ''}" role="progressbar" aria-label="${escapeHtml(category.label)} ${formatCurrency(category.amount)}，占比 ${percent}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(category.share * 100)}">
        <div class="fenghua-category-copy">
          <span><i aria-hidden="true">${index + 1}</i>${escapeHtml(category.label)}</span>
          <strong>${formatCurrency(category.amount)} <small>${percent}</small></strong>
        </div>
        <div class="fenghua-category-track" aria-hidden="true"><span style="width: ${Math.max(2, category.share * 100)}%"></span></div>
      </div>`;
  }).join('');
}

function renderEntries() {
  if (!entries.length) {
    dom.entryList.innerHTML = emptyMarkup('这个月还没有账目', '点击右下角加号，记下第一笔收支');
    return;
  }

  const groups = entries.reduce((map, entry) => {
    if (!map.has(entry.date)) map.set(entry.date, []);
    map.get(entry.date).push(entry);
    return map;
  }, new Map());

  dom.entryList.innerHTML = [...groups.entries()].map(([date, dayEntries]) => {
    const net = dayEntries.reduce((total, entry) => total + (entry.type === 'income' ? entry.amount : -entry.amount), 0);
    return `
      <section class="fenghua-date-group">
        <div class="fenghua-date-heading"><span>${formatLedgerDate(date)}</span><span>当日 ${formatCurrency(net)}</span></div>
        ${dayEntries.map(entryMarkup).join('')}
      </section>`;
  }).join('');
}

function entryMarkup(entry) {
  const category = categoryMeta(entry.type, entry.category);
  const displayTitle = entry.note || category.label;
  const sign = entry.type === 'income' ? '+' : '-';
  return `
    <article class="fenghua-entry-row fenghua-entry-row--${entry.type}">
      <span class="fenghua-entry-mark" aria-hidden="true">${category.mark}</span>
      <div class="fenghua-entry-copy"><strong>${escapeHtml(displayTitle)}</strong><span>${escapeHtml(category.label)}</span></div>
      <span class="fenghua-entry-amount">${sign}${formatCurrency(entry.amount)}</span>
      <button class="fenghua-row-action" type="button" data-edit-entry="${entry.id}" aria-label="编辑账目" title="编辑账目">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
      </button>
    </article>`;
}

function openEntryDialog(entryId = null) {
  editingEntryId = entryId;
  const entry = entries.find(item => item.id === entryId);
  dialogReturnFocus = document.activeElement;
  dom.form.reset();
  dom.formError.textContent = '';
  dom.dialogTitle.textContent = entry ? '编辑账目' : '记一笔';
  dom.deleteEntry.hidden = !entry;
  setEntryType(entry?.type || 'expense');
  dom.amount.value = entry?.amount ?? '';
  dom.category.value = entry?.category || CATEGORY_GROUPS[dom.type.value][0][0];
  categoryBeforeCreate = dom.category.value;
  hideCategoryCreator();
  dom.date.value = entry?.date || todayStr();
  dom.note.value = entry?.note || '';
  dom.dialog.showModal();
  requestAnimationFrame(() => dom.amount.focus());
}

function closeEntryDialog() {
  if (dom.dialog.open) dom.dialog.close();
}

function setEntryType(type) {
  const safeType = type === 'income' ? 'income' : 'expense';
  dom.type.value = safeType;
  dom.typeControl.querySelectorAll('[data-entry-type]').forEach(button => {
    const isActive = button.dataset.entryType === safeType;
    button.classList.toggle('fenghua-type-button--active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  const options = CATEGORY_GROUPS[safeType]
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .concat(customCategories[safeType].map(category => `<option value="${escapeHtml(category.key)}">${escapeHtml(category.name)}</option>`))
    .concat(`<option value="${CATEGORY_CREATE_VALUE}">＋ 新建类目</option>`);
  dom.category.innerHTML = options.join('');
  hideCategoryCreator();
}

async function loadCategories() {
  try {
    const response = await api.listFenghuaCategories();
    customCategories.expense = (response.data || []).filter(category => category.type === 'expense');
    customCategories.income = (response.data || []).filter(category => category.type === 'income');
    categoriesLoaded = true;
    setEntryType(dom.type.value || 'expense');
  } catch (error) {
    setStatus(error.message || '自定义类目暂时无法读取');
  }
}

function handleCategoryChange() {
  if (dom.category.value !== CATEGORY_CREATE_VALUE) {
    categoryBeforeCreate = dom.category.value;
    hideCategoryCreator();
    return;
  }
  if (!categoryBeforeCreate || categoryBeforeCreate === CATEGORY_CREATE_VALUE) {
    categoryBeforeCreate = CATEGORY_GROUPS[dom.type.value][0][0];
  }
  dom.category.value = categoryBeforeCreate;
  dom.categoryCreator.hidden = false;
  dom.newCategoryName.value = '';
  dom.newCategoryName.focus();
}

function hideCategoryCreator() {
  if (!dom?.categoryCreator) return;
  dom.categoryCreator.hidden = true;
  if (dom.newCategoryName) dom.newCategoryName.value = '';
}

async function createCategory() {
  const name = dom.newCategoryName.value.trim();
  if (!name) {
    dom.formError.textContent = '请输入新类目名称';
    dom.newCategoryName.focus();
    return;
  }
  dom.formError.textContent = '';
  dom.createCategory.disabled = true;
  try {
    const response = await api.createFenghuaCategory({ type: dom.type.value, name });
    const category = response.data;
    customCategories[dom.type.value].push(category);
    setEntryType(dom.type.value);
    dom.category.value = category.key;
    categoryBeforeCreate = category.key;
    hideCategoryCreator();
    setStatus(`已添加类目“${category.name}”`);
  } catch (error) {
    dom.formError.textContent = error.details?.[0]?.message || error.message || '新建类目失败，请重试';
  } finally {
    dom.createCategory.disabled = false;
  }
}

async function saveEntry(event) {
  event.preventDefault();
  dom.formError.textContent = '';
  const payload = {
    type: dom.type.value,
    amount: Number(dom.amount.value),
    category: dom.category.value,
    date: dom.date.value,
    note: dom.note.value.trim(),
  };

  try {
    if (editingEntryId) await api.updateFenghuaEntry(editingEntryId, payload);
    else await api.createFenghuaEntry(payload);
    closeEntryDialog();
    await loadEntries();
    setStatus(editingEntryId ? '账目已更新' : '账目已保存');
  } catch (error) {
    dom.formError.textContent = error.details?.[0]?.message || error.message || '保存失败，请重试';
  }
}

async function deleteEditingEntry() {
  if (!editingEntryId || !window.confirm('确定删除这笔账目吗？')) return;
  try {
    await api.deleteFenghuaEntry(editingEntryId);
    closeEntryDialog();
    await loadEntries();
    setStatus('账目已删除');
  } catch (error) {
    dom.formError.textContent = error.message || '删除失败，请重试';
  }
}

async function loadTodos() {
  setStatus('正在读取待办…');
  dom.todoList.innerHTML = loadingMarkup('正在读取待办事项');
  try {
    const response = await api.listFenghuaTodos();
    todos = response.data || [];
    todosLoaded = true;
    renderTodos();
    setStatus('');
  } catch (error) {
    dom.todoList.innerHTML = errorMarkup('待办暂时无法读取', '请检查网络后重试', 'data-retry-todos');
    setStatus(error.message || '读取待办失败');
  }
}

function renderTodos() {
  const pendingCount = todos.filter(todo => !todo.isCompleted).length;
  dom.todoCount.textContent = String(pendingCount);
  dom.todoSummary.textContent = pendingCount ? `还有 ${pendingCount} 件事等待完成` : '今天的事情都处理好了';

  const filtered = todos.filter(todo => {
    if (todoFilter === 'pending') return !todo.isCompleted;
    if (todoFilter === 'completed') return todo.isCompleted;
    return true;
  });

  if (!filtered.length) {
    const title = todos.length ? '这里暂时没有事项' : '待办清单还是空的';
    const detail = todos.length ? '换一个筛选条件看看' : '写下下一件要完成的事';
    dom.todoList.innerHTML = emptyMarkup(title, detail);
    return;
  }

  dom.todoList.innerHTML = filtered.map(todoMarkup).join('');
}

function todoMarkup(todo) {
  const isOverdue = !todo.isCompleted && todo.dueDate && todo.dueDate < todayStr();
  const classes = [
    'fenghua-todo-row',
    todo.isCompleted ? 'fenghua-todo-row--completed' : '',
    isOverdue ? 'fenghua-todo-row--overdue' : '',
  ].filter(Boolean).join(' ');
  const dueLabel = todo.dueDate ? `${isOverdue ? '已逾期 · ' : ''}${formatLedgerDate(todo.dueDate)}` : '未设置截止日期';
  return `
    <article class="${classes}">
      <button class="fenghua-todo-check${todo.isCompleted ? ' fenghua-todo-check--completed' : ''}" type="button" data-toggle-todo="${todo.id}" aria-label="${todo.isCompleted ? '标记为未完成' : '标记为已完成'}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>
      </button>
      <div class="fenghua-todo-copy"><strong>${escapeHtml(todo.content)}</strong><span>${dueLabel}</span></div>
      <button class="fenghua-row-action" type="button" data-delete-todo="${todo.id}" aria-label="删除待办" title="删除待办">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>
      </button>
    </article>`;
}

async function createTodo(event) {
  event.preventDefault();
  const content = dom.todoContent.value.trim();
  if (!content) {
    dom.todoContent.focus();
    setStatus('请输入待办事项');
    return;
  }
  try {
    await api.createFenghuaTodo({ content, dueDate: dom.todoDate.value || null });
    dom.todoForm.reset();
    await loadTodos();
    setStatus('待办已添加');
  } catch (error) {
    setStatus(error.details?.[0]?.message || error.message || '添加失败，请重试');
  }
}

async function toggleTodo(id) {
  const todo = todos.find(item => item.id === id);
  if (!todo) return;
  try {
    await api.updateFenghuaTodo(id, { isCompleted: !todo.isCompleted });
    await loadTodos();
    setStatus(todo.isCompleted ? '已恢复为待完成' : '一件事已完成');
  } catch (error) {
    setStatus(error.message || '更新失败，请重试');
  }
}

async function deleteTodo(id) {
  const todo = todos.find(item => item.id === id);
  if (!todo || !window.confirm(`确定删除“${todo.content}”吗？`)) return;
  try {
    await api.deleteFenghuaTodo(id);
    await loadTodos();
    setStatus('待办已删除');
  } catch (error) {
    setStatus(error.message || '删除失败，请重试');
  }
}

function shiftMonth(delta) {
  const [year, monthNumber] = month.split('-').map(Number);
  const shifted = new Date(year, monthNumber - 1 + delta, 1);
  month = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
  dom.month.value = month;
  updateMonthCaption();
  loadEntries();
}

function updateMonthCaption() {
  const [year, monthNumber] = month.split('-').map(Number);
  dom.monthCaption.textContent = `${year} 年 ${monthNumber} 月 · 把每一笔日常，都记得清楚`;
}

function categoryMeta(type, value) {
  const match = CATEGORY_GROUPS[type]?.find(([id]) => id === value);
  if (match) return { label: match[1], mark: match[2] };
  const custom = customCategories[type]?.find(category => category.key === value);
  return custom ? { label: custom.name, mark: custom.name.slice(0, 1) } : { label: '其他', mark: '其' };
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatLedgerDate(value) {
  const [year, monthNumber, day] = value.split('-').map(Number);
  const date = new Date(year, monthNumber - 1, day);
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  return `${monthNumber}月${day}日 · ${weekday}`;
}

function formatPercent(value) {
  const percent = Math.round((Number(value) || 0) * 1000) / 10;
  return `${percent.toLocaleString('zh-CN', { maximumFractionDigits: 1 })}%`;
}

function setStatus(message) {
  window.clearTimeout(statusTimer);
  dom.status.textContent = message;
  if (message && !message.startsWith('正在')) {
    statusTimer = window.setTimeout(() => {
      dom.status.textContent = '';
    }, 2400);
  }
}

function loadingMarkup(message) {
  return `<div class="fenghua-empty" role="status"><strong>${message}</strong></div>`;
}

function reportLoadingMarkup() {
  return `
    <div class="fenghua-category-row" role="progressbar" aria-label="正在加载消费类目" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
      <div class="fenghua-category-track"><span style="width: 0%"></span></div>
    </div>`;
}

function reportEmptyMarkup(message) {
  return `<div class="fenghua-report-empty" role="status">${message}</div>`;
}

function emptyMarkup(title, detail) {
  return `
    <div class="fenghua-empty">
      <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 8h28v32H10zM16 16h16M16 23h16M16 30h10"/></svg>
      <strong>${title}</strong><p>${detail}</p>
    </div>`;
}

function errorMarkup(title, detail, retryAttribute) {
  return `
    <div class="fenghua-error" role="alert">
      <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="18"/><path d="M24 15v11M24 33h.01"/></svg>
      <strong>${title}</strong><p>${detail}</p><button type="button" ${retryAttribute}>重新加载</button>
    </div>`;
}
