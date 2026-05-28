export type AutoSaveEnvelope<T> = {
  schemaVersion: 1;
  saveVersion: 1;
  updatedAt: string;
  project: T;
};

const DB_NAME = "ff14-aoe-planner";
const DB_VERSION = 1;
const STORE_NAME = "projects";
const AUTO_SAVE_ID = "autosave";
const LEGACY_AUTO_SAVE_KEY = "ff14-aoe-planner/autosave/v1";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function normalizeStorageError(error: unknown): Error {
  if (error instanceof DOMException) {
    if (error.name === "QuotaExceededError") {
      return new Error("Auto Save failed: browser storage is full. Imported images or background images may be too large; export JSON as a backup, then remove unused images.");
    }
    return new Error(`Auto Save failed: ${error.name}. Export JSON as a backup before continuing.`);
  }
  return error instanceof Error ? error : new Error("Auto Save failed. Export JSON as a backup before continuing.");
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = run(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(normalizeStorageError(request.error));
    transaction.onerror = () => reject(normalizeStorageError(transaction.error));
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => {
      db.close();
      reject(normalizeStorageError(transaction.error));
    };
  });
}

function readLegacyAutoSave<T>(): AutoSaveEnvelope<T> | null {
  const raw = localStorage.getItem(LEGACY_AUTO_SAVE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as AutoSaveEnvelope<T>;
  if (parsed.schemaVersion !== 1 || !parsed.project) return null;
  return parsed;
}

export async function loadAutoSave<T>(): Promise<AutoSaveEnvelope<T> | null> {
  const stored = await withStore<AutoSaveEnvelope<T> & { id: string } | undefined>("readonly", (store) => store.get(AUTO_SAVE_ID));
  if (stored?.schemaVersion === 1 && stored.project) {
    const { id: _id, ...envelope } = stored;
    return envelope;
  }

  const legacy = readLegacyAutoSave<T>();
  if (legacy) {
    await saveAutoSave(legacy.project, legacy.updatedAt);
    localStorage.removeItem(LEGACY_AUTO_SAVE_KEY);
    return legacy;
  }
  return null;
}

export async function hasAutoSave(): Promise<boolean> {
  if (localStorage.getItem(LEGACY_AUTO_SAVE_KEY)) return true;
  const stored = await withStore<unknown | undefined>("readonly", (store) => store.get(AUTO_SAVE_ID));
  return Boolean(stored);
}

export async function saveAutoSave<T>(project: T, updatedAt = new Date().toISOString()): Promise<AutoSaveEnvelope<T>> {
  const envelope: AutoSaveEnvelope<T> = {
    schemaVersion: 1,
    saveVersion: 1,
    updatedAt,
    project,
  };
  try {
    await withStore("readwrite", (store) => store.put({ id: AUTO_SAVE_ID, ...envelope }));
    return envelope;
  } catch (error) {
    throw normalizeStorageError(error);
  }
}

export async function clearAutoSave(): Promise<void> {
  localStorage.removeItem(LEGACY_AUTO_SAVE_KEY);
  await withStore("readwrite", (store) => store.delete(AUTO_SAVE_ID));
}
