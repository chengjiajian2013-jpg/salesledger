export function summarizeExpenseCategories(entries = [], labels = {}) {
  const totals = new Map();
  for (const entry of entries) {
    if (entry?.type !== 'expense') continue;
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const category = entry.category || 'other';
    totals.set(category, (totals.get(category) || 0) + amount);
  }

  const totalExpense = [...totals.values()].reduce((sum, amount) => sum + amount, 0);
  const categories = [...totals.entries()]
    .map(([id, amount]) => ({
      id,
      label: labels[id] || id,
      amount: Math.round(amount * 100) / 100,
      share: totalExpense ? amount / totalExpense : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label, 'zh-CN'));

  return {
    totalExpense: Math.round(totalExpense * 100) / 100,
    categories,
  };
}
