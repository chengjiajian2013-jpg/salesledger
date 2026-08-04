-- 更新生产数据库中的小写英文品牌名为首字母大写
-- 只更新确认存在的小写品牌

UPDATE transactions SET brand = 'Chanel' WHERE brand = 'chanel';
UPDATE transactions SET brand = 'Dior' WHERE brand = 'dior';
UPDATE transactions SET brand = 'Fendi' WHERE brand = 'fendi';

-- 验证更新结果
SELECT 'Updated brands:' as info;
SELECT brand, COUNT(*) as count
FROM transactions
WHERE brand IN ('Chanel', 'Dior', 'Fendi')
GROUP BY brand
ORDER BY brand;
