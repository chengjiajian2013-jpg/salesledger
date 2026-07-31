-- SalesLedger — D1 数据库 Schema v2
-- 支持：公司/个人双轨、渠道佣金比例、成本/售价可选

DROP TABLE IF EXISTS transactions;

CREATE TABLE transactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  seller          TEXT    NOT NULL DEFAULT 'company',           -- company | personal
  date            TEXT    NOT NULL,                             -- 'YYYY-MM-DD'
  product         TEXT    NOT NULL,
  channel         TEXT    NOT NULL DEFAULT 'other',             -- quota | direct | recovery | other
  cost            REAL    DEFAULT 0,                            -- 成本（可选）
  price           REAL    DEFAULT 0,                            -- 售价（可选）
  commission_rate REAL    NOT NULL DEFAULT 0,                   -- 实际使用的佣金比例（小数）
  profit          REAL    NOT NULL,                             -- 利润（必填）
  note            TEXT    NOT NULL DEFAULT '',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_seller ON transactions(seller);
CREATE INDEX idx_transactions_channel ON transactions(channel);
