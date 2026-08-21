// SalesLedger - Joeyzou view router

const VIEW_NAMES = new Set(['transactions', 'monthly', 'ai']);

/**
 * Create a small, callback-based router for the core workspace views.
 * It owns visibility only; loading data remains with the caller.
 */
export function createViewRouter({ dom, onTransactions, onMonthly, onAI }) {
  if (!dom || !dom.viewTabs) {
    throw new TypeError('createViewRouter requires view tab DOM nodes');
  }

  const callbacks = {
    transactions: onTransactions,
    monthly: onMonthly,
    ai: onAI,
  };
  let currentView = 'transactions';

  function switchView(view) {
    if (!VIEW_NAMES.has(view)) return false;
    currentView = view;

    dom.viewTabs.querySelectorAll('.view-tab').forEach(btn => {
      btn.classList.toggle('view-tab--active', btn.dataset.view === view);
    });

    const isTransactions = view === 'transactions';
    const isMonthly = view === 'monthly';
    dom.sellerTabs.style.display = isTransactions ? 'flex' : 'none';
    dom.statsGrid.style.display = isTransactions ? 'grid' : 'none';
    dom.transactionsView.style.display = isTransactions ? 'block' : 'none';
    dom.monthlyView.style.display = isMonthly ? 'block' : 'none';
    dom.aiView.style.display = view === 'ai' ? 'block' : 'none';
    dom.fab.style.display = view === 'ai' ? 'none' : 'flex';

    callbacks[view]?.();
    return true;
  }

  return {
    switchView,
    getCurrentView: () => currentView,
  };
}
