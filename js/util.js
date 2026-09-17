/* 拾光 · 通用工具与事件总线（零依赖，file:// 也可运行） */
window.SG = window.SG || {};

/* ---------- DOM 快捷 ---------- */
SG.$ = (sel, root) => (root || document).querySelector(sel);
SG.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

SG.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

SG.esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ---------- 事件总线 ---------- */
SG._ev = {};
SG.on = (ev, fn) => { (SG._ev[ev] = SG._ev[ev] || []).push(fn); };
SG.emit = (ev, data) => {
  (SG._ev[ev] || []).forEach((fn) => { try { fn(data); } catch (err) { console.error(err); } });
};

/* ---------- 金额 / 日期 ---------- */
SG.fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '0';
  const neg = n < 0;
  const abs = Math.abs(Math.round(n * 100) / 100);
  let s = Number.isInteger(abs) ? String(abs) : String(abs);
  s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + s;
};

SG.pad2 = (n) => String(n).padStart(2, '0');
SG.ymd = (d) => d.getFullYear() + '-' + SG.pad2(d.getMonth() + 1) + '-' + SG.pad2(d.getDate());
SG.ym = (d) => d.getFullYear() + '-' + SG.pad2(d.getMonth() + 1);
SG.hhmm = (ts) => { const d = new Date(ts); return SG.pad2(d.getHours()) + ':' + SG.pad2(d.getMinutes()); };

SG.monthLabel = (ymStr) => { const parts = ymStr.split('-'); return parseInt(parts[0], 10) + '年' + parseInt(parts[1], 10) + '月'; };

SG.weekCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
SG.dayLabel = (ymdStr) => {
  const p = ymdStr.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  const today = SG.ymd(new Date());
  const yesterday = SG.ymd(new Date(Date.now() - 86400000));
  let tag = '';
  if (ymdStr === today) tag = '今天';
  else if (ymdStr === yesterday) tag = '昨天';
  return { main: (p[1]) + '月' + p[2] + '日', week: SG.weekCn[d.getDay()], tag };
};

/* ---------- Object URL 管理（避免内存泄漏） ---------- */
SG._urls = [];
SG.objectURL = (blob) => { const u = URL.createObjectURL(blob); SG._urls.push(u); return u; };
SG.revokeURLs = () => { SG._urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) {} }); SG._urls = []; };

/* ---------- 图片压缩：文件 → Blob（长边压到 maxEdge） ---------- */
SG.readImageResized = (file, maxEdge, quality) => {
  maxEdge = maxEdge || 1600; quality = quality || 0.85;
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('请选择图片文件'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片处理失败'))), 'image/jpeg', quality);
      } catch (err) { reject(err); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('这张图片无法读取，换一张试试？')); };
    img.src = url;
  });
};

/* ---------- 下载 Blob 为文件 ---------- */
SG.downloadBlob = (blob, filename) => {
  const a = document.createElement('a');
  const u = URL.createObjectURL(blob);
  a.href = u; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(u); }, 800);
};
