/* 拾光 · 业务数据层：条目 / 照片 / 设置 / 备份 */
window.SG = window.SG || {};

SG.data = (() => {

  /* ---------- 分类 ---------- */
  const EXPENSE_CATEGORIES = [
    { key: 'food',    name: '餐饮', emoji: '🍜' },
    { key: 'traffic', name: '交通', emoji: '🚌' },
    { key: 'shop',    name: '购物', emoji: '🛍️' },
    { key: 'home',    name: '居住', emoji: '🏠' },
    { key: 'fun',     name: '娱乐', emoji: '🎮' },
    { key: 'health',  name: '医疗', emoji: '💊' },
    { key: 'study',   name: '学习', emoji: '📚' },
    { key: 'social',  name: '人情', emoji: '🎁' },
    { key: 'other',   name: '其他', emoji: '✨' },
  ];
  const INCOME_CATEGORIES = [
    { key: 'salary',  name: '收入', emoji: '💰' },
    { key: 'hongbao', name: '红包', emoji: '🧧' },
    { key: 'baoxiao', name: '报销', emoji: '🧾' },
  ];
  const _catMap = {};
  EXPENSE_CATEGORIES.concat(INCOME_CATEGORIES).forEach((c) => { _catMap[c.key] = c; });
  SG.cat = (key) => _catMap[key] || { key: 'other', name: '其他', emoji: '✨' };

  /* ---------- 条目 ---------- */
  async function addEntry(e) {
    const now = Date.now();
    const entry = Object.assign({ id: SG.uid(), createdAt: now, updatedAt: now }, e);
    delete entry.photoBlobs;
    await SG.db.put('entries', entry);
    if (Array.isArray(e.photoBlobs)) {
      for (let i = 0; i < e.photoBlobs.length; i++) {
        await SG.db.put('photos', { id: SG.uid(), entryId: entry.id, blob: e.photoBlobs[i], ts: now + i });
      }
    }
    if (Array.isArray(e.people) && e.people.length) await addPeopleHistory(e.people);
    SG.emit('changed');
    return entry;
  }

  async function updateEntry(id, patch, newPhotoBlobs) {
    const old = await SG.db.get('entries', id);
    if (!old) return null;
    const entry = Object.assign({}, old, patch, { updatedAt: Date.now() });
    await SG.db.put('entries', entry);
    if (Array.isArray(newPhotoBlobs) && newPhotoBlobs.length) {
      const base = Date.now();
      for (let i = 0; i < newPhotoBlobs.length; i++) {
        await SG.db.put('photos', { id: SG.uid(), entryId: id, blob: newPhotoBlobs[i], ts: base + i });
      }
    }
    if (Array.isArray(entry.people) && entry.people.length) await addPeopleHistory(entry.people);
    SG.emit('changed');
    return entry;
  }

  async function deleteEntry(id) {
    const photos = await SG.db.byIndex('photos', 'entryId', id);
    for (const p of photos) await SG.db.del('photos', p.id);
    await SG.db.del('entries', id);
    SG.emit('changed');
  }

  async function deletePhoto(photoId) {
    await SG.db.del('photos', photoId);
  }

  async function getEntry(id) {
    return SG.db.get('entries', id);
  }

  async function getAllEntries() {
    const list = await SG.db.getAll('entries');
    return list.sort((a, b) => b.ts - a.ts);
  }

  /** 一次性取全部照片并按条目分组：{ entryId: [photo...] } */
  async function photosByEntry() {
    const all = await SG.db.getAll('photos');
    const map = {};
    all.sort((a, b) => a.ts - b.ts).forEach((p) => {
      (map[p.entryId] = map[p.entryId] || []).push(p);
    });
    return map;
  }

  /* ---------- 设置 ---------- */
  async function getSetting(key, def) {
    const r = await SG.db.get('settings', key);
    return r ? r.value : def;
  }
  async function setSetting(key, value) {
    await SG.db.put('settings', { key: key, value: value });
    SG.emit('changed');
  }

  async function addPeopleHistory(names) {
    let list = [];
    try { list = (await getSetting('peopleHistory', [])) || []; } catch (e) { list = []; }
    const set = list.slice();
    names.forEach((n) => {
      const i = set.indexOf(n);
      if (i >= 0) set.splice(i, 1);
      set.unshift(n);
    });
    await SG.db.put('settings', { key: 'peopleHistory', value: set.slice(0, 30) });
  }

  /* ---------- 备份 导出 / 恢复 ---------- */
  function blobToBase64(blob) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  }

  async function exportBackup() {
    const entries = await SG.db.getAll('entries');
    const photos = await SG.db.getAll('photos');
    const settings = await SG.db.getAll('settings');
    const photoList = [];
    for (const p of photos) {
      photoList.push({ id: p.id, entryId: p.entryId, ts: p.ts, data: await blobToBase64(p.blob) });
    }
    return {
      app: 'shiguang', version: 1, exportedAt: new Date().toISOString(),
      entries: entries, photos: photoList, settings: settings,
    };
  }

  async function importBackup(obj, replace) {
    if (!obj || obj.app !== 'shiguang' || !Array.isArray(obj.entries)) {
      throw new Error('不是有效的拾光备份文件');
    }
    if (replace) {
      await SG.db.clear('entries');
      await SG.db.clear('photos');
    }
    for (const e of obj.entries) await SG.db.put('entries', e);
    for (const p of (obj.photos || [])) {
      let blob = null;
      try { blob = await (await fetch(p.data)).blob(); } catch (e) { continue; }
      await SG.db.put('photos', { id: p.id, entryId: p.entryId, blob: blob, ts: p.ts || Date.now() });
    }
    for (const s of (obj.settings || [])) {
      if (s && s.key === 'monthlyBudget') await SG.db.put('settings', s);
    }
    SG.emit('changed');
  }

  async function wipeAll() {
    await SG.db.clear('entries');
    await SG.db.clear('photos');
    SG.emit('changed');
  }

  return {
    EXPENSE_CATEGORIES: EXPENSE_CATEGORIES,
    INCOME_CATEGORIES: INCOME_CATEGORIES,
    addEntry, updateEntry, deleteEntry, deletePhoto, getEntry, getAllEntries, photosByEntry,
    getSetting, setSetting, exportBackup, importBackup, wipeAll,
  };
})();
