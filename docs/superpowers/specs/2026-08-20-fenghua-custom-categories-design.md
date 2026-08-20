# 风华记账自定义类目设计

## 决策

采用方案 B：分类选择器的最后一项提供“＋ 新建类目”。用户输入名称并点击“添加”后，新类目立即加入当前收入或支出分类并保持选中，当前记账弹窗不会关闭。

## 数据边界

- 自定义类目存储在独立的 `fenghua_categories` 表中。
- `fenghua_entries.category` 继续使用文本值；预设类目使用现有 key，自定义类目使用 `custom:<id>` 稳定 key。
- 自定义类目按 `income` / `expense` 类型隔离，同名类目可以分别存在于收入和支出中。
- Fenghua 数据不写入 Joeyzou 的 `transactions` 表，也不新增账号或密码。

## API

- `GET /api/v1/fenghua/categories?type=expense|income`：返回该类型的自定义类目。
- `POST /api/v1/fenghua/categories`：创建类目，重复名称返回 `409 CATEGORY_EXISTS`。
- 账目创建和更新会校验 `custom:<id>` 是否存在且类型匹配。

## 约束

- 名称会 trim，长度为 1-32 个字符。
- 名称拒绝 HTML 尖括号和控制字符；前端展示仍使用 HTML 转义。
- 当前版本不提供重命名、删除和图标管理，避免历史账目失去可读名称。

## 统计

月度报表继续按 `category` key 聚合，前端将自定义类目名称加入 labels 映射，因此自定义类目会和预设类目一样参与消费排行。
