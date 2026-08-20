// SalesLedger — D1 表结构（Worker 自初始化用）
// 与 schema.sql 保持同步

export const SCHEMA_STATEMENTS = [
  // 主表（保留数据，IF NOT EXISTS）
  `CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    seller          TEXT    NOT NULL DEFAULT 'company',
    source          TEXT    NOT NULL DEFAULT '',                   -- 货源（公司固定苏苏，个人可填）
    brand           TEXT    NOT NULL DEFAULT '',                   -- 品牌名（可选）
    date            TEXT    NOT NULL,
    product         TEXT    NOT NULL,
    channel         TEXT    NOT NULL DEFAULT 'other',
    cost            REAL    DEFAULT 0,
    price           REAL    DEFAULT 0,
    commission_rate REAL    NOT NULL DEFAULT 0,
    profit          REAL    NOT NULL,
    account         TEXT    NOT NULL DEFAULT '',
    note            TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  // 迁移：旧表无 account 列时添加（已存在则忽略）
  `ALTER TABLE transactions ADD COLUMN account TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE transactions ADD COLUMN brand TEXT NOT NULL DEFAULT ''`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_channel ON transactions(channel)`,

  // 风华自定义类目：与 Joeyzou 交易和 Fenghua 账目都独立
  `CREATE TABLE IF NOT EXISTS fenghua_categories (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    category_key TEXT NOT NULL UNIQUE,
    type         TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    name         TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (type, name COLLATE NOCASE)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fenghua_categories_type ON fenghua_categories(type, name COLLATE NOCASE)`,

  // 风华记账：普通个人收支，与销售交易完全隔离
  `CREATE TABLE IF NOT EXISTS fenghua_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount      REAL NOT NULL CHECK (amount > 0),
    category    TEXT NOT NULL,
    date        TEXT NOT NULL,
    note        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fenghua_entries_date ON fenghua_entries(date DESC)`,

  // 风华待办：轻量任务，不包含提醒、优先级或重复规则
  `CREATE TABLE IF NOT EXISTS fenghua_todos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    content       TEXT NOT NULL,
    due_date      TEXT,
    is_completed  INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fenghua_todos_status_due ON fenghua_todos(is_completed, due_date)`,

  // AI对话表
  `CREATE TABLE IF NOT EXISTS ai_chats (
    id              TEXT    PRIMARY KEY,
    title           TEXT    NOT NULL DEFAULT '新对话',
    status          TEXT    NOT NULL DEFAULT 'active',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_chats_updated_at ON ai_chats(updated_at DESC)`,

  // AI消息表
  `CREATE TABLE IF NOT EXISTS ai_messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id         TEXT    NOT NULL,
    role            TEXT    NOT NULL,
    content         TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_messages_chat_id ON ai_messages(chat_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at)`,

  // AI表单暂存数据表
  `CREATE TABLE IF NOT EXISTS ai_form_data (
    chat_id         TEXT    PRIMARY KEY,
    type            TEXT    NOT NULL DEFAULT 'personal',
    quota           TEXT    NOT NULL DEFAULT '',
    cost            TEXT    NOT NULL DEFAULT '',
    price           TEXT    NOT NULL DEFAULT '',
    goods           TEXT    NOT NULL DEFAULT '[]',
    input_text      TEXT    NOT NULL DEFAULT '',
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_form_data_updated_at ON ai_form_data(updated_at DESC)`,
];
