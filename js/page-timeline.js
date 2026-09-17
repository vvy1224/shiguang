/* 拾光 · 时间线页：账单与动态汇成一条手账流 */
window.SG = window.SG || {};
SG.pages = SG.pages || {};

SG.pages.timeline = {
  render: async function (root) {
    SG.revokeURLs();
    const entries = await SG.data.getAllEntries();
    const photoMap = await SG.data.photosByEntry();

    root.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'page-head';
    head.innerHTML =
      '<div class="brand">时间线</div>' +
      '<div class="page-sub">花的每一笔，都是生活的一部分</div>';
    root.appendChild(head);

    if (!entries.length) {
      root.appendChild(SG.ui.emptyState('📖', '这里会变成你的手账<br>记第一笔，从下面的 ＋ 开始'));
      return;
    }

    /* 按天分组 */
    const groups = [];
    let curKey = null, cur = null;
    entries.forEach((e) => {
      const key = SG.ymd(new Date(e.ts));
      if (key !== curKey) {
        cur = { key: key, items: [], out: 0 };
        groups.push(cur);
        curKey = key;
      }
      cur.items.push(e);
      if (e.kind === 'expense' && e.flow !== 'in') cur.out += e.amount;
    });

    groups.forEach((g) => {
      root.appendChild(SG.ui.dayHeader(g.key, Math.round(g.out * 100) / 100));
      const wrap = document.createElement('div');
      wrap.className = 'cards';
      g.items.forEach((e) => wrap.appendChild(SG.ui.entryCard(e, photoMap[e.id] || [])));
      root.appendChild(wrap);
    });

    const foot = document.createElement('div');
    foot.className = 'tl-foot';
    foot.textContent = '🌾 到这里啦，日子还长';
    root.appendChild(foot);
  },
};
