/* 拾光 · UI 组件：卡片 / 弹窗 / 轻提示 / 图片查看 */
window.SG = window.SG || {};

SG.ui = (() => {

  /* 分类柔和底色 */
  const SOFT = {
    food: '#FBE7D4', traffic: '#DDEBEF', shop: '#F6DFE4', home: '#E4ECDD',
    fun: '#EAE3F6', health: '#DFEFE9', study: '#E7E9F7', social: '#FBE3D9',
    other: '#F3EADA', salary: '#F6EBD3', hongbao: '#FBE1DC', baoxiao: '#E4EEF0',
  };
  SG.catSoft = (key) => SOFT[key] || '#F3EADA';

  /* ---------- 轻提示 ---------- */
  let _toastTimer = null;
  function toast(msg) {
    let t = SG.$('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  /* ---------- 确认对话框 ---------- */
  function confirmDialog(opt) {
    opt = opt || {};
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'dlg-backdrop';
      wrap.innerHTML =
        '<div class="dlg" role="dialog">' +
        '  <div class="dlg-title">' + SG.esc(opt.title || '确认') + '</div>' +
        '  <div class="dlg-text">' + SG.esc(opt.text || '') + '</div>' +
        '  <div class="dlg-btns">' +
        '    <button class="btn-plain" data-act="no">' + SG.esc(opt.cancelText || '取消') + '</button>' +
        '    <button class="btn-primary ' + (opt.danger ? 'btn-danger' : '') + '" data-act="yes">' + SG.esc(opt.okText || '确定') + '</button>' +
        '  </div>' +
        '</div>';
      const close = (val) => { wrap.remove(); resolve(val); };
      wrap.addEventListener('click', (e) => {
        if (e.target === wrap) close(false);
        const act = e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'yes') close(true);
        if (act === 'no') close(false);
      });
      document.getElementById('overlays').appendChild(wrap);
    });
  }

  /* ---------- 底部抽屉 ---------- */
  function openSheet(contentEl, opt) {
    opt = opt || {};
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'sheet' + (opt.tall ? ' sheet-tall' : '');
    sheet.appendChild(contentEl);
    backdrop.appendChild(sheet);
    document.getElementById('overlays').appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));
    const close = () => {
      backdrop.classList.remove('show');
      setTimeout(() => backdrop.remove(), 240);
    };
    return { close: close, backdrop: backdrop, sheet: sheet };
  }

  /* ---------- 图片查看（灯箱） ---------- */
  function lightbox(photos, startIndex) {
    if (!photos || !photos.length) return;
    let idx = startIndex || 0;
    const urls = photos.map((p) => SG.objectURL(p.blob));

    const wrap = document.createElement('div');
    wrap.className = 'lb-backdrop';
    wrap.innerHTML =
      '<button class="lb-close">×</button>' +
      '<div class="lb-stage"><img alt="照片"></div>' +
      '<div class="lb-foot">' +
      '  <button class="lb-nav" data-n="-1">‹</button>' +
      '  <span class="lb-count"></span>' +
      '  <button class="lb-nav" data-n="1">›</button>' +
      '</div>';
    const img = wrap.querySelector('img');
    const count = wrap.querySelector('.lb-count');
    function show() {
      img.src = urls[idx];
      count.textContent = (idx + 1) + ' / ' + urls.length;
    }
    function step(n) {
      idx = (idx + n + urls.length) % urls.length;
      show();
    }
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.classList.contains('lb-stage') || e.target.classList.contains('lb-close')) {
        wrap.remove();
      }
      const n = e.target.getAttribute && e.target.getAttribute('data-n');
      if (n) step(parseInt(n, 10));
    });
    const keyHandler = (e) => {
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'Escape') { wrap.remove(); document.removeEventListener('keydown', keyHandler); }
    };
    document.addEventListener('keydown', keyHandler);
    wrap.addEventListener('remove', () => document.removeEventListener('keydown', keyHandler));
    show();
    document.getElementById('overlays').appendChild(wrap);
  }

  /* ---------- 人物小标签 ---------- */
  function peopleChips(people) {
    if (!people || !people.length) return '';
    return '<span class="ec-people">' + people.map((p) => '<span class="chip">' + SG.esc(p) + '</span>').join('') + '</span>';
  }

  /* ---------- 照片九宫格 ---------- */
  function photoGrid(photos, opt) {
    opt = opt || {};
    if (!photos || !photos.length) return '';
    const shown = photos.slice(0, 9);
    let html = '<div class="pgrid p' + Math.min(shown.length, 9) + '">';
    shown.forEach((p, i) => {
      html += '<div class="pg-cell" data-idx="' + i + '"><img src="' + SG.objectURL(p.blob) + '" alt="照片" loading="lazy"></div>';
    });
    html += '</div>';
    return html;
  }

  function bindPhotoGrid(rootEl, photos) {
    SG.$$('.pg-cell', rootEl).forEach((cell) => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = parseInt(cell.getAttribute('data-idx'), 10) || 0;
        lightbox(photos, i);
      });
    });
  }

  /* ---------- 记录卡片（时间线 & 今天页共用） ---------- */
  function entryCard(entry, photos, opt) {
    opt = opt || {};
    const el = document.createElement('div');
    el.className = 'card entry-card kind-' + entry.kind;
    el.setAttribute('data-id', entry.id);

    if (entry.kind === 'expense') {
      const c = SG.cat(entry.category);
      const out = entry.flow !== 'in';
      el.innerHTML =
        '<div class="ec-icon" style="background:' + SG.catSoft(entry.category) + '">' + c.emoji + '</div>' +
        '<div class="ec-main">' +
        '  <div class="ec-title">' + SG.esc(entry.note || c.name) + '</div>' +
        '  <div class="ec-sub">' + SG.esc(c.name) + ' · ' + SG.hhmm(entry.ts) + peopleChips(entry.people) + '</div>' +
        '</div>' +
        '<div class="ec-amount ' + (out ? 'out' : 'in') + '">' + (out ? '-' : '+') + '<span class="rmb">¥</span>' + SG.fmtMoney(entry.amount) + '</div>';
    } else {
      el.innerHTML =
        '<div class="ec-mtext">' + (entry.note ? SG.esc(entry.note) : '') + '</div>' +
        photoGrid(photos) +
        '<div class="ec-sub">' + SG.hhmm(entry.ts) + peopleChips(entry.people) + '</div>';
    }

    el.addEventListener('click', () => {
      if (opt.onTap) opt.onTap(entry);
      else SG.composer.open({ editId: entry.id });
    });
    bindPhotoGrid(el, photos || []);
    return el;
  }

  /* ---------- 日期分组头 ---------- */
  function dayHeader(ymdStr, dayOutAmount) {
    const d = SG.dayLabel(ymdStr);
    const el = document.createElement('div');
    el.className = 'day-head';
    el.innerHTML =
      '<span class="tape"></span>' +
      '<span class="dh-date">' + d.main + '</span>' +
      '<span class="dh-week">' + d.week + '</span>' +
      (d.tag ? '<span class="dh-tag">' + d.tag + '</span>' : '') +
      '<span class="dh-sum">' + (dayOutAmount > 0 ? '支出 ¥' + SG.fmtMoney(dayOutAmount) : '') + '</span>';
    return el;
  }

  /* ---------- 空状态 ---------- */
  function emptyState(emoji, text) {
    const el = document.createElement('div');
    el.className = 'empty';
    el.innerHTML = '<div class="empty-emoji">' + emoji + '</div><div class="empty-text">' + text + '</div>';
    return el;
  }

  return {
    toast, confirmDialog, openSheet, lightbox,
    entryCard, dayHeader, emptyState, photoGrid, bindPhotoGrid,
  };
})();
