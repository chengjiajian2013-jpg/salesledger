# SalesLedger — Data Models

> **契约版本**: v1.0
> **关联**: `docs/api-contract.md`
> **原则**: 输入/输出分离，服务端生成字段（id/profit/timestamps）客户端不可写。

---

## 1. 核心实体：Transaction（交易）

### 1.1 持久化模型（D1 表结构）

```sql
CREATE TABLE transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT    NOT NULL,                       -- 'YYYY-MM-DD'
  product     TEXT    NOT NULL,                       -- 商品名
  channel     TEXT    NOT NULL DEFAULT 'other',       -- quota | recovery | direct | other
  cost        REAL    NOT NULL DEFAULT 0,             -- 成本（元，≥0）
  price       REAL    NOT NULL,                       -- 售价（元，>0）
  note        TEXT    NOT NULL DEFAULT '',            -- 备注
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_channel ON transactions(channel);
```

> **设计决策**: `profit` **不作为列存储**，而是查询时 `price - cost` 计算。理由：
> 1. 避免数据冗余和不一致
> 2. 成本事后调整时利润自动更新
> 3. SQLite 表达式索引可兼顾查询性能

### 1.2 输出模型（API 响应）

```typescript
interface Transaction {
  id: number;                 // 服务端生成，自增
  date: string;               // 'YYYY-MM-DD'
  product: string;            // 1-200 字符
  channel: 'quota' | 'recovery' | 'direct' | 'other';
  cost: number;               // 元，2 位小数
  price: number;              // 元，2 位小数
  profit: number;             // 服务端计算 = price - cost
  note: string;               // 可能为空串
  createdAt: string;          // ISO-8601
  updatedAt: string;          // ISO-8601
}
```

### 1.3 创建输入模型

```typescript
interface CreateTransactionInput {
  date: string;               // 必填
  product: string;            // 必填
  channel: 'quota' | 'recovery' | 'direct' | 'other';  // 必填
  cost: number;               // 必填
  price: number;              // 必填
  note?: string;              // 选填
}
```

### 1.4 更新输入模型

```typescript
interface UpdateTransactionInput {
  date?: string;
  product?: string;
  channel?: 'quota' | 'recovery' | 'direct' | 'other';
  cost?: number;
  price?: number;
  note?: string;
}
```

> **关键**: 所有字段可选，未提供的字段保持原值。这是 PATCH 语义。

---

## 2. 枚举定义

### 2.1 Channel（销售渠道）

| 值 | 中文 | 说明 |
|----|------|------|
| `quota` | 额度 | 额度销售 |
| `recovery` | 回收 | 回收再售 |
| `direct` | 直款 | 直款交易 |
| `other` | 其他 | 兜底 |

**客户端行为**: 前端维护 `CHANNEL_OPTIONS` 常量，**不**硬编码显示名。

```javascript
export const CHANNEL_OPTIONS = [
  { value: 'quota', label: '额度', color: '#6B6560' },
  { value: 'recovery', label: '回收', color: '#5A7D5A' },
  { value: 'direct', label: '直款', color: '#5A5D7D' },
  { value: 'other', label: '其他', color: '#9E9891' },
];
```

---

## 3. 校验规则（服务端为唯一真值）

### 3.1 字段级规则

| 字段 | 规则 | 错误码 |
|------|------|--------|
| `date` | 必填 | `REQUIRED` |
| `date` | 合法 ISO 日期 | `INVALID_FORMAT` |
| `date` | ≤ 今天 + 7 天 | `DATE_IN_FUTURE` |
| `product` | 必填 | `REQUIRED` |
| `product` | 长度 1-200 | `LENGTH_OUT_OF_RANGE` |
| `channel` | 必填 | `REQUIRED` |
| `channel` | 在枚举内 | `INVALID_ENUM` |
| `cost` | 必填 | `REQUIRED` |
| `cost` | ≥ 0 | `MIN_VALUE` |
| `cost` | ≤ 9999999 | `MAX_VALUE` |
| `price` | 必填 | `REQUIRED` |
| `price` | > 0 | `MIN_VALUE` |
| `price` | ≤ 9999999 | `MAX_VALUE` |
| `price` | ≥ cost | `PRICE_BELOW_COST` |
| `note` | ≤ 500 | `LENGTH_OUT_OF_RANGE` |

### 3.2 校验响应格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求数据校验失败",
    "details": [
      { "field": "date", "code": "REQUIRED", "message": "日期不能为空" },
      { "field": "price", code": "PRICE_BELOW_COST", "message": "售出价不能低于成本价" }
    ]
  }
}
```

---

## 4. 统计模型

### 4.1 Summary 响应

```typescript
interface Summary {
  period: {
    startDate: string;
    endDate: string;
  };
  totalRevenue: number;        // 总收入（期间内 price 之和）
  totalCost: number;           // 总成本（期间内 cost 之和）
  totalProfit: number;         // 总利润
  transactionCount: number;    // 交易笔数
  averageProfit: number;       // 笔均利润
  byChannel: ChannelSummary[]; // 按渠道聚合
  daily: DailySummary[];       // 按日聚合
}

interface ChannelSummary {
  channel: 'quota' | 'recovery' | 'direct' | 'other';
  revenue: number;
  cost: number;
  profit: number;
  count: number;
}

interface DailySummary {
  date: string;                // 'YYYY-MM-DD'
  revenue: number;
  cost: number;
  profit: number;
  count: number;
}
```

### 4.2 计算规则

- `totalProfit` = Σ(price - cost)
- `averageProfit` = totalProfit / transactionCount（保留 2 位小数，count=0 时为 0）
- `daily` 数组包含期间内**每一天**，无交易的日期 revenue/profit/count 为 0

---

## 5. 前端衍生状态（非持久化）

前端运行时维护的**本地状态**，不来自 API：

```javascript
// 前端应用状态
const appState = {
  transactions: [],            // 当前页数据
  meta: { pagination: {...} }, // 分页信息
  filters: {                   // 当前筛选条件
    startDate: '2026-07-01',
    endDate: '2026-07-31',
    channel: null,
    keyword: '',
  },
  summary: null,               // 聚合统计
  ui: {
    loading: false,
    error: null,
    modalOpen: false,
    editingId: null,
  },
};
```

---

## 6. 不变量（Invariants）

以下约束**永远为真**，任何实现不得违反：

1. `profit` ≡ `price - cost`（精度：分）
2. `price` ≥ `cost` ≥ 0
3. `date` 不超过今天 + 7 天
4. `id` 全局唯一且单调递增
5. `updatedAt` ≥ `createdAt`
6. 删除操作**物理删除**（非软删除），V1 不做审计

---

## 7. 金额处理规则

### 7.1 精度

- 输入：最多接受 2 位小数
- 存储：以`REAL`存储（SQLite），显示时格式化为 2 位小数
- 计算：JS 端使用 `Math.round(value * 100) / 100` 避免浮点误差

### 7.2 显示格式

```javascript
function formatCurrency(value) {
  return '¥' + Number(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
// 1234567.89 → '¥1,234,567.89'
```

---

## 8. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-31 | 初始数据模型 |
