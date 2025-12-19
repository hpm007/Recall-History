import { openDB } from 'idb';

const STORE_NAME = 'pages';
const dbPromise = openDB('summarizeRecallDB', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'url' });
    }
  },
});

export async function getAllPages() {
  const db = await dbPromise;
  return await db.getAll(STORE_NAME);
}

export async function getPageByUrl(url) {
  const db = await dbPromise;
  return db.get(STORE_NAME, url);
}

export async function upsertPage(pageObj) {
  // pageObj must contain url
  const db = await dbPromise;
  await db.put(STORE_NAME, pageObj);
}

export async function deletePage(url) {
  const db = await dbPromise;
  return db.delete(STORE_NAME, url);
}