import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import {
  THEMES, getTheme, setTheme,
  getScale, setScale, MIN_SCALE, MAX_SCALE,
  getMapsDir, setMapsDir,
} from '../storage/settings.js';

export default function SettingsModal({ onClose }) {
  const { t, lang, setLang, languages } = useI18n();
  const [theme, setThemeState] = useState(() => getTheme());
  const [scale, setScaleState] = useState(() => getScale());
  const [mapsDir, setMapsDirState] = useState(() => getMapsDir());

  const desktop = typeof window !== 'undefined' && window.dungeonForge?.isDesktop;

  const pickTheme = (id) => { setTheme(id); setThemeState(id); };
  const changeScale = (v) => { setScale(v); setScaleState(v); };

  const chooseFolder = async () => {
    if (!desktop || !window.dungeonForge.chooseFolder) return;
    const dir = await window.dungeonForge.chooseFolder();
    if (dir) { setMapsDir(dir); setMapsDirState(dir); }
  };

  const Section = ({ title, children }) => (
    <div className="border-t border-forge-border pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
      <div className="label mb-2">{title}</div>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        className="panel w-[min(520px,100%)] max-h-[85vh] overflow-y-auto bg-forge-panel2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-forge-border sticky top-0 bg-forge-panel2 z-10">
          <h2 className="font-medieval text-xl text-forge-gold tracking-wide">{t('settings')}</h2>
          <button className="btn-ghost" onClick={onClose} title={t('close')}>✕</button>
        </div>

        <div className="px-4 py-3">
          {/* Language */}
          <Section title={t('language')}>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(languages).map(([code, meta]) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={`px-3 py-1.5 rounded border text-sm font-bold tracking-wider ${
                    lang === code
                      ? 'bg-forge-gold text-forge-onAccent border-forge-gold'
                      : 'border-forge-border text-forge-parchment hover:border-forge-gold hover:text-forge-gold'
                  }`}
                >
                  {meta.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Theme */}
          <Section title={t('theme')}>
            <div className="flex gap-2 flex-wrap">
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  onClick={() => pickTheme(th.id)}
                  title={t(th.labelKey)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    theme === th.id
                      ? 'border-forge-gold bg-forge-gold/15 text-forge-ink'
                      : 'border-forge-border text-forge-parchment hover:border-forge-gold'
                  }`}
                >
                  <span className="flex overflow-hidden rounded-full border border-black/40">
                    {th.swatch.map((c, i) => (
                      <span key={i} className="w-3 h-4 block" style={{ background: c }} />
                    ))}
                  </span>
                  {t(th.labelKey)}
                </button>
              ))}
            </div>
          </Section>

          {/* UI scale */}
          <Section title={`${t('uiScale')}: ${Math.round(scale * 100)}%`}>
            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.05}
              value={scale}
              onChange={(e) => changeScale(parseFloat(e.target.value))}
              className="w-full"
            />
          </Section>

          {/* Maps folder */}
          <Section title={t('mapsFolder')}>
            <div className="text-xs text-forge-parchment/70 mb-2">{t('mapsFolderHint')}</div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 text-sm text-forge-ink truncate input py-1.5" title={mapsDir || t('folderNotSet')}>
                {mapsDir || <span className="text-forge-parchment/60">{t('folderNotSet')}</span>}
              </div>
              <button className="btn-ghost whitespace-nowrap" onClick={chooseFolder} disabled={!desktop}>
                {t('chooseFolder')}
              </button>
            </div>
          </Section>

          {/* About */}
          <div
            className="about-credit mt-4 pt-3 border-t border-forge-border text-center leading-relaxed"
            title="© 2026 Kirkamah · no harm org — All rights reserved."
          >
            <div className="text-xl">☮</div>
            <div className="text-base font-bold tracking-wide">no harm org</div>
            <div className="text-xs text-forge-parchment/70">{t('aboutAuthor')}: <b className="text-forge-ink">Kirkamah</b></div>
            <div className="text-[11px] text-forge-parchment/50 mt-0.5">© 2026 · {t('aboutRights')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
