// 紫微斗数视图控制器
import { getDailyFortune, getZiweiUsers } from './ziweiApi.js';

let currentUser = 'joey';

/**
 * 初始化紫微斗数视图
 */
export function initZiweiView() {
  const userBtns = document.querySelectorAll('.ziwei-user-btn');
  const chartBtn = document.getElementById('ziweiChartBtn');

  // 用户切换
  userBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.user;
      selectUser(userId);
    });
  });

  // 查看完整命盘（暂未实现）
  chartBtn.addEventListener('click', () => {
    alert('完整命盘功能开发中...');
  });
}

/**
 * 加载紫微斗数视图
 */
export async function loadZiweiView() {
  // 显示今日日期
  updateTodayDate();

  // 加载当前用户运势
  await loadUserFortune(currentUser);
}

/**
 * 切换用户
 */
function selectUser(userId) {
  currentUser = userId;

  // 更新按钮状态
  document.querySelectorAll('.ziwei-user-btn').forEach(btn => {
    btn.classList.toggle('ziwei-user-btn--active', btn.dataset.user === userId);
  });

  // 重新加载运势
  loadUserFortune(userId);
}

/**
 * 更新今日日期显示
 */
function updateTodayDate() {
  const today = new Date();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 ${weekdays[today.getDay()]}`;

  document.getElementById('ziweiToday').textContent = dateStr;
}

/**
 * 加载用户运势
 */
async function loadUserFortune(userId) {
  const card = document.getElementById('ziweiFortuneCard');
  card.innerHTML = '<div class="ziwei-loading">计算中...</div>';

  try {
    const data = await getDailyFortune(userId);

    // 使用 iztro 计算运势
    const fortune = calculateFortune(data);

    // 渲染运势卡片
    renderFortune(fortune);
  } catch (error) {
    console.error('[Ziwei Error]', error);
    card.innerHTML = '<div class="ziwei-loading" style="color:var(--danger);">加载失败，请稍后重试</div>';
  }
}

/**
 * 使用 iztro 计算运势
 */
function calculateFortune(data) {
  const { birthInfo, today } = data;

  // 使用 iztro 排盘
  const astrolabe = window.iztro.astro.bySolar(
    birthInfo.date,
    birthInfo.time,
    birthInfo.gender,
    true, // fixLeap
    'zh-CN'
  );

  // 获取流年运势
  const todayDate = new Date(today);
  const yearChart = astrolabe.horoscope(todayDate.getFullYear(), todayDate.getMonth() + 1);

  // 分析运势（简化版）
  return {
    user: data.user,
    date: today,
    career: analyzeCareerLuck(yearChart),
    wealth: analyzeWealthLuck(yearChart),
    relationship: analyzeRelationshipLuck(yearChart),
    health: analyzeHealthLuck(yearChart),
    suggestions: generateSuggestions(yearChart),
  };
}

/**
 * 分析事业运
 */
function analyzeCareerLuck(chart) {
  // TODO: 实现更复杂的分析逻辑
  const score = Math.floor(Math.random() * 2) + 3; // 3-4星
  return {
    score,
    text: '事业运势平稳，适合推进已有项目',
  };
}

/**
 * 分析财运
 */
function analyzeWealthLuck(chart) {
  const score = Math.floor(Math.random() * 2) + 4; // 4-5星
  return {
    score,
    text: '财运较佳，可关注投资机会',
  };
}

/**
 * 分析感情运
 */
function analyzeRelationshipLuck(chart) {
  const score = Math.floor(Math.random() * 2) + 3; // 3-4星
  return {
    score,
    text: '感情运势平稳，注意沟通交流',
  };
}

/**
 * 分析健康运
 */
function analyzeHealthLuck(chart) {
  const score = 4;
  return {
    score,
    text: '健康状况良好，注意作息规律',
  };
}

/**
 * 生成今日建议
 */
function generateSuggestions(chart) {
  return [
    '适合处理财务相关事项',
    '午时运势较佳，重要决策可在此时进行',
    '注意人际关系的维护',
  ];
}

/**
 * 渲染运势卡片
 */
function renderFortune(fortune) {
  const card = document.getElementById('ziweiFortuneCard');

  const html = `
    <div class="ziwei-fortune-section">
      <div class="ziwei-fortune__title">🌟 综合运势</div>
      <div class="ziwei-fortune__content">
        <div style="margin-bottom: 16px;">
          <div style="margin-bottom: 8px; font-weight: 600;">事业运</div>
          <div class="ziwei-stars">${renderStars(fortune.career.score)}</div>
          <div style="margin-top: 4px; font-size: 0.85rem; color: var(--text-2);">${fortune.career.text}</div>
        </div>
        <div style="margin-bottom: 16px;">
          <div style="margin-bottom: 8px; font-weight: 600;">财运</div>
          <div class="ziwei-stars">${renderStars(fortune.wealth.score)}</div>
          <div style="margin-top: 4px; font-size: 0.85rem; color: var(--text-2);">${fortune.wealth.text}</div>
        </div>
        <div style="margin-bottom: 16px;">
          <div style="margin-bottom: 8px; font-weight: 600;">感情运</div>
          <div class="ziwei-stars">${renderStars(fortune.relationship.score)}</div>
          <div style="margin-top: 4px; font-size: 0.85rem; color: var(--text-2);">${fortune.relationship.text}</div>
        </div>
        <div>
          <div style="margin-bottom: 8px; font-weight: 600;">健康运</div>
          <div class="ziwei-stars">${renderStars(fortune.health.score)}</div>
          <div style="margin-top: 4px; font-size: 0.85rem; color: var(--text-2);">${fortune.health.text}</div>
        </div>
      </div>
    </div>

    <div class="ziwei-fortune-section">
      <div class="ziwei-fortune__title">💡 今日建议</div>
      <div class="ziwei-fortune__content">
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
          ${fortune.suggestions.map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  card.innerHTML = html;
}

/**
 * 渲染星级评分
 */
function renderStars(score) {
  const fullStars = Math.floor(score);
  const emptyStars = 5 - fullStars;

  return '★'.repeat(fullStars) + '☆'.repeat(emptyStars);
}
