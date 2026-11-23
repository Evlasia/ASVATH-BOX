const DB_NAME = 'asvath-box-lista';
const DB_VERSION = 2;
let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('bens')) db.createObjectStore('bens', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('fila')) db.createObjectStore('fila', { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function all(name) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(name).objectStore(name).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function replaceAll(name, records) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    const store = tx.objectStore(name);
    store.clear();
    records.forEach((record) => store.put(record));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function enqueue(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction('fila', 'readwrite').objectStore('fila').add(item);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function clearQueueItem(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction('fila', 'readwrite').objectStore('fila').delete(id);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

export const offlineStore = { all, replaceAll, enqueue, clearQueueItem };
