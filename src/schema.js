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
];
