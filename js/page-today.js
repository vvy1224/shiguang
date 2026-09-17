/* 拾光 · 今天页 */
window.SG = window.SG || {};
SG.pages = SG.pages || {};

SG.pages.today = {
  render: async function (root) {
    SG.revokeURLs();
    const entries = await SG.data.getAllEntries();
    const photoMap = await SG.data.photosByEntry();
    const budget = await SG.data.getSetting('monthlyBudget', 0);

    const now = new Date();
    const todayKey = SG.ymd(now);
    const monthKey = SG.ym(now);

    let todayOut = 0, todayIn = 0, monthOut = 0, monthIn = 0;
    const todayEntries = [];
    entries.forEach((e) => {
      const ymdStr = SG.ymd(new Date(e.ts));
      if (ymdStr === todayKey) {
        todayEntries.push(e);
        if (e.kind === 'expense') { if (e.flow === 'in') todayIn += e.amount; else todayOut += e.amount; }
      }
      if (SG.ym(new Date(e.ts)) === monthKey && e.kind === 'expense') {
        if (e.flow === 'in') monthIn += e.amount; else monthOut += e.amount;
      }
    });
    todayOut = Math.round(todayOut * 100) / 100;
    monthOut = Math.round(monthOut * 100) / 100;

    const d = SG.dayLabel(todayKey);
    let html =
      '<div class="page-head">' +
      '  <div class="brand">拾光</div>' +
      '  <div class="page-sub">' + d.main + ' · ' + d.week + '</div>' +
      '</div>' +
      '<div class="hero card">' +
      '  <div class="hero-label">今日支出</div>' +
      '  <div class="hero-num">¥ ' + SG.fmtMoney(todayOut) + '</div>' +
      (todayIn > 0 ? '<div class="hero-in">今日收入 +¥' + SG.fmtMoney(todayIn) + '</div>' : '') +
      '  <div class="hero-foot">' +
      '    <span>本月支出 ¥' + SG.fmtMoney(monthOut) + '</span>' +
      (monthIn > 0 ? '<span>本月收入 ¥' + SG.fmtMoney(monthIn) + '</span>' : '') +
      '  </div>' +
      (budget > 0 ? budgetBar(monthOut, budget) : '') +
      '</div>';

    const list = document.createElement('div');
    list.className = 'page-body';
    list.innerHTML = html;

    const listTitle = document.createElement('div');
    listTitle.className = 'list-title';
    listTitle.textContent = '今天的记录';

    const cards = document.createElement('div');
    cards.className = 'cards';
    if (todayEntries.length) {
      todayEntries.forEach((e) => cards.appendChild(SG.ui.entryCard(e, photoMap[e.id] || [])));
    } else {
      cards.appendChild(SG.ui.emptyState('🌼', '今天还没有记录<br>点下面的 ＋ ，把今天记下来'));
    }

    root.innerHTML = '';
    root.appendChild(list);
    root.appendChild(listTitle);
    root.appendChild(cards);
  },
};

function budgetBar(spent, budget) {
  const pct = Math.min(100, Math.round((spent / budget) * 100));
  const over = spent > budget;
  const cls = over ? 'over' : (pct >= 80 ? 'warn' : '');
  return (
    '<div class="budget">' +
    '  <div class="budget-head"><span>本月预算</span><span>' +
    (over ? '已超支 ¥' + SG.fmtMoney(spent - budget) : '还剩 ¥' + SG.fmtMoney(budget - spent)) +
    '（' + pct + '%）</span></div>' +
    '  <div class="budget-track"><div class="budget-fill ' + cls + '" style="width:' + Math.max(pct, spent > 0 ? 4 : 0) + '%"></div></div>' +
    '</div>'
  );
}
