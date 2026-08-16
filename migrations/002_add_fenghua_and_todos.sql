-- 风华记账交易表
CREATE TABLE IF NOT EXISTS fenghua_transactions (
  id              TEXT    PRIMARY KEY,
  type            TEXT    NOT NULL,           -- expense | income
  amount          REAL    NOT NULL,           -- 金额
  category        TEXT    NOT NULL,           -- 分类
  title           TEXT    NOT NULL,           -- 备注/标题
  date            TEXT    NOT NULL,           -- YYYY-MM-DD
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fenghua_date ON fenghua_transactions(date);
CREATE INDEX IF NOT EXISTS idx_fenghua_type ON fenghua_transactions(type);
CREATE INDEX IF NOT EXISTS idx_fenghua_category ON fenghua_transactions(category);

-- 待办事项表
CREATE TABLE IF NOT EXISTS todos (
  id              TEXT    PRIMARY KEY,
  text            TEXT    NOT NULL,           -- 待办内容
  completed       INTEGER NOT NULL DEFAULT 0,  -- 0=未完成, 1=已完成
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
