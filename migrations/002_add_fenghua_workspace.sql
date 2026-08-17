CREATE TABLE IF NOT EXISTS fenghua_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount      REAL NOT NULL CHECK (amount > 0),
  category    TEXT NOT NULL,
  date        TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fenghua_entries_date ON fenghua_entries(date DESC);

CREATE TABLE IF NOT EXISTS fenghua_todos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  content       TEXT NOT NULL,
  due_date      TEXT,
  is_completed  INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fenghua_todos_status_due
  ON fenghua_todos(is_completed, due_date);
