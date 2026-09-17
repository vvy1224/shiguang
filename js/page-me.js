/* 拾光 · 我的页：预算 / 备份恢复 / 关于 */
window.SG = window.SG || {};
SG.pages = SG.pages || {};

SG.pages.me = {
  render: async function (root) {
    SG.revokeURLs();
    const budget = (await SG.data.getSetting('monthlyBudget', 0)) || 0;
    const entryCount = await SG.db.count('entries');
    const photoCount = await SG.db.count('photos');

    root.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'page-head';
    head.innerHTML =
      '<div class="brand">我的</div>' +
      '<div class="page-sub">数据都存在这台手机里，只属于你</div>';
    root.appendChild(head);

    /* 预算 */
    const budgetCard = document.createElement('div');
    budgetCard.className = 'card section-card';
    budgetCard.innerHTML =
      '<div class="sec-title">每月预算</div>' +
      '<div class="budget-set">' +
      '  <span class="bs-rmb">¥</span>' +
      '  <input id="me-budget" class="cp-input" type="number" min="0" step="100" placeholder="比如 3000" value="' + (budget > 0 ? budget : '') + '">' +
      '  <button class="btn-primary" id="me-budget-save">保存</button>' +
      '</div>' +
      '<div class="sec-hint">设置后，今天页会显示预算进度条；填 0 或留空表示不设预算。</div>';
    root.appendChild(budgetCard);
    budgetCard.querySelector('#me-budget-save').addEventListener('click', async () => {
      const v = Math.max(0, Math.round(parseFloat(budgetCard.querySelector('#me-budget').value) || 0));
      await SG.data.setSetting('monthlyBudget', v);
      SG.ui.toast(v > 0 ? '预算已设为 ¥' + SG.fmtMoney(v) : '已取消预算');
    });

    /* 备份 */
    const backupCard = document.createElement('div');
    backupCard.className = 'card section-card';
    backupCard.innerHTML =
      '<div class="sec-title">备份与恢复</div>' +
      '<div class="sec-hint">备份文件包含全部记录和照片。建议定期导出，发到微信「文件传输助手」或网盘保存。</div>' +
      '<div class="backup-btns">' +
      '  <button class="btn-primary" id="me-export">导出备份</button>' +
      '  <button class="btn-plain" id="me-import-btn">导入恢复</button>' +
      '</div>' +
      '<input type="file" id="me-import" accept=".json,application/json" hidden>';
    root.appendChild(backupCard);

    backupCard.querySelector('#me-export').addEventListener('click', async () => {
      const btn = backupCard.querySelector('#me-export');
      btn.disabled = true;
      btn.textContent = '打包中…';
      try {
        const data = await SG.data.exportBackup();
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const d = new Date();
        const name = '拾光备份_' + SG.ymd(d).replace(/-/g, '') + '_' + SG.hhmm(d.getTime()).replace(':', '') + '.json';
        SG.downloadBlob(blob, name);
        SG.ui.toast('备份已导出 🎒');
      } catch (err) {
        console.error(err);
        SG.ui.toast('导出失败了，再试一次？');
      }
      btn.disabled = false;
      btn.textContent = '导出备份';
    });

    const fileInput = backupCard.querySelector('#me-import');
    backupCard.querySelector('#me-import-btn').addEventListener('click', () => { fileInput.value = ''; fileInput.click(); });
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      let obj = null;
      try { obj = JSON.parse(await f.text()); } catch (e) { obj = null; }
      if (!obj || obj.app !== 'shiguang') { SG.ui.toast('这不是有效的拾光备份文件'); return; }
      const ok = await SG.ui.confirmDialog({
        title: '用备份覆盖当前数据？',
        text: '导入后，手机上现在的记录会被备份里的内容替换（含 ' + (obj.entries || []).length + ' 条记录）。',
        okText: '覆盖导入', danger: true,
      });
      if (!ok) return;
      try {
        await SG.data.importBackup(obj, true);
        SG.ui.toast('恢复完成 🌈');
      } catch (err) {
        console.error(err);
        SG.ui.toast('恢复失败了');
      }
    });

    /* 关于 */
    const about = document.createElement('div');
    about.className = 'card section-card about';
    about.innerHTML =
      '<div class="about-name">拾光 <span class="about-ver">v1.0.0</span></div>' +
      '<div class="about-slogan">记账，也记日子。</div>' +
      '<div class="about-stat">本机共 ' + entryCount + ' 条记录 · ' + photoCount + ' 张照片</div>';
    root.appendChild(about);

    /* 危险区 */
    const danger = document.createElement('div');
    danger.className = 'danger-zone';
    danger.innerHTML = '<button class="btn-danger-plain" id="me-wipe">清空全部数据</button>';
    root.appendChild(danger);
    danger.querySelector('#me-wipe').addEventListener('click', async () => {
      const ok1 = await SG.ui.confirmDialog({
        title: '清空全部数据？',
        text: '所有记录和照片都会被删除，且无法恢复。',
        okText: '继续', danger: true,
      });
      if (!ok1) return;
      const ok2 = await SG.ui.confirmDialog({
        title: '真的要清空吗？',
        text: '建议先「导出备份」再清空。',
        okText: '确定清空', cancelText: '先不删', danger: true,
      });
      if (!ok2) return;
      await SG.data.wipeAll();
      SG.ui.toast('已清空，从今天重新开始 🌱');
    });
  },
};
