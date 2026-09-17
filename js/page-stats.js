/* 拾光 · 统计页：月度收支 / 分类构成 / 近6个月趋势 / 月度报告 */
window.SG = window.SG || {};
SG.pages = SG.pages || {};

SG.pages.stats = {
  _ym: null,

  render: async function (root) {
    SG.revokeURLs();
    const ym = this._ym || SG.ym(new Date());
    this._ym = ym;

    const entries = await SG.data.getAllEntries();
    const photoMap = await SG.data.photosByEntry();
    const monthEntries = entries.filter((e) => SG.ym(new Date(e.ts)) === ym);

    let out = 0, inn = 0;
    const catSum = {};
    const peopleCount = {};
    const monthPhotos = [];
    monthEntries.forEach((e) => {
      if (e.kind === 'expense') {
        if (e.flow === 'in') { inn += e.amount; }
        else {
          out += e.amount;
          catSum[e.category] = (catSum[e.category] || 0) + e.amount;
        }
      }
      (e.people || []).forEach((p) => { peopleCount[p] = (peopleCount[p] || 0) + 1; });
      (photoMap[e.id] || []).forEach((p) => monthPhotos.push(p));
    });
    out = Math.round(out * 100) / 100;
    inn = Math.round(inn * 100) / 100;

    root.innerHTML = '';

    /* 月份切换 */
    const nav = document.createElement('div');
    nav.className = 'month-nav';
    const isCurrentMonth = ym === SG.ym(new Date());
    nav.innerHTML =
      '<button class="mn-btn" id="mn-prev">‹</button>' +
      '<div class="mn-label">' + SG.monthLabel(ym) + '</div>' +
      '<button class="mn-btn" id="mn-next"' + (isCurrentMonth ? ' disabled' : '') + '>›</button>';
    root.appendChild(nav);
    nav.querySelector('#mn-prev').addEventListener('click', () => { this._ym = ymShift(ym, -1); this.render(root); });
    const nextBtn = nav.querySelector('#mn-next');
    if (nextBtn) nextBtn.addEventListener('click', () => { this._ym = ymShift(ym, 1); this.render(root); });

    if (!monthEntries.length) {
      root.appendChild(SG.ui.emptyState('🍂', SG.monthLabel(ym) + '还没有记录<br>翻翻其他月份，或记下新的一笔'));
      return;
    }

    /* 收支总览 */
    const summary = document.createElement('div');
    summary.className = 'card sum-card';
    summary.innerHTML =
      '<div class="sum-row">' +
      '  <div class="sum-item"><div class="sum-label">支出</div><div class="sum-num out">¥' + SG.fmtMoney(out) + '</div></div>' +
      '  <div class="sum-item"><div class="sum-label">收入</div><div class="sum-num in">¥' + SG.fmtMoney(inn) + '</div></div>' +
      '  <div class="sum-item"><div class="sum-label">结余</div><div class="sum-num">¥' + SG.fmtMoney(inn - out) + '</div></div>' +
      '</div>';
    root.appendChild(summary);

    /* 分类构成 */
    const catKeys = Object.keys(catSum).sort((a, b) => catSum[b] - catSum[a]);
    if (catKeys.length) {
      const max = catSum[catKeys[0]];
      const sec = document.createElement('div');
      sec.className = 'card section-card';
      sec.innerHTML = '<div class="sec-title">钱花在哪儿了</div>' + catKeys.map((k) => {
        const c = SG.cat(k);
        const pct = Math.round((catSum[k] / out) * 100);
        return (
          '<div class="cat-row">' +
          '  <span class="cat-emoji" style="background:' + SG.catSoft(k) + '">' + c.emoji + '</span>' +
          '  <div class="cat-bar-wrap">' +
          '    <div class="cat-bar-line"><span class="cat-name">' + c.name + '</span>' +
          '    <span class="cat-val">¥' + SG.fmtMoney(catSum[k]) + ' · ' + pct + '%</span></div>' +
          '    <div class="cat-track"><div class="cat-fill" style="width:' + Math.max(4, Math.round((catSum[k] / max) * 100)) + '%"></div></div>' +
          '  </div>' +
          '</div>'
        );
      }).join('');
      root.appendChild(sec);
    }

    /* 近 6 个月趋势 */
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const m = ymShift(ym, -i);
      const sum = entries.reduce((acc, e) => {
        if (SG.ym(new Date(e.ts)) === m && e.kind === 'expense' && e.flow !== 'in') return acc + e.amount;
        return acc;
      }, 0);
      trend.push({ m: m, sum: Math.round(sum * 100) / 100 });
    }
    const maxTrend = Math.max.apply(null, trend.map((t) => t.sum).concat([1]));
    const trendEl = document.createElement('div');
    trendEl.className = 'card section-card';
    trendEl.innerHTML =
      '<div class="sec-title">近 6 个月</div>' +
      '<div class="trend">' +
      trend.map((t) => {
        const h = Math.max(3, Math.round((t.sum / maxTrend) * 100));
        const cur = t.m === ym;
        return (
          '<div class="trend-col">' +
          '  <span class="trend-val">' + (t.sum > 0 ? SG.fmtMoney(t.sum) : '') + '</span>' +
          '  <div class="trend-bar' + (cur ? ' cur' : '') + '" style="height:' + h + 'px"></div>' +
          '  <span class="trend-m">' + parseInt(t.m.split('-')[1], 10) + '月</span>' +
          '</div>'
        );
      }).join('') +
      '</div>';
    root.appendChild(trendEl);

    /* 月度报告 */
    const report = document.createElement('div');
    report.className = 'card section-card report';
    let topCatLine = '';
    if (catKeys.length) {
      const tc = SG.cat(catKeys[0]);
      topCatLine = '最常花钱的地方是 ' + tc.emoji + ' ' + tc.name;
    }
    let topPersonLine = '';
    const ppl = Object.keys(peopleCount).sort((a, b) => peopleCount[b] - peopleCount[a]);
    if (ppl.length) {
      topPersonLine = '最常见面的人是 <b>' + SG.esc(ppl[0]) + '</b>（' + peopleCount[ppl[0]] + ' 次）';
    }
    report.innerHTML =
      '<div class="sec-title">' + SG.monthLabel(ym) + ' · 生活报告</div>' +
      '<div class="report-lines">' +
      '  <p>这个月写下了 <b>' + monthEntries.length + '</b> 条记录，' +
      (monthPhotos.length ? '拍下了 <b>' + monthPhotos.length + '</b> 张照片。' : '。</p>') +
      (topCatLine ? '<p>' + topCatLine + '。</p>' : '') +
      (topPersonLine ? '<p>' + topPersonLine + '。</p>' : '') +
      '</div>' +
      (monthPhotos.length
        ? SG.ui.photoGrid(monthPhotos) + '<div class="report-photo-hint">点照片可以放大看</div>'
        : '<div class="report-nophoto">这个月还没拍照片，随手拍点日常吧 📷</div>');
    root.appendChild(report);
    SG.ui.bindPhotoGrid(report, monthPhotos);

    const foot = document.createElement('div');
    foot.className = 'tl-foot';
    foot.textContent = '日子是过出来的，也是记出来的 🌾';
    root.appendChild(foot);
  },
};

function ymShift(ymStr, delta) {
  const p = ymStr.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1 + delta, 1);
  return SG.ym(d);
}
