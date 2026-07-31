// SalesLedger — D1 表结构（Worker 自初始化用）
// 与 schema.sql 保持同步

export const SCHEMA_STATEMENTS = [
  `DROP TABLE IF EXISTS transactions`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    seller          TEXT    NOT NULL DEFAULT 'company',
    date            TEXT    NOT NULL,
    product         TEXT    NOT NULL,
    channel         TEXT    NOT NULL DEFAULT 'other',
    cost            REAL    DEFAULT 0,
    price           REAL    DEFAULT 0,
    commission_rate REAL    NOT NULL DEFAULT 0,
    profit          REAL    NOT NULL,
    note            TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions(seller)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_channel ON transactions(channel)`,
];
