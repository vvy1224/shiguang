/* 拾光 · 发布弹窗：记账 / 动态 二合一（新建 & 编辑共用） */
window.SG = window.SG || {};

SG.composer = (() => {

  let S = null;      // 当前编辑状态
  let refs = null;   // DOM 引用

  function defaultState() {
    const d = new Date();
    return {
      mode: 'expense',        // expense | moment
      flow: 'out',            // out | in
      editId: null,
      entry: null,
      amount: '',
      category: 'food',
      note: '',
      people: [],
      date: SG.ymd(d),
      photos: { existing: [], pending: [], deleteIds: [] },
      dirty: false,
      saved: false,
    };
  }

  function touch() { if (S) S.dirty = true; }

  /* ---------- 打开入口 ---------- */
  async function open(opts) {
    opts = opts || {};
    S = defaultState();

    if (opts.editId) {
      const e = await SG.data.getEntry(opts.editId);
      if (!e) { SG.ui.toast('这条记录不存在了'); return; }
      S.editId = e.id;
      S.entry = e;
      S.mode = e.kind;
      S.flow = e.flow || 'out';
      S.amount = e.amount != null ? String(e.amount) : '';
      S.category = e.category || 'food';
      S.note = e.note || '';
      S.people = (e.people || []).slice();
      const d = new Date(e.ts);
      S.date = SG.ymd(d);
      S.photos.existing = (await SG.db.byIndex('photos', 'entryId', e.id)).sort((a, b) => a.ts - b.ts);
    }

    build();
  }

  /* ---------- 构建 DOM ---------- */
  function build() {
    const editing = !!S.editId;
    const root = document.createElement('div');
    root.className = 'composer';
    root.innerHTML =
      '<div class="cp-head">' +
      '  <div class="cp-title">' + (editing ? '编辑记录' : '记一下') + '</div>' +
      '  <button class="cp-close" title="关闭">×</button>' +
      '</div>' +
      (editing ? '' :
        '<div class="seg">' +
        '  <button class="seg-item" data-mode="expense">✍️ 记一笔</button>' +
        '  <button class="seg-item" data-mode="moment">📷 发动态</button>' +
        '</div>') +
      '<div class="cp-body"></div>';

    refs = {
      root: root,
      body: root.querySelector('.cp-body'),
    };

    const sheet = SG.ui.openSheet(root, { tall: true });
    refs.close = sheet.close;
    root.querySelector('.cp-close').addEventListener('click', () => tryClose());
    /* 只在直接点到遮罩（弹窗外部）时才询问关闭，避免内部点击冒泡误触发 */
    sheet.backdrop.addEventListener('click', (e) => {
      if (e.target === sheet.backdrop) tryClose();
    });
    if (!editing) {
      SG.$$('.seg-item', root).forEach((btn) => {
        btn.addEventListener('click', () => {
          S.mode = btn.getAttribute('data-mode');
          touch();
          renderBody();
        });
      });
    }
    renderBody();
  }

  /* ---------- 渲染主体 ---------- */
  function renderBody() {
    if (!refs) return;
    if (!S.editId) {
      SG.$$('.seg-item', refs.root).forEach((b) => b.classList.toggle('on', b.getAttribute('data-mode') === S.mode));
    }

    if (S.mode === 'expense') {
      refs.body.innerHTML =
        '<div class="flow-toggle">' +
        '  <button class="ft-item" data-flow="out">支出</button>' +
        '  <button class="ft-item" data-flow="in">收入</button>' +
        '</div>' +
        '<div class="amount-row">' +
        '  <span class="amount-rmb">¥</span>' +
        '  <input id="cp-amount" class="amount-input" type="text" inputmode="decimal" placeholder="0.00" value="' + SG.esc(S.amount) + '">' +
        '</div>' +
        '<div class="cp-label">分类</div>' +
        '<div class="cat-grid" id="cp-cats"></div>' +
        '<div class="cp-label">备注</div>' +
        '<input id="cp-note" class="cp-input" type="text" maxlength="60" placeholder="这笔钱花在哪了？（可写可不写）" value="' + SG.esc(S.note) + '">' +
        photoSectionHtml() +
        peopleSectionHtml() +
        dateSectionHtml() +
        '<div class="cp-actions">' +
        (S.editId ? '<button class="cp-del" id="cp-del">删除这条记录</button>' : '') +
        '<button class="cp-save" id="cp-save">记下来</button>' +
        '</div>';
    } else {
      refs.body.innerHTML =
        '<textarea id="cp-note" class="cp-textarea" maxlength="500" placeholder="今天有什么想记下的？一句感慨也可以…"></textarea>' +
        photoSectionHtml() +
        peopleSectionHtml() +
        dateSectionHtml() +
        '<div class="cp-actions">' +
        (S.editId ? '<button class="cp-del" id="cp-del">删除这条记录</button>' : '') +
        '<button class="cp-save" id="cp-save">记下来</button>' +
        '</div>';
    }

    wireCommon();
    if (S.mode === 'expense') {
      wireAmount();
      renderCats();
      wireFlow();
    }
    renderPhotos();
    renderPeople();
  }

  function photoSectionHtml() {
    return (
      '<div class="cp-label">照片 <span class="cp-hint">（随手拍，最多 9 张）</span></div>' +
      '<div class="photo-strip" id="cp-photos"></div>' +
      '<input type="file" id="cp-cam" accept="image/*" capture="environment" hidden>' +
      '<input type="file" id="cp-gal" accept="image/*" multiple hidden>'
    );
  }

  function peopleSectionHtml() {
    return (
      '<div class="cp-label">和谁在一起 <span class="cp-hint">（可选）</span></div>' +
      '<div class="people-area" id="cp-people"></div>' +
      '<datalist id="cp-people-list"></datalist>'
    );
  }

  function dateSectionHtml() {
    return (
      '<div class="cp-label">日期</div>' +
      '<input id="cp-date" class="cp-input cp-date" type="date" value="' + S.date + '" max="' + SG.ymd(new Date()) + '">'
    );
  }

  /* ---------- 金额 ---------- */
  function wireAmount() {
    const input = SG.$('#cp-amount', refs.body);
    input.addEventListener('input', () => {
      let v = input.value.replace(/[^\d.]/g, '');
      const parts = v.split('.');
      if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
      const dec = v.split('.');
      if (dec[1] && dec[1].length > 2) v = dec[0] + '.' + dec[1].slice(0, 2);
      input.value = v;
      S.amount = v;
      touch();
    });
  }

  function wireFlow() {
    SG.$$('.ft-item', refs.body).forEach((btn) => {
      btn.addEventListener('click', () => {
        if (S.flow === btn.getAttribute('data-flow')) return;
        S.flow = btn.getAttribute('data-flow');
        S.category = S.flow === 'in' ? 'salary' : 'food';
        touch();
        renderBody();
      });
    });
  }

  /* ---------- 分类 ---------- */
  function renderCats() {
    const grid = SG.$('#cp-cats', refs.body);
    const cats = S.flow === 'in' ? SG.data.INCOME_CATEGORIES : SG.data.EXPENSE_CATEGORIES;
    if (!cats.some((c) => c.key === S.category)) S.category = cats[0].key;
    grid.innerHTML = cats.map((c) =>
      '<button class="cat-item' + (c.key === S.category ? ' on' : '') + '" data-key="' + c.key + '">' +
      '<span class="cat-emoji" style="background:' + SG.catSoft(c.key) + '">' + c.emoji + '</span>' +
      '<span class="cat-name">' + c.name + '</span></button>'
    ).join('');
    SG.$$('.cat-item', grid).forEach((btn) => {
      btn.addEventListener('click', () => {
        S.category = btn.getAttribute('data-key');
        touch();
        renderCats();
      });
    });
  }

  /* ---------- 照片 ---------- */
  function renderPhotos() {
    const strip = SG.$('#cp-photos', refs.body);
    if (!strip) return;
    const total = S.photos.existing.filter((p) => S.photos.deleteIds.indexOf(p.id) < 0).length + S.photos.pending.length;
    let html = '';
    S.photos.existing.forEach((p) => {
      if (S.photos.deleteIds.indexOf(p.id) >= 0) return;
      html += '<div class="ph-cell" data-kind="old" data-id="' + p.id + '">' +
        '<img src="' + SG.objectURL(p.blob) + '" alt="">' +
        '<button class="ph-x" data-id="' + p.id + '">×</button></div>';
    });
    S.photos.pending.forEach((b, i) => {
      html += '<div class="ph-cell" data-kind="new" data-idx="' + i + '">' +
        '<img src="' + SG.objectURL(b) + '" alt="">' +
        '<button class="ph-x" data-idx="' + i + '">×</button></div>';
    });
    if (total < 9) {
      html += '<div class="ph-add">' +
        '<button class="ph-add-btn" id="cp-add-cam">📷<span>拍照</span></button>' +
        '<button class="ph-add-btn" id="cp-add-gal">🖼️<span>相册</span></button>' +
        '</div>';
    }
    strip.innerHTML = html;

    const cam = SG.$('#cp-cam', refs.body);
    const gal = SG.$('#cp-gal', refs.body);
    const camBtn = SG.$('#cp-add-cam', strip);
    const galBtn = SG.$('#cp-add-gal', strip);
    if (camBtn) camBtn.addEventListener('click', () => { cam.value = ''; cam.click(); });
    if (galBtn) galBtn.addEventListener('click', () => { gal.value = ''; gal.click(); });
    cam.addEventListener('change', () => handleFiles(cam.files));
    gal.addEventListener('change', () => handleFiles(gal.files));

    SG.$$('.ph-x', strip).forEach((x) => {
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        touch();
        const id = x.getAttribute('data-id');
        const idx = x.getAttribute('data-idx');
        if (id) S.photos.deleteIds.push(id);
        else S.photos.pending.splice(parseInt(idx, 10), 1);
        renderPhotos();
      });
    });
  }

  async function handleFiles(files) {
    if (!files || !files.length) return;
    const room = 9 - (S.photos.existing.length - S.photos.deleteIds.length) - S.photos.pending.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    for (const f of list) {
      try {
        const blob = await SG.readImageResized(f);
        S.photos.pending.push(blob);
        touch();
      } catch (err) {
        SG.ui.toast(err.message || '这张图片处理失败了');
      }
    }
    renderPhotos();
  }

  /* ---------- 人物 ---------- */
  async function renderPeople() {
    const area = SG.$('#cp-people', refs.body);
    if (!area) return;
    const history = (await SG.data.getSetting('peopleHistory', [])) || [];
    const dl = SG.$('#cp-people-list', refs.body);
    dl.innerHTML = history.map((n) => '<option value="' + SG.esc(n) + '">').join('');

    let html = S.people.map((p, i) =>
      '<span class="chip chip-x" data-i="' + i + '">' + SG.esc(p) + ' <b>×</b></span>'
    ).join('');
    html += '<input id="cp-people-input" class="cp-input people-input" type="text" list="cp-people-list" maxlength="12" placeholder="+ 输入名字，回车添加">';
    area.innerHTML = html;

    SG.$$('.chip-x', area).forEach((chip) => {
      chip.addEventListener('click', () => {
        S.people.splice(parseInt(chip.getAttribute('data-i'), 10), 1);
        touch();
        renderPeople();
      });
    });

    const input = SG.$('#cp-people-input', area);
    const addFromInput = () => {
      const names = input.value.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);
      names.forEach((n) => {
        if (S.people.length >= 10) return;
        if (S.people.indexOf(n) < 0) S.people.push(n);
      });
      if (names.length) { touch(); renderPeople(); }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addFromInput(); }
    });
    input.addEventListener('blur', addFromInput);
  }

  /* ---------- 日期 ---------- */
  function wireCommon() {
    const note = SG.$('#cp-note', refs.body);
    if (note) note.addEventListener('input', () => { S.note = note.value; touch(); });
    const date = SG.$('#cp-date', refs.body);
    if (date) date.addEventListener('change', () => { S.date = date.value || S.date; touch(); });
    const save = SG.$('#cp-save', refs.body);
    if (save) save.addEventListener('click', saveEntry);
    const del = SG.$('#cp-del', refs.body);
    if (del) del.addEventListener('click', async () => {
      const ok = await SG.ui.confirmDialog({
        title: '删除这条记录？',
        text: '删除后照片也会一起删掉，找不回来了。',
        okText: '删除', danger: true,
      });
      if (ok) {
        await SG.data.deleteEntry(S.editId);
        S.saved = true;
        refs.close();
        refs = null; S = null;
        SG.ui.toast('已删除');
      }
    });
  }

  /* ---------- 保存 ---------- */
  async function saveEntry() {
    const note = (S.note || '').trim();
    let payload, newBlobs = S.photos.pending.slice();

    if (S.mode === 'expense') {
      const amt = Math.round(parseFloat(S.amount) * 100) / 100;
      if (!S.amount || isNaN(amt) || amt <= 0) { SG.ui.toast('先填一个金额吧'); return; }
      payload = {
        kind: 'expense', flow: S.flow, amount: amt, category: S.category,
        note: note, people: S.people.slice(), ts: buildTs(),
      };
    } else {
      const hasPhoto = (S.photos.existing.length - S.photos.deleteIds.length) + S.photos.pending.length > 0;
      if (!note && !hasPhoto) { SG.ui.toast('写点什么，或放一张照片吧'); return; }
      payload = {
        kind: 'moment', amount: null, category: null,
        note: note, people: S.people.slice(), ts: buildTs(),
      };
    }

    const btn = SG.$('#cp-save', refs.body);
    btn.disabled = true;
    btn.textContent = '记着呢…';
    try {
      if (S.editId) {
        await SG.data.updateEntry(S.editId, payload, newBlobs);
        for (const id of S.photos.deleteIds) await SG.data.deletePhoto(id);
      } else {
        await SG.data.addEntry(Object.assign({ photoBlobs: newBlobs }, payload));
      }
      S.saved = true;
      refs.close();
      refs = null; S = null;
      SG.ui.toast('已记下 ✨');
    } catch (err) {
      console.error(err);
      SG.ui.toast('保存失败了，再试一次？');
      btn.disabled = false;
      btn.textContent = '记下来';
    }
  }

  function buildTs() {
    const p = S.date.split('-').map(Number);
    const base = S.entry ? new Date(S.entry.ts) : new Date();
    return new Date(p[0], p[1] - 1, p[2], base.getHours(), base.getMinutes()).getTime();
  }

  function tryClose() {
    if (!refs) return;
    if (S.dirty && !S.saved) {
      SG.ui.confirmDialog({
        title: '还没保存',
        text: '放弃这条记录吗？',
        okText: '放弃',
      }).then((ok) => {
        if (ok) { refs.close(); refs = null; S = null; }
      });
    } else {
      refs.close(); refs = null; S = null;
    }
  }

  return { open: open };
})();
