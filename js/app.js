/* 拾光 · 应用入口：初始化 / 底部导航 / 数据变化刷新 */
(function () {
  const PAGES = ['today', 'timeline', 'stats', 'me'];
  let current = 'today';

  function renderCurrent() {
    const root = document.getElementById('page-' + current);
    if (root && SG.pages[current]) SG.pages[current].render(root);
  }

  function show(name) {
    current = name;
    PAGES.forEach((p) => {
      const el = document.getElementById('page-' + p);
      if (el) el.style.display = (p === name) ? '' : 'none';
    });
    SG.$$('#tabbar .tab').forEach((b) => {
      b.classList.toggle('on', b.getAttribute('data-page') === name);
    });
    window.scrollTo(0, 0);
    renderCurrent();
  }

  async function init() {
    try {
      await SG.db.open();
    } catch (err) {
      console.error(err);
      document.body.innerHTML =
        '<div style="padding:48px 24px;text-align:center;color:#7a6753;font-size:15px;line-height:2">' +
        '🐹 这个浏览器不支持本地数据存储（可能处于无痕模式）。<br>请换一个正常窗口的浏览器打开拾光。</div>';
      return;
    }

    SG.$$('#tabbar .tab').forEach((b) => {
      b.addEventListener('click', () => show(b.getAttribute('data-page')));
    });
    const fab = document.getElementById('fab');
    if (fab) fab.addEventListener('click', () => SG.composer.open({}));

    SG.on('changed', renderCurrent);
    show('today');

    /* PWA：仅在 http(s) 环境注册（file:// 打开时跳过） */
    if ('serviceWorker' in navigator &&
        (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
