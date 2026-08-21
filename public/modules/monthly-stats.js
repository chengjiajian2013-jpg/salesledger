// SalesLedger - monthly statistics controller

const BASE_SALARY = 8000;

export function buildMonthRanges(year) {
  return Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1;
    const month = String(monthNumber).padStart(2, '0');
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return {
      year,
      month,
      start: `${year}-${month}-01`,
      end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    };
  });
}

export function createMonthlyStatsController({ api, dom, formatCurrency, showToast, onMonthSelected }) {
  async function loadMonthlyStats() {
    const year = dom.yearFilter.value || new Date().getFullYear();
    const months = buildMonthRanges(Number(year));

    try {
      const results = await Promise.all(months.map(async month => {
        try {
          const [companyRes, personalRes] = await Promise.all([
            api.getSummary({ startDate: month.start, endDate: month.end, seller: 'company' }),
            api.getSummary({ startDate: month.start, endDate: month.end, seller: 'personal' }),
          ]);
          const company = companyRes.data || companyRes;
          const personal = personalRes.data || personalRes;
          return {
            ...month,
            companyProfit: company.totalProfit || 0,
            personalProfit: personal.totalProfit || 0,
            companyCount: company.transactionCount || 0,
            personalCount: personal.transactionCount || 0,
          };
        } catch {
          return {
            ...month,
            companyProfit: 0,
            personalProfit: 0,
            companyCount: 0,
            personalCount: 0,
          };
        }
      }));
      renderMonthlyStats(results.reverse());
    } catch (error) {
      console.error('[MonthlyStats]', error);
      showToast('月度统计加载失败', 'error');
    }
  }

  function renderMonthlyStats(months) {
    if (!months || months.length === 0) {
      dom.monthlyList.innerHTML = '<div class="empty-state"><div class="empty-state__text">暂无数据</div></div>';
      return;
    }

    dom.monthlyList.innerHTML = months.map(month => {
      const companyTotal = month.companyProfit + BASE_SALARY;
      const totalIncome = companyTotal + month.personalProfit;
      const totalCount = month.companyCount + month.personalCount;
      if (totalCount === 0) return '';

      return `
        <div class="monthly-card" data-year="${month.year}" data-month="${month.month}">
          <div class="monthly-card__header">
            <div class="monthly-card__month">${month.year}年${parseInt(month.month)}月</div>
            <div class="monthly-card__count">${totalCount} 笔</div>
          </div>
          <div class="monthly-card__stats">
            <div class="monthly-card__stat">
              <div class="monthly-card__stat-label">公司收入</div>
              <div class="monthly-card__stat-value">${formatCurrency(companyTotal)}</div>
              <div class="monthly-card__stat-detail">底薪¥8,000 + 利润${formatCurrency(month.companyProfit)}</div>
            </div>
            <div class="monthly-card__stat">
              <div class="monthly-card__stat-label">个人收入</div>
              <div class="monthly-card__stat-value">${formatCurrency(month.personalProfit)}</div>
            </div>
            <div class="monthly-card__stat monthly-card__stat--profit">
              <div class="monthly-card__stat-label">总收入</div>
              <div class="monthly-card__stat-value">${formatCurrency(totalIncome)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    dom.monthlyList.querySelectorAll('.monthly-card').forEach(card => {
      card.addEventListener('click', () => {
        onMonthSelected(`${card.dataset.year}-${card.dataset.month}`);
      });
    });
  }

  return { loadMonthlyStats, renderMonthlyStats };
}
