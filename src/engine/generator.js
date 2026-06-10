import {
  TILE_TYPES,
  effectiveOpenings,
  rotateMask,
  openCount,
  OPPOSITE,
  N, E, S, W,
} from './tileRules.js';
import {
  MAP_SIZES, makeGrid, makeRng, randomSeed, pick, neighbor, inBounds,
} from './gridUtils.js';

function tilesOfType(tileSet, type) {
  return (tileSet.tiles || []).filter((t) => t.type === type);
}

// Returns the opening mask of a placed cell on a given side.
function isCellOpen(cell, side) {
  if (cell.openings == null) {
    cell.openings = rotateMask(TILE_TYPES[cell.type].openings, cell.rot);
  }
  return (cell.openings & (1 << side)) !== 0;
}

// Enumerate candidate tile + rotation pairs that satisfy must-open / must-close
// constraints for a single cell.
function candidateTiles(tileSet, requiredOpen, requiredClosed, allowedTypes) {
  const allowed = new Set(allowedTypes);
  const out = [];
  for (const tile of tileSet.tiles) {
    if (!allowed.has(tile.type)) continue;
    const base = effectiveOpenings(tile);
    if (base == null) continue;
    for (let rot = 0; rot < 4; rot++) {
      const open = rotateMask(base, rot);
      if ((open & requiredOpen) !== requiredOpen) continue;
      if ((open & requiredClosed) !== 0) continue;
      out.push({ tile, rot, type: tile.type, openings: open });
    }
  }
  return out;
}

function constraints(grid, dim, x, y) {
  let mustOpen = 0;
  let mustClose = 0;
  for (const side of [N, E, S, W]) {
    const [nx, ny] = neighbor(x, y, side);
    if (!inBounds(nx, ny, dim)) { mustClose |= (1 << side); continue; }
    const nb = grid[ny][nx];
    if (!nb) continue;
    if (isCellOpen(nb, OPPOSITE[side])) mustOpen |= (1 << side);
    else mustClose |= (1 << side);
  }
  return { mustOpen, mustClose };
}

function frontier(grid, dim) {
  const out = [];
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      if (grid[y][x]) continue;
      for (const side of [N, E, S, W]) {
        const [nx, ny] = neighbor(x, y, side);
        if (!inBounds(nx, ny, dim)) continue;
        const nb = grid[ny][nx];
        if (nb && isCellOpen(nb, OPPOSITE[side])) {
          out.push({ x, y });
          break;
        }
      }
    }
  }
  return out;
}

// Corridors heavily dominate when room density is low. No cap on dead ends.
function weightType(type, params) {
  const { roomDensity, complexity } = params;
  switch (type) {
    case 'STRAIGHT':   return 80 + (100 - roomDensity) * 0.5;
    case 'CORNER':     return 55 + (100 - roomDensity) * 0.35;
    case 'T_JUNCTION': return 8 + complexity * 5;
    case 'CROSSROADS': return 2 + complexity * 2;
    case 'DEAD_END':   return 12;
    case 'ROOM_SMALL': return roomDensity * 0.5;
    case 'ROOM_LARGE': return roomDensity * 0.15;
    default: return 1;
  }
}

function pickWeighted(candidates, params, rng) {
  if (candidates.length === 0) return null;
  const weights = candidates.map((c) => weightType(c.type, params));
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return pick(candidates, rng);
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    if ((r -= weights[i]) <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

function startPosition(dim, rng, shape) {
  switch (shape) {
    case 'Spiral':
    case 'Web':
      return [Math.floor(dim / 2), Math.floor(dim / 2)];
    case 'Linear': {
      const edge = Math.floor(rng() * 4);
      const k = Math.floor(rng() * dim);
      if (edge === 0) return [k, 0];
      if (edge === 1) return [dim - 1, k];
      if (edge === 2) return [k, dim - 1];
      return [0, k];
    }
    case 'Sprawl':
    default: {
      const m = Math.floor(dim / 4);
      const x = m + Math.floor(rng() * (dim - 2 * m));
      const y = m + Math.floor(rng() * (dim - 2 * m));
      return [x, y];
    }
  }
}

function pickNextFrontier(front, dim, rng, shape) {
  if (front.length === 0) return null;
  if (shape === 'Spiral') {
    const cx = dim / 2, cy = dim / 2;
    front.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
    return front[0];
  }
  if (shape === 'Web') {
    const cx = dim / 2, cy = dim / 2;
    front.sort((a, b) => ((a.x - cx) ** 2 + (a.y - cy) ** 2) - ((b.x - cx) ** 2 + (b.y - cy) ** 2));
    return front[0];
  }
  return front[Math.floor(rng() * front.length)];
}

function placeCandidate(grid, x, y, type, rot, tile, openings) {
  grid[y][x] = { type, rot, variantId: tile.id, openings, x, y };
}

function rotationForOpening(tile, targetSide) {
  const base = effectiveOpenings(tile);
  for (let rot = 0; rot < 4; rot++) {
    if (rotateMask(base, rot) & (1 << targetSide)) return rot;
  }
  return 0;
}

function bestEntranceRot(tile, dim, sx, sy) {
  const base = effectiveOpenings(tile);
  for (let rot = 0; rot < 4; rot++) {
    const open = rotateMask(base, rot);
    let hasInbound = false;
    for (const side of [N, E, S, W]) {
      if (!(open & (1 << side))) continue;
      const [nx, ny] = neighbor(sx, sy, side);
      if (inBounds(nx, ny, dim)) hasInbound = true;
    }
    if (hasInbound) return rot;
  }
  return 0;
}

// After the main loop terminates, plug every remaining frontier cell so no
// neighbour has openings leaking into empty space.
function sealFrontier(tileSet, grid, dim, params, rng) {
  const placeable = [
    'STRAIGHT', 'CORNER', 'T_JUNCTION', 'CROSSROADS', 'DEAD_END',
    ...(params.roomDensity > 0 ? ['ROOM_SMALL', 'ROOM_LARGE'] : []),
  ];
  let safety = dim * dim * 4;
  while (safety-- > 0) {
    const front = frontier(grid, dim);
    if (front.length === 0) break;
    const cell = front[Math.floor(rng() * front.length)];
    const { mustOpen, mustClose } = constraints(grid, dim, cell.x, cell.y);
    const openSides = [N, E, S, W].filter((s) => (mustOpen & (1 << s)) !== 0);

    let candidates = candidateTiles(tileSet, mustOpen, mustClose, placeable);
    if (candidates.length === 0) {
      candidates = candidateTiles(tileSet, mustOpen, mustClose, ['DEAD_END']);
    }
    if (candidates.length === 0) {
      // No tile of any type satisfies the constraints (e.g. user only uploaded
      // STRAIGHT and we need a 3-side-open cell). Clear the offending neighbour
      // openings by removing the cell that points here — best effort.
      grid[cell.y][cell.x] = { type: '_BLOCKED', rot: 0, variantId: null, openings: 0, x: cell.x, y: cell.y };
      continue;
    }
    // When sealing a 1-opening cell, strongly prefer DEAD_END so the result
    // looks like a natural cap.
    let pool = candidates;
    if (openSides.length === 1) {
      const dends = candidates.filter((c) => c.type === 'DEAD_END');
      if (dends.length > 0) pool = dends;
    }
    const chosen = pickWeighted(pool, params, rng);
    placeCandidate(grid, cell.x, cell.y, chosen.type, chosen.rot, chosen.tile, chosen.openings);
  }
  // Strip blocked sentinels and any neighbour openings still pointing into them
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      if (grid[y][x] && grid[y][x].type === '_BLOCKED') grid[y][x] = null;
    }
  }
}

function generateOnce(tileSet, params, seed) {
  const rng = makeRng(seed);
  const dim = MAP_SIZES[params.size].dim;
  const grid = makeGrid(dim);

  const placeable = [
    'STRAIGHT', 'CORNER', 'T_JUNCTION', 'CROSSROADS', 'DEAD_END',
    ...(params.roomDensity > 0 ? ['ROOM_SMALL', 'ROOM_LARGE'] : []),
  ];

  const entranceVariants = tilesOfType(tileSet, 'ENTRANCE');
  if (entranceVariants.length === 0) return { ok: false, reasonKey: 'err_missingEntrance' };
  const exitVariants = tilesOfType(tileSet, 'EXIT');
  if (exitVariants.length === 0) return { ok: false, reasonKey: 'err_missingExit' };

  const hasAnyPath = placeable.some((t) => t !== 'DEAD_END' && tilesOfType(tileSet, t).length > 0);
  if (!hasAnyPath) return { ok: false, reasonKey: 'err_missingPath' };

  const placedEntrances = [];
  for (let i = 0; i < params.entrances; i++) {
    const [sx, sy] = startPosition(dim, rng, params.shape);
    if (grid[sy][sx]) continue;
    const v = pick(entranceVariants, rng);
    const rot = bestEntranceRot(v, dim, sx, sy);
    placeCandidate(grid, sx, sy, 'ENTRANCE', rot, v, rotateMask(effectiveOpenings(v), rot));
    placedEntrances.push({ x: sx, y: sy });
  }
  if (placedEntrances.length === 0) return { ok: false, reasonKey: 'err_noEntrancePlaced' };

  // Push coverage to ~70-95% of cells. Loop breaks naturally when frontier exhausts.
  const targetCells = Math.floor(dim * dim * (0.6 + params.complexity * 0.07));
  let placedCount = placedEntrances.length;

  let safety = dim * dim * 8;
  while (placedCount < targetCells && safety-- > 0) {
    const front = frontier(grid, dim);
    if (front.length === 0) break;
    const cell = pickNextFrontier(front, dim, rng, params.shape);
    const { mustOpen, mustClose } = constraints(grid, dim, cell.x, cell.y);

    let candidates = candidateTiles(tileSet, mustOpen, mustClose, placeable);
    if (candidates.length === 0) {
      candidates = candidateTiles(tileSet, mustOpen, mustClose, ['DEAD_END']);
    }
    if (candidates.length === 0) {
      grid[cell.y][cell.x] = { type: '_BLOCKED', rot: 0, variantId: null, openings: 0, x: cell.x, y: cell.y };
      continue;
    }
    // When this is the only surviving branch (frontier of 1), do not pick a
    // terminating tile if anything with ≥2 openings can fit — otherwise the
    // whole growth dies after 2-3 cells and the map stays tiny.
    if (front.length === 1) {
      const extending = candidates.filter((c) => openCount(c.openings) >= 2);
      if (extending.length > 0) candidates = extending;
    }
    const chosen = pickWeighted(candidates, params, rng);
    placeCandidate(grid, cell.x, cell.y, chosen.type, chosen.rot, chosen.tile, chosen.openings);
    placedCount++;
  }

  // Strip blocked-cell sentinels from the target-driven pass before sealing.
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      if (grid[y][x] && grid[y][x].type === '_BLOCKED') grid[y][x] = null;
    }
  }

  // Plug every remaining open end so no opening points into empty space.
  sealFrontier(tileSet, grid, dim, params, rng);

  // Find placed tiles whose effective openings are exactly 1 side. These are
  // natural dead-ends and the only safe spots for EXIT (replacing a multi-side
  // tile would leave neighbour openings staring into EXIT walls).
  const oneOpenCells = [];
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const t = grid[y][x];
      if (!t || t.type === 'ENTRANCE' || t.type === 'EXIT') continue;
      const open = t.openings;
      const opens = [N, E, S, W].filter((s) => (open & (1 << s)) !== 0);
      if (opens.length !== 1) continue;
      const distSq = Math.min(...placedEntrances.map((e) => (e.x - x) ** 2 + (e.y - y) ** 2));
      oneOpenCells.push({ x, y, side: opens[0], distSq });
    }
  }
  oneOpenCells.sort((a, b) => b.distSq - a.distSq);

  const placedExits = [];
  for (const c of oneOpenCells) {
    if (placedExits.length >= params.exits) break;
    const v = pick(exitVariants, rng);
    const rot = rotationForOpening(v, c.side);
    placeCandidate(grid, c.x, c.y, 'EXIT', rot, v, rotateMask(effectiveOpenings(v), rot));
    placedExits.push({ x: c.x, y: c.y });
  }

  if (placedExits.length === 0) return { ok: false, reasonKey: 'err_noExitFound' };

  // Recount actual placed tiles — sealFrontier may have added some, exits
  // replaced existing cells. Reject undergrown maps so the retry-loop in
  // generateDungeon tries a different seed.
  let finalCount = 0;
  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      if (grid[y][x]) finalCount++;
    }
  }
  const minAcceptable = Math.max(
    Math.floor(dim * dim * 0.3),
    Math.floor(targetCells * 0.55),
  );
  if (finalCount < minAcceptable) {
    return {
      ok: false,
      reasonKey: 'err_undergrown',
      grid,
      dim,
      seed,
      entrances: placedEntrances,
      exits: placedExits,
      placedCount: finalCount,
    };
  }

  return {
    ok: true,
    grid,
    dim,
    seed,
    entrances: placedEntrances,
    exits: placedExits,
    placedCount: finalCount,
  };
}

export function generateDungeon(tileSet, params) {
  if (!tileSet || !tileSet.tiles || tileSet.tiles.length === 0) {
    return { ok: false, reasonKey: 'err_activeSetEmpty' };
  }
  const baseSeed = (params.seed && params.seed.trim()) || randomSeed();
  let attempt = 0;
  let last = null;
  // Track the largest undergrown attempt — if all 10 tries fail the size gate,
  // we still want to show the user the best dungeon we managed to build rather
  // than a hard error.
  let bestUndergrown = null;
  while (attempt < 10) {
    const seed = attempt === 0 ? baseSeed : `${baseSeed}#${attempt}`;
    const res = generateOnce(tileSet, params, seed);
    if (res.ok) return res;
    if (res.reasonKey === 'err_undergrown' && res.grid) {
      if (!bestUndergrown || (res.placedCount ?? 0) > (bestUndergrown.placedCount ?? 0)) {
        bestUndergrown = res;
      }
    }
    last = res;
    attempt++;
  }
  if (bestUndergrown) {
    return { ...bestUndergrown, ok: true };
  }
  return last || { ok: false, reasonKey: 'err_generationFailed' };
}

export const DEFAULT_PARAMS = {
  size: 'M',
  entrances: 1,
  exits: 1,
  complexity: 3,
  roomDensity: 20,
  shape: 'Sprawl',
  seed: '',
};
