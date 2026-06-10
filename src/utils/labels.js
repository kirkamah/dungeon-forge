// Localized display labels for tiles and tile sets.

// A tile's label: its custom name, or — for nameless (starter) tiles — the
// localized tile-type label.
export function tileLabel(tile, t) {
  if (!tile) return '';
  return tile.name || (tile.type ? t(`type${tile.type}`) : '');
}

// A tile set's label: the localized system name for the built-in starter set,
// otherwise the user-given name.
export function tileSetLabel(set, t) {
  if (!set) return '';
  return set.starter ? t('starterSetName') : set.name;
}
