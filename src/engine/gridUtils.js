import { N, E, S, W } from './tileRules.js';

export const MAP_SIZES = {
  S:  { label: 'Small',     dim: 8  },
  M:  { label: 'Medium',    dim: 12 },
  L:  { label: 'Large',     dim: 18 },
  XL: { label: 'Huge',      dim: 24 },
};

// Side -> delta (col, row)
export const DELTAS = {
  [N]: [0, -1],
  [E]: [1, 0],
  [S]: [0, 1],
  [W]: [-1, 0],
};

export function neighbor(x, y, side) {
  const [dx, dy] = DELTAS[side];
  return [x + dx, y + dy];
}

export function inBounds(x, y, dim) {
  return x >= 0 && y >= 0 && x < dim && y < dim;
}

export function makeGrid(dim) {
  return Array.from({ length: dim }, () => Array.from({ length: dim }, () => null));
}

// Mulberry32 PRNG — seedable, returns float [0,1)
export function makeRng(seedStr) {
  let h = 1779033703 ^ (seedStr ? seedStr.length : 0);
  const s = String(seedStr ?? Math.random());
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

export function pick(arr, rng) {
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
