-- AI对话功能数据库迁移脚本
-- 添加ai_chats、ai_messages、ai_form_data表

-- AI对话表
CREATE TABLE IF NOT EXISTS ai_chats (
  id              TEXT    PRIMARY KEY,
  title           TEXT    NOT NULL DEFAULT '新对话',
  status          TEXT    NOT NULL DEFAULT 'active',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_chats_updated_at ON ai_chats(updated_at DESC);

-- AI消息表
CREATE TABLE IF NOT EXISTS ai_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id         TEXT    NOT NULL,
  role            TEXT    NOT NULL,
  content         TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (chat_id) REFERENCES ai_chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_chat_id ON ai_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at);

-- AI表单暂存数据表
CREATE TABLE IF NOT EXISTS ai_form_data (
  chat_id         TEXT    PRIMARY KEY,
  type            TEXT    NOT NULL DEFAULT 'personal',
  quota           TEXT    NOT NULL DEFAULT '',
  cost            TEXT    NOT NULL DEFAULT '',
  price           TEXT    NOT NULL DEFAULT '',
  goods           TEXT    NOT NULL DEFAULT '[]',
  input_text      TEXT    NOT NULL DEFAULT '',
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (chat_id) REFERENCES ai_chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_form_data_updated_at ON ai_form_data(updated_at DESC);
