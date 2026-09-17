/* 拾光 · IndexedDB 底层封装 */
window.SG = window.SG || {};

SG.db = (() => {
  const DB_NAME = 'shiguang';
  const VERSION = 1;
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('entries')) {
          const s = db.createObjectStore('entries', { keyPath: 'id' });
          s.createIndex('ts', 'ts');
          s.createIndex('kind', 'kind');
        }
        if (!db.objectStoreNames.contains('photos')) {
          const p = db.createObjectStore('photos', { keyPath: 'id' });
          p.createIndex('entryId', 'entryId');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function store(name, mode) {
    return open().then((db) => db.transaction(name, mode).objectStore(name));
  }
  function done(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return {
    open,
    get: (name, key) => store(name, 'readonly').then((s) => done(s.get(key))),
    getAll: (name) => store(name, 'readonly').then((s) => done(s.getAll())),
    put: (name, val) => store(name, 'readwrite').then((s) => done(s.put(val))),
    del: (name, key) => store(name, 'readwrite').then((s) => done(s.delete(key))),
    clear: (name) => store(name, 'readwrite').then((s) => done(s.clear())),
    byIndex: (name, index, value) => store(name, 'readonly').then((s) => done(s.index(index).getAll(value))),
    count: (name) => store(name, 'readonly').then((s) => done(s.count())),
  };
})();
