// Temporary on-device archive until the backend has a session materials endpoint.
// Client phone and bearer tokens are deliberately excluded from persisted records.
const databaseName = 'idel-presentation-archives';
const storeName = 'sessions';

function openArchiveDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('Локальное хранилище недоступно'));
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, run) {
  const db = await openArchiveDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = run(transaction.objectStore(storeName));
      let result;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      transaction.oncomplete = () => resolve(result);
    });
  } finally { db.close(); }
}

export async function saveSessionArchive(session, materials) {
  if (!session || !materials.favorites.length) return null;
  const record = {
    id: globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    mode: session.mode,
    managerName: session.manager?.name || null,
    favorites: JSON.parse(JSON.stringify(materials.favorites)),
    // Scene captures are temporary files owned by the Unreal session.
    screenshots: [],
    synced: false,
  };
  await transact('readwrite', store => store.put(record));
  return record.id;
}

export async function listSessionArchives() {
  const records = await transact('readonly', store => store.getAll());
  return records.map(({ id, createdAt, mode, managerName, favorites, screenshots, synced }) => ({ id, createdAt, mode, managerName, favoriteCount: favorites.length, screenshotCount: screenshots.length, synced }));
}

export const getSessionArchive = id => transact('readonly', store => store.get(id));
export const deleteSessionArchive = id => transact('readwrite', store => store.delete(id));
