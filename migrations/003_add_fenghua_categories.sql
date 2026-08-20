-- Fenghua custom categories. Non-destructive production migration.
CREATE TABLE IF NOT EXISTS fenghua_categories (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_key TEXT NOT NULL UNIQUE,
  type         TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  name         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (type, name COLLATE NOCASE)
);

CREATE INDEX IF NOT EXISTS idx_fenghua_categories_type
  ON fenghua_categories(type, name COLLATE NOCASE);
