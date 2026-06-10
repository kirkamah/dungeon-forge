// Side indices: 0=N, 1=E, 2=S, 3=W
export const N = 0, E = 1, S = 2, W = 3;
export const SIDES = [N, E, S, W];
export const SIDE_NAMES = ['N', 'E', 'S', 'W'];

// Each tile type has a base "openings" mask (bit per side) at rotation=0
// 1 = open, 0 = closed
function mask(...sides) {
  let m = 0;
  for (const s of sides) m |= (1 << s);
  return m;
}

export const TILE_TYPES = {
  STRAIGHT:    { label: 'Straight',     openings: mask(N, S),       size: 1, configurableOpenings: false },
  CORNER:      { label: 'Corner',       openings: mask(N, E),       size: 1, configurableOpenings: false },
  T_JUNCTION:  { label: 'T-Junction',   openings: mask(N, E, S),    size: 1, configurableOpenings: false },
  CROSSROADS:  { label: 'Crossroads',   openings: mask(N, E, S, W), size: 1, configurableOpenings: false },
  DEAD_END:    { label: 'Dead End',     openings: mask(N),          size: 1, configurableOpenings: false },
  ROOM_SMALL:  { label: 'Room (small)', openings: mask(N, E, S, W), size: 1, configurableOpenings: true,  minOpen: 1 },
  ROOM_LARGE:  { label: 'Room (large)', openings: mask(N, E, S, W), size: 1, configurableOpenings: true,  minOpen: 1 },
  ENTRANCE:    { label: 'Entrance',     openings: mask(N),          size: 1, configurableOpenings: false },
  EXIT:        { label: 'Exit',         openings: mask(N),          size: 1, configurableOpenings: false },
};

export const TILE_TYPE_KEYS = Object.keys(TILE_TYPES);

// Rotate an openings mask clockwise by `rot` quarter-turns.
// Side i at rotation rot corresponds to base side (i - rot) mod 4.
export function rotateMask(m, rot) {
  let r = 0;
  for (let i = 0; i < 4; i++) {
    const base = (i - rot + 4) % 4;
    if (m & (1 << base)) r |= (1 << i);
  }
  return r;
}

// A tile's openings — either user-configured or the type default.
export function effectiveOpenings(tile) {
  if (tile && tile.openings != null) return tile.openings;
  return TILE_TYPES[tile.type].openings;
}

// Effective openings of a tile after rotation.
export function tileOpeningsAtRot(tile, rot) {
  return rotateMask(effectiveOpenings(tile), rot);
}

// Default opening mask for a type (used in editor as initial state).
export function defaultOpeningsFor(type) {
  return TILE_TYPES[type].openings;
}

// Count open sides in a mask.
export function openCount(m) {
  let n = 0;
  for (let i = 0; i < 4; i++) if (m & (1 << i)) n++;
  return n;
}

export const OPPOSITE = [S, W, N, E]; // opposite of N=S, E=W, S=N, W=E
