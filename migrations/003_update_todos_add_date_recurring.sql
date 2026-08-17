-- 为待办事项表添加日期和重复功能
ALTER TABLE todos ADD COLUMN due_date TEXT;
ALTER TABLE todos ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_recurring ON todos(is_recurring);
