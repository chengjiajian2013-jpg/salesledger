-- 测试数据：涵盖各种场景

-- 公司交易 - 直款渠道
INSERT INTO transactions (seller, source, brand, date, product, channel, cost, price, commission_rate, profit, account, note) VALUES
('company', '苏苏', 'LV', '2026-08-01', 'LV 经典老花手提包', 'direct', 15000, 22000, 0.10, 700, '老大卖老大转', '测试数据'),
('company', '小王', 'Gucci', '2026-08-02', 'Gucci 酒神包', 'direct', 12000, 18000, 0.10, 600, '老大卖老大转', ''),
('company', '苏苏', 'Dior', '2026-08-03', 'Dior 戴妃包', 'direct', 25000, 35000, 0.10, 1000, '老大卖老大转', '');

-- 公司交易 - 额度渠道
INSERT INTO transactions (seller, source, brand, date, product, channel, cost, price, commission_rate, profit, account, note) VALUES
('company', '苏苏', 'Chanel', '2026-08-04', 'Chanel CF 小羊皮', 'quota', 0, 45000, 0.08, 3600, '思扬转', ''),
('company', '小王', 'Hermès', '2026-08-05', 'Hermès Birkin 30', 'quota', 0, 120000, 0.08, 9600, '思扬转', 'VIP客户');

-- 公司交易 - 回收渠道
INSERT INTO transactions (seller, source, brand, date, product, channel, cost, price, commission_rate, profit, account, note) VALUES
('company', '苏苏', 'LV', '2026-08-06', 'LV 老花钱包', 'recovery', 2000, 3500, 0.40, 600, '老大卖老大转', ''),
('company', '苏苏', 'Gucci', '2026-08-07', 'Gucci 腰带', 'recovery', 1500, 2800, 0.40, 520, '老大卖老大转', '');

-- 公司交易 - 其他渠道
INSERT INTO transactions (seller, source, brand, date, product, channel, cost, price, commission_rate, profit, account, note) VALUES
('company', '小王', 'Prada', '2026-08-08', 'Prada 尼龙包', 'other', 0, 0, 0, 500, '老大卖老大转', '直接填利润');

-- 个人交易 - 直款
INSERT INTO transactions (seller, source, brand, date, product, channel, cost, price, commission_rate, profit) VALUES
('personal', '自己', 'LV', '2026-08-09', 'LV 围巾', 'direct', 2000, 3500, 0.10, 150),
('personal', '自己', 'Gucci', '2026-08-10', 'Gucci 钱包', 'direct', 3000, 5000, 0.10, 200);

-- 个人交易 - 额度
INSERT INTO transactions (seller, source, brand, date, product, channel, cost, price, commission_rate, profit) VALUES
('personal', '自己', 'Dior', '2026-08-11', 'Dior 鞋子', 'quota', 0, 8000, 0.08, 640),
('personal', '自己', 'Chanel', '2026-08-12', 'Chanel 耳环', 'quota', 0, 6000, 0.08, 480);

-- 个人交易 - 回收
INSERT INTO transactions (seller, source, brand, date, product, channel, cost, price, commission_rate, profit) VALUES
('personal', '自己', 'LV', '2026-08-13', 'LV 手环', 'recovery', 800, 1500, 0.40, 280),
('personal', '自己', 'Hermès', '2026-08-14', 'Hermès 手链', 'recovery', 3000, 5000, 0.40, 800);

-- 不同月份的数据（用于月度统计测试）
INSERT INTO transactions (seller, source, brand, date, product, channel, cost, price, commission_rate, profit, account) VALUES
('company', '苏苏', 'LV', '2026-07-15', 'LV 7月测试数据', 'direct', 10000, 15000, 0.10, 500, '老大卖老大转'),
('company', '小王', 'Gucci', '2026-07-20', 'Gucci 7月测试数据', 'quota', 0, 20000, 0.08, 1600, '思扬转'),
('personal', '自己', 'Dior', '2026-07-25', 'Dior 7月测试数据', 'direct', 5000, 8000, 0.10, 300, ''),
('company', '苏苏', 'Chanel', '2026-06-10', 'Chanel 6月测试数据', 'direct', 20000, 30000, 0.10, 1000, '老大卖老大转'),
('personal', '自己', 'Hermès', '2026-06-20', 'Hermès 6月测试数据', 'quota', 0, 50000, 0.08, 4000, '');
