# SalesLedger — Frontend Architecture

> **契约版本**: v1.0
> **关联**: `docs/api-contract.md`, `docs/data-models.md`
> **目标**: iOS Safari/Chrome 优先的个人工具，单文件、零构建、原生 ES。

---

## 1. 技术选型决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 框架 | **无框架**（原生 HTML/CSS/JS） | V1 功能简单，框架是负担 |
| 模块格式 | ES Modules（`<script type="module">`） | 原生支持、无需构建、浏览器缓存友好 |
| 状态管理 | 单一 `appState` 对象 + 发布订阅 | 无外部依赖，够用 |
| 样式 | CSS 变量 Design System | 复用 PersonalOS 的成熟体系 |
| 图标 | Emoji / SVG 内联 | 零依赖、iOS 渲染一致 |
| 网络 | `fetch` + 自封装 `api` 模块 | 原生、无需 axios |
| 持久化 | **无**（服务端 D1 为真值） | 前端不持久化业务数据，仅 UI 状态可选 localStorage |
| 部署 | CF Pages 静态托管 | 与 Workers API 同域 |

---

## 2. 文件结构

```
public/
├── index.html              # 入口（HTML 骨架 + 设计系统 CSS）
├── styles.css              # 业务样式（复用 PersonalOS 设计 token）
├── app.js                  # 应用入口：初始化 + 事件绑定
└── modules/
    ├── api.js              # 后端通信层（fetch 封装）
    ├── state.js            # 状态管理（store + subscribe）
    ├── router.js           # 视图切换（hash 或 data-view）
    ├── format.js           # 格式化（货币、日期）
    ├── validation.js       # 客户端校验（仅 UX）
    └── views/
        ├── home.js         # 首页：统计 + 快捷入口
        ├── list.js         # 交易列表（筛选 + 分页）
        ├── form.js         # 新增/编辑表单
        └── stats.js        # 月度统计详情
```

> **V1 简化**: 可先合并为 `app.js` + `api.js` + `state.js` 三个文件，稳定后再拆 views。

---

## 3. 状态管理

### 3.1 单一状态树

```javascript
// state.js
const state = {
  // 数据
  transactions: [],
  meta: { pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } },
  summary: null,

  // 筛选
  filters: {
    startDate: startOfMonth(today()),
    endDate: today(),
    channel: null,
    keyword: '',
    page: 1,
    pageSize: 20,
    sortBy: 'date',
    sortOrder: 'desc',
  },

  // UI
  ui: {
    loading: false,
    view: 'home',          // 'home' | 'list' | 'stats'
    modal: { open: false, mode: 'create', editingId: null },
    toast: null,
  },
};
```

### 3.2 发布订阅

```javascript
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, deepMerge(state, patch));
  listeners.forEach(fn => fn(state));
}

export function getState() { return state; }
```

**视图层订阅变化 → 重新渲染**。这是最轻量的"响应式"，无需虚拟 DOM。

### 3.3 UI 状态的本地持久化（可选）

仅持久化**用户偏好**，不持久化业务数据：

```javascript
// 记住用户上次的筛选范围
localStorage.setItem('salesledger.filters', JSON.stringify(state.filters));
```

---

## 4. API 通信层

```javascript
// api.js
const BASE = '/api/v1';

async function request(path, { method = 'GET', body, params } = {}) {
  const url = new URL(BASE + path, location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => {
    if (v != null) url.searchParams.set(k, v);
  });

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.code = data?.error?.code;
    err.details = data?.error?.details;
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  listTransactions: (params) => request('/transactions', { params }),
  getTransaction: (id) => request(`/transactions/${id}`),
  createTransaction: (body) => request('/transactions', { method: 'POST', body }),
  updateTransaction: (id, body) => request(`/transactions/${id}`, { method: 'PATCH', body }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
  getSummary: (params) => request('/summary', { params }),
};
```

**关键约定**:
- 所有金额字段传给 API 前**保留数字**（不传格式化字符串）
- 日期字段统一 `YYYY-MM-DD`
- 错误统一抛 `APIError`，视图层 catch 后显示 Toast

---

## 5. 视图层

### 5.1 视图容器

```html
<main id="content">
  <section data-view="home" class="view view--active"><!-- 首页 --></section>
  <section data-view="list" class="view"><!-- 列表 --></section>
  <section data-view="stats" class="view"><!-- 统计 --></section>
</main>
```

### 5.2 视图切换

```javascript
// router.js
export function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('view--active', v.dataset.view === viewName);
  });
  setState({ ui: { view: viewName } });
  // 触发视图 onEnter
  views[viewName]?.onEnter?.();
}
```

### 5.3 视图生命周期

每个视图模块导出：
```javascript
export const homeView = {
  onEnter() { /* 加载数据 + 渲染 */ },
  onLeave() { /* 清理定时器、取消请求 */ },
};
```

---

## 6. iOS 适配要点

### 6.1 Viewport & Safe Area

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no, maximum-scale=1">
```

```css
:root {
  --safe-top: env(safe-area-inset-top);
  --safe-bottom: env(safe-area-inset-bottom);
}

.app {
  height: 100dvh;  /* 动态视口高度，iOS Safari 地址栏变化时自适应 */
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
}
```

### 6.2 触摸友好

```css
/* 最小触控目标 44x44px（Apple HIG）*/
button, .btn, .clickable {
  min-height: 44px;
  min-width: 44px;
  -webkit-tap-highlight-color: transparent;
}

/* 点击反馈 */
.btn:active { transform: scale(0.96); }
```

### 6.3 输入优化

```html
<!-- 数字键盘 -->
<input type="number" inputmode="decimal" pattern="[0-9]*">

<!-- 日期选择 -->
<input type="date">

<!-- 防止缩放 -->
input, select, textarea { font-size: 16px; }  /* <16px iOS 会缩放 */
```

### 6.4 滚动

```css
.content {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;  /* 惯性滚动 */
  scroll-behavior: smooth;
}
```

### 6.5 主题适配

```css
/* 跟随系统 */
@media (prefers-color-scheme: dark) {
  :root { /* 深色 token */ }
}

/* 手动切换（保留 data-theme 属性方案）*/
```

### 6.6 其他 iOS 坑

| 问题 | 解决 |
|------|------|
| `:hover` 残留 | 用 `:active` 或 JS touch 事件 |
| 100vh 溢出 | 用 `100dvh` |
| 输入框被键盘遮挡 | `scrollIntoView` + `position: fixed` 底部栏避免 |
| 双击缩放 | `user-scalable=no` |
| 橡皮筋滚动 | `overscroll-behavior: contain`（列表区域）|

---

## 7. 错误处理与 UX

### 7.1 Toast 系统

```javascript
export function showToast(message, type = 'info', duration = 2000) {
  setState({ ui: { toast: { message, type, id: Date.now() } } });
}
```

### 7.2 错误映射

```javascript
const ERROR_MESSAGES = {
  VALIDATION_ERROR: '输入有误，请检查',
  RESOURCE_NOT_FOUND: '记录不存在',
  INTERNAL_ERROR: '服务异常，请稍后重试',
  NETWORK_ERROR: '网络异常，请检查连接',
};

async function withErrorHandling(fn) {
  try {
    setState({ ui: { loading: true, error: null } });
    return await fn();
  } catch (err) {
    showToast(ERROR_MESSAGES[err.code] || err.message, 'error');
    setState({ ui: { error: err } });
  } finally {
    setState({ ui: { loading: false } });
  }
}
```

### 7.3 加载态

- 全局加载：顶部进度条或居中 spinner
- 局部加载：按钮内 spinner + disabled
- 骨架屏：V1 可不做，V2 再加

---

## 8. 性能基线

| 指标 | 目标 |
|------|------|
| FCP（首次内容绘制） | < 1s（3G） |
| LCP（最大内容绘制） | < 2.5s |
| TTI（可交互） | < 3s |
| 列表滚动 | 60fps |
| 首屏 JS | < 50KB（压缩后） |

**策略**:
- 关键 CSS 内联（首屏），非关键异步
- 单一 HTML 文件 + 拆分 JS modules（HTTP/2 并行）
- 无第三方库
- 图片极少（icon 用 emoji）

---

## 9. 安全基线

| 风险 | 防护 |
|------|------|
| XSS | 所有用户输入渲染前 `escapeHtml` |
| CSRF | 同域部署，SameSite cookie（V1 无 cookie） |
| 数据校验 | **服务端为唯一真值**，客户端校验仅 UX |
| 敏感数据 | V1 单用户无鉴权，V2 加 auth |

---

## 10. 测试策略

| 层级 | 方法 |
|------|------|
| 单元 | Jest（format.js / validation.js）|
| 集成 | Vitest + Miniflare（Worker 本地运行）|
| 手动 | iOS Safari/Chrome 真机走查清单 |
| 契约 | 前后端 schema 对齐测试 |

> **V1 简化**: 手动测试为主，自动化 V2 补。

---

## 11. 后续演进（V2+）

- **PWA**: manifest + service worker 离线可用
- **多设备同步**: D1 已支持，前端加 auth
- **腾讯文档同步**: 后端定时任务写 Excel
- **记账模块**: 独立实体，不与交易混淆
- **todolist**: 独立模块，复用状态管理

---

## 12. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-31 | 初始架构文档 |
