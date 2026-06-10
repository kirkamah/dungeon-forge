import { openDB } from 'idb';

const DB_NAME = 'dungeon-forge';
const DB_VERSION = 1;
const TILE_STORE = 'tiles';

let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(TILE_STORE)) {
          d.createObjectStore(TILE_STORE);
        }
      },
    });
  }
  return dbPromise;
}

export async function saveTileImage(tileId, blob) {
  const d = await db();
  await d.put(TILE_STORE, blob, tileId);
}

export async function getTileImage(tileId) {
  const d = await db();
  return d.get(TILE_STORE, tileId);
}

export async function deleteTileImage(tileId) {
  const d = await db();
  await d.delete(TILE_STORE, tileId);
}

const urlCache = new Map();

export async function getTileImageURL(tileId) {
  if (urlCache.has(tileId)) return urlCache.get(tileId);
  const blob = await getTileImage(tileId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(tileId, url);
  return url;
}

export function invalidateTileImageURL(tileId) {
  const url = urlCache.get(tileId);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(tileId);
  }
}
