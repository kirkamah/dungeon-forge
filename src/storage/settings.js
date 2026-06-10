// App-wide settings: theme, UI scale (font size), and the folder maps export to.
// Persisted in localStorage; applied to the document on load.

const THEME_KEY = 'df.theme';
const SCALE_KEY = 'df.uiScale';
const MAPS_DIR_KEY = 'df.mapsDir';

// Available themes. `swatch` = [background, accent, ink] preview colors.
export const THEMES = [
  { id: 'dark', labelKey: 'themeDark', swatch: ['#1a1a2e', '#e2b04a', '#e8e0c8'] },
  { id: 'light', labelKey: 'themeLight', swatch: ['#e6dfcd', '#a1761f', '#262016'] },
  { id: 'space', labelKey: 'themeSpace', swatch: ['#0e0c24', '#a877ff', '#e8e4ff'] },
  { id: 'acid', labelKey: 'themeAcid', swatch: ['#0a100a', '#8cf03c', '#dcf0c8'] },
];

const THEME_IDS = THEMES.map((t) => t.id);

// Цвет полосы заголовка окна (фон + кнопки) для каждой темы — берём панель и текст.
const THEME_TITLEBAR = {
  dark: { color: '#1a1a2e', symbol: '#e8e0c8' },
  light: { color: '#eee7d5', symbol: '#262016' },
  space: { color: '#0e0c24', symbol: '#e8e4ff' },
  acid: { color: '#0c140c', symbol: '#dcf0c8' },
};

export const MIN_SCALE = 0.85;
export const MAX_SCALE = 1.5;

export function getTheme() {
  const t = localStorage.getItem(THEME_KEY);
  return THEME_IDS.includes(t) ? t : 'dark';
}

export function setTheme(id) {
  const theme = THEME_IDS.includes(id) ? id : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(id) {
  const theme = THEME_IDS.includes(id) ? id : 'dark';
  document.documentElement.dataset.theme = theme;
  const tb = THEME_TITLEBAR[theme];
  if (tb && typeof window !== 'undefined' && window.dungeonForge?.setTitleBar) {
    window.dungeonForge.setTitleBar(tb.color, tb.symbol);
  }
}

export function getScale() {
  const s = parseFloat(localStorage.getItem(SCALE_KEY));
  if (Number.isNaN(s)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

export function setScale(scale) {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  localStorage.setItem(SCALE_KEY, String(s));
  applyScale(s);
}

// Scale the whole UI by adjusting the root font size (Tailwind sizes are rem).
export function applyScale(scale) {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale || 1));
  document.documentElement.style.fontSize = `${Math.round(16 * s)}px`;
}

export function getMapsDir() {
  return localStorage.getItem(MAPS_DIR_KEY) || '';
}

export function setMapsDir(dir) {
  if (dir) localStorage.setItem(MAPS_DIR_KEY, dir);
  else localStorage.removeItem(MAPS_DIR_KEY);
}

// Apply persisted theme + scale as early as possible.
export function initSettings() {
  applyTheme(getTheme());
  applyScale(getScale());
}
