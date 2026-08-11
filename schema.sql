-- SalesLedger — D1 数据库 Schema v2
-- 支持：公司/个人双轨、渠道佣金比例、成本/售价可选

DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS ai_chats;
DROP TABLE IF EXISTS ai_messages;
DROP TABLE IF EXISTS ai_form_data;

CREATE TABLE transactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  seller          TEXT    NOT NULL DEFAULT 'company',           -- company | personal
  source          TEXT    NOT NULL DEFAULT '',                   -- 货源（公司固定苏苏，个人可填）
  brand           TEXT    NOT NULL DEFAULT '',                   -- 品牌名（可选）
  date            TEXT    NOT NULL,                             -- 'YYYY-MM-DD'
  product         TEXT    NOT NULL,
  channel         TEXT    NOT NULL DEFAULT 'other',             -- quota | direct | recovery | other
  cost            REAL    DEFAULT 0,                            -- 成本（可选）
  price           REAL    DEFAULT 0,                            -- 售价（可选）
  commission_rate REAL    NOT NULL DEFAULT 0,                   -- 实际使用的佣金比例（小数）
  profit          REAL    NOT NULL,                             -- 利润（必填）
  account         TEXT    NOT NULL DEFAULT '',                   -- 到账账户（公司对账用）
  note            TEXT    NOT NULL DEFAULT '',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_seller ON transactions(seller);
CREATE INDEX idx_transactions_channel ON transactions(channel);

-- AI对话表
CREATE TABLE ai_chats (
  id              TEXT    PRIMARY KEY,                          -- 对话ID
  title           TEXT    NOT NULL DEFAULT '新对话',
  status          TEXT    NOT NULL DEFAULT 'active',           -- active | closed
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ai_chats_updated_at ON ai_chats(updated_at DESC);

-- AI消息表
CREATE TABLE ai_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id         TEXT    NOT NULL,                            -- 关联ai_chats.id
  role            TEXT    NOT NULL,                            -- user | assistant
  content         TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (chat_id) REFERENCES ai_chats(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_messages_chat_id ON ai_messages(chat_id);
CREATE INDEX idx_ai_messages_created_at ON ai_messages(created_at);

-- AI表单暂存数据表
CREATE TABLE ai_form_data (
  chat_id         TEXT    PRIMARY KEY,                         -- 关联ai_chats.id
  type            TEXT    NOT NULL DEFAULT 'personal',         -- company | personal
  quota           TEXT    NOT NULL DEFAULT '',
  cost            TEXT    NOT NULL DEFAULT '',
  price           TEXT    NOT NULL DEFAULT '',
  goods           TEXT    NOT NULL DEFAULT '[]',               -- JSON数组：[{name, amount}]
  input_text      TEXT    NOT NULL DEFAULT '',
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (chat_id) REFERENCES ai_chats(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_form_data_updated_at ON ai_form_data(updated_at DESC);
