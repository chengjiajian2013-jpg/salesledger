// SalesLedger - transaction data controller

/**
 * Build the transaction data boundary. Rendering and UI navigation are injected
 * so this module can own API/state coordination without importing the app shell.
 */
export function createTransactionController({
  api,
  state,
  setState,
  dom,
  renderSummary,
  renderList,
  showToast,
  closeModal,
  refreshHeaderTotal,
  getSelectedChannel,
  getCurrentSeller,
  getEditingId,
  onRefresh,
  capitalizeBrand,
}) {
  async function loadSummary() {
    try {
      const { startDate, endDate, seller } = state.filters;
      const res = await api.getSummary({ startDate, endDate, seller });
      const data = res.data || res;
      setState({ summary: data });
      renderSummary(data);
      await refreshHeaderTotal();
    } catch (error) {
      console.error('[Summary]', error);
      showToast('统计数据加载失败', 'error');
    }
  }

  async function loadTransactions() {
    setState({ ui: { loading: true } });
    try {
      const res = await api.listTransactions(state.filters);
      const data = res.data || res;
      const pagination = (res.meta && res.meta.pagination)
        || (data.meta && data.meta.pagination)
        || {};
      setState({ transactions: data, meta: { pagination } });
      renderList(data, pagination);
    } catch (error) {
      showToast(error.message || '加载失败', 'error');
    } finally {
      setState({ ui: { loading: false } });
    }
  }

  async function refreshAll() {
    await Promise.all([loadSummary(), loadTransactions()]);
    await refreshHeaderTotal();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const channel = getSelectedChannel();
    const isOther = channel === 'other';

    let profit;
    if (isOther) {
      profit = parseFloat(dom.inputProfit.value) || 0;
      if (profit <= 0) {
        showToast('请填写利润', 'error');
        return;
      }
    } else {
      const price = parseFloat(dom.inputPrice.value) || 0;
      const cost = parseFloat(dom.inputCost.value) || 0;
      const rate = (parseFloat(dom.inputRate.value) || 0) / 100;
      if (price <= 0) {
        showToast('请填写售价', 'error');
        return;
      }
      if ((channel === 'direct' || channel === 'recovery') && cost <= 0) {
        showToast('请填写成本', 'error');
        return;
      }
      profit = Math.round((price - cost) * rate * 100) / 100;
    }

    const body = {
      seller: getCurrentSeller(),
      source: dom.inputSource.value.trim(),
      brand: capitalizeBrand(dom.inputBrand.value),
      date: dom.inputDate.value,
      product: dom.inputProduct.value.trim(),
      channel,
      cost: parseFloat(dom.inputCost.value) || 0,
      price: parseFloat(dom.inputPrice.value) || 0,
      commission_rate: isOther ? 0 : (parseFloat(dom.inputRate.value) || 0) / 100,
      profit,
      account: dom.inputAccount.value.trim(),
      note: dom.inputNote.value.trim(),
    };

    if (!body.date || !body.product) {
      showToast('请填写日期和商品名', 'error');
      return;
    }

    dom.submitBtn.disabled = true;
    try {
      const editingId = getEditingId();
      if (editingId) {
        await api.updateTransaction(editingId, body);
        showToast('已更新 ✓');
      } else {
        await api.createTransaction(body);
        showToast('已记录 ✓');
      }
      closeModal();
      await onRefresh();
    } catch (error) {
      showToast(error.message || '保存失败', 'error');
    } finally {
      dom.submitBtn.disabled = false;
    }
  }

  return { loadSummary, loadTransactions, refreshAll, handleSubmit };
}
