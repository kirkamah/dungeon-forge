const TILE_SETS_KEY = 'df.tileSets';
const ACTIVE_TILE_SET_KEY = 'df.activeTileSetId';
const SAVED_MAPS_KEY = 'df.savedMaps';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- Tile sets ----
export function listTileSets() {
  return read(TILE_SETS_KEY, []);
}

export function saveTileSets(sets) {
  write(TILE_SETS_KEY, sets);
}

export function getActiveTileSetId() {
  return read(ACTIVE_TILE_SET_KEY, null);
}

export function setActiveTileSetId(id) {
  write(ACTIVE_TILE_SET_KEY, id);
}

// ---- Saved maps ----
export function listSavedMaps() {
  return read(SAVED_MAPS_KEY, []);
}

export function saveSavedMaps(maps) {
  write(SAVED_MAPS_KEY, maps);
}
