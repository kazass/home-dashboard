const DB_NAME = 'home-dashboard';
const DB_VERSION = 4;
const STORES = [
  'events', 'notes', 'shoppingItems', 'homeWork', 'scheduling',
  'maintenanceJobs', 'ideas', 'plants', 'recipes', 'mealPlans', 'photos', 'goals',
  'completions', 'activities',
];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const dbReady = openDB();

async function dbGetAll(store) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(store, id) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(store, value) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(store, id) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbClear(store) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Replaces every application store in one IndexedDB transaction. If any clear
// or put fails, IndexedDB rolls the whole transaction back instead of leaving
// a half-restored backup behind.
async function dbReplaceAll(recordsByStore) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Database restore failed'));
    tx.onabort = () => reject(tx.error || new Error('Database restore was rolled back'));

    for (const storeName of STORES) {
      const store = tx.objectStore(storeName);
      store.clear();
      for (const record of recordsByStore[storeName] || []) store.put(record);
    }
  });
}

window.HD_DB = { dbReady, dbGetAll, dbGet, dbPut, dbDelete, dbClear, dbReplaceAll, STORES };
