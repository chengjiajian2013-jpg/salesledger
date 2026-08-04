// 批量更新数据库中的品牌名首字母大写
// 使用 wrangler d1 execute 运行

// 首字母大写函数（SQL 版本）
function capitalizeBrand(brand) {
  if (!brand) return '';
  return brand.trim().split(/\s+/).map(word => {
    if (/^[a-zA-Z]/.test(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word;
  }).join(' ');
}

// 获取所有唯一品牌名
const brands = [
  // 示例：需要根据实际数据库内容填写
  'chanel', 'GUCCI', 'louis vuitton', 'hermes', 'dior', 'prada', 'balenciaga', 'celine', 'fendi', 'cartier',
  'burberry', 'saint laurent', 'givenchy', 'valentino', 'bottega veneta', 'loewe', 'ysl', 'lv'
];

// 生成 SQL 更新语句
console.log('-- 批量更新品牌名首字母大写');
console.log('-- 执行方式: wrangler d1 execute salesledger-db --file=migrate-brands.sql\n');

brands.forEach(oldBrand => {
  const newBrand = capitalizeBrand(oldBrand);
  if (oldBrand !== newBrand) {
    console.log(`UPDATE transactions SET brand = '${newBrand}' WHERE brand = '${oldBrand}';`);
  }
});

console.log('\n-- 验证更新');
console.log('SELECT DISTINCT brand FROM transactions WHERE brand != \'\' ORDER BY brand;');
