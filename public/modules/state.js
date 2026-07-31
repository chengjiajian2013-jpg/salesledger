// SalesLedger — 状态管理

const listeners = new Set();

export const state = {
  transactions: [],
  meta: { pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } },
  summary: null,
  filters: defaultFilters(),
  ui: { loading: false, modalOpen: false },
};

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setState(patch) {
  Object.assign(state, deepMerge(state, patch));
  listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
}

export function getState() { return state; }

function deepMerge(target, source) {
  const out = Array.isArray(target) ? [...target] : { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

function defaultFilters() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { startDate: start, endDate: end, seller: 'company', channel: '', keyword: '', page: 1, pageSize: 20, sortBy: 'date', sortOrder: 'desc' };
}
