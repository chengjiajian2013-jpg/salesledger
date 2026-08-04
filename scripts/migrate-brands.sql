-- 批量更新品牌名首字母大写
-- 执行方式: wrangler d1 execute salesledger-db --remote --file=migrate-brands.sql

-- 常见品牌名标准化（覆盖可能的各种输入格式）
UPDATE transactions SET brand = 'Chanel' WHERE LOWER(brand) = 'chanel';
UPDATE transactions SET brand = 'Dior' WHERE LOWER(brand) = 'dior';
UPDATE transactions SET brand = 'Gucci' WHERE LOWER(brand) = 'gucci';
UPDATE transactions SET brand = 'Hermes' WHERE LOWER(brand) = 'hermes' OR LOWER(brand) = 'hermès';
UPDATE transactions SET brand = 'Prada' WHERE LOWER(brand) = 'prada';
UPDATE transactions SET brand = 'Balenciaga' WHERE LOWER(brand) = 'balenciaga';
UPDATE transactions SET brand = 'Celine' WHERE LOWER(brand) = 'celine' OR LOWER(brand) = 'céline';
UPDATE transactions SET brand = 'Fendi' WHERE LOWER(brand) = 'fendi';
UPDATE transactions SET brand = 'Cartier' WHERE LOWER(brand) = 'cartier';
UPDATE transactions SET brand = 'Burberry' WHERE LOWER(brand) = 'burberry';
UPDATE transactions SET brand = 'Givenchy' WHERE LOWER(brand) = 'givenchy';
UPDATE transactions SET brand = 'Valentino' WHERE LOWER(brand) = 'valentino';
UPDATE transactions SET brand = 'Loewe' WHERE LOWER(brand) = 'loewe';
UPDATE transactions SET brand = 'Bvlgari' WHERE LOWER(brand) = 'bvlgari' OR LOWER(brand) = 'bulgari';
UPDATE transactions SET brand = 'Rolex' WHERE LOWER(brand) = 'rolex';
UPDATE transactions SET brand = 'Omega' WHERE LOWER(brand) = 'omega';

-- 特殊缩写标准化
UPDATE transactions SET brand = 'LV' WHERE brand IN ('lv', 'Lv', 'lV');
UPDATE transactions SET brand = 'YSL' WHERE brand IN ('ysl', 'Ysl', 'ySL', 'ysL');

-- 多单词品牌
UPDATE transactions SET brand = 'Louis Vuitton' WHERE LOWER(brand) = 'louis vuitton' OR LOWER(brand) = 'louisvuitton';
UPDATE transactions SET brand = 'Saint Laurent' WHERE LOWER(brand) = 'saint laurent' OR LOWER(brand) = 'saintlaurent';
UPDATE transactions SET brand = 'Bottega Veneta' WHERE LOWER(brand) = 'bottega veneta' OR LOWER(brand) = 'bottegaveneta';
UPDATE transactions SET brand = 'Tom Ford' WHERE LOWER(brand) = 'tom ford' OR LOWER(brand) = 'tomford';
UPDATE transactions SET brand = 'Marc Jacobs' WHERE LOWER(brand) = 'marc jacobs' OR LOWER(brand) = 'marcjacobs';
UPDATE transactions SET brand = 'Alexander McQueen' WHERE LOWER(brand) = 'alexander mcqueen' OR LOWER(brand) = 'alexandermcqueen';
UPDATE transactions SET brand = 'Tory Burch' WHERE LOWER(brand) = 'tory burch' OR LOWER(brand) = 'toryburch';
UPDATE transactions SET brand = 'Michael Kors' WHERE LOWER(brand) = 'michael kors' OR LOWER(brand) = 'michaelkors';

-- 验证结果
SELECT '=== 更新后的品牌列表 ===' as info;
SELECT DISTINCT brand FROM transactions WHERE brand != '' ORDER BY brand;

SELECT '=== 统计 ===' as info;
SELECT COUNT(*) as total_with_brand FROM transactions WHERE brand != '';
