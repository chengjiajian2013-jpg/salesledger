// SalesLedger — 格式化工具

export function formatCurrency(value) {
  const n = Number(value) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n).toFixed(2);
  const [intPart, decPart] = abs.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}¥${grouped}.${decPart}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr + 'T00:00:00Z');
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// 品牌名首字母大写（处理英文单词）
export function capitalizeBrand(brand) {
  if (!brand) return '';
  return brand.trim().split(/\s+/).map(word => {
    // 只处理英文单词（首字母大写，其余小写）
    if (/^[a-zA-Z]/.test(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word; // 中文或其他字符保持不变
  }).join(' ');
}
