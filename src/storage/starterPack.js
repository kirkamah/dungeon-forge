// Loads the bundled "starter pack" tile set shipped in /public/starter-pack.
// The pack is described by manifest.json; each entry points at an image file
// and declares its tile type (+ optional openings mask). This lets the app ship
// a ready-to-use set of tiles the user provides, available from first launch.

import { saveTileImage } from './tileStorage.js';
import { uid } from './mapStorage.js';

function packUrl(file) {
  // Encode the file name — pack files may have non-ASCII (Cyrillic) names.
  return `${import.meta.env.BASE_URL}starter-pack/${encodeURIComponent(file)}`;
}

// Reads the manifest. Returns { name, description, tiles: [...] } or null if
// there is no usable pack (missing manifest or empty tile list).
export async function readStarterManifest() {
  try {
    const res = await fetch(packUrl('manifest.json'));
    if (!res.ok) return null;
    const manifest = await res.json();
    if (!manifest || !Array.isArray(manifest.tiles) || manifest.tiles.length === 0) return null;
    return manifest;
  } catch {
    return null;
  }
}

// Builds a tile set object (and stores each tile image in IndexedDB) from the
// bundled pack. Returns the tile set or null if there's nothing to load.
export async function loadStarterPack() {
  const manifest = await readStarterManifest();
  if (!manifest) return null;

  const tiles = [];
  for (const entry of manifest.tiles) {
    if (!entry || !entry.file || !entry.type) continue;
    try {
      const res = await fetch(packUrl(entry.file));
      if (!res.ok) continue;
      const blob = await res.blob();
      const id = uid('tl');
      await saveTileImage(id, blob);
      tiles.push({
        id,
        type: entry.type,
        // Starter tiles stay nameless so the UI shows the localized type label.
        name: entry.name || '',
        openings: entry.openings != null ? entry.openings : null,
        createdAt: Date.now(),
      });
    } catch {
      /* skip a bad entry, keep the rest */
    }
  }

  if (tiles.length === 0) return null;
  return {
    id: uid('ts'),
    name: manifest.name || 'Starter Pack',
    description: manifest.description || '',
    starter: true, // system-provided set — name is localized in the UI
    tiles,
    createdAt: Date.now(),
  };
}
