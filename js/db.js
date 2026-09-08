const DB_NAME = window.HD_DATABASE_NAME || 'home-dashboard';
const DB_VERSION = 5;
const STORES = [
  'events', 'notes', 'shoppingItems', 'homeWork', 'scheduling',
  'maintenanceJobs', 'ideas', 'plants', 'recipes', 'mealPlans', 'photos', 'goals',
  'completions', 'activities', 'sales',
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
    req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result); };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Close other Home Dashboard tabs and reload to finish the update."));
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

    try {
      for (const storeName of STORES) {
        const store = tx.objectStore(storeName);
        store.clear();
        for (const record of recordsByStore[storeName] || []) store.put(record);
      }
    } catch (err) {
      // put() can throw synchronously (e.g. DataCloneError). Rejecting the
      // promise alone would leave earlier clears/writes free to commit.
      tx.abort();
      reject(err);
    }
  });
}

window.HD_DB = { dbReady, dbGetAll, dbGet, dbPut, dbDelete, dbClear, dbReplaceAll, STORES };
