/* 拾光 · Service Worker：离线缓存（加到主屏幕后断网也能用） */
const CACHE = 'shiguang-v1';
const CORE = ['./', './index.html', './css/style.css', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(CORE.map(async (u) => {
      try { await cache.add(u); } catch (err) { /* 单个失败不阻塞安装 */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const fontHost = /jsdelivr\.net$|fonts\./.test(url.hostname);
  if (!sameOrigin && !fontHost) return;

  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: sameOrigin });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone));
      }
      return res;
    } catch (err) {
      if (sameOrigin && req.mode === 'navigate') {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
