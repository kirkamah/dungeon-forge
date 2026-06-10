import { N, E, S, W, openCount, defaultOpeningsFor } from '../engine/tileRules.js';
import { useI18n } from '../i18n/I18nContext.jsx';

const SIDES = [
  { side: N, label: 'N', nameKey: 'sideN', row: 1, col: 2 },
  { side: E, label: 'E', nameKey: 'sideE', row: 2, col: 3 },
  { side: S, label: 'S', nameKey: 'sideS', row: 3, col: 2 },
  { side: W, label: 'W', nameKey: 'sideW', row: 2, col: 1 },
];

export default function OpeningsEditor({ value, onChange, type, previewUrl }) {
  const { t } = useI18n();
  const toggle = (side) => {
    const mask = 1 << side;
    onChange(value ^ mask);
  };
  const isOpen = (side) => (value & (1 << side)) !== 0;
  const handleReset = () => onChange(defaultOpeningsFor(type));

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-4">
        <div
          className="grid gap-1 select-none"
          style={{
            gridTemplateColumns: 'repeat(3, 56px)',
            gridTemplateRows: 'repeat(3, 56px)',
          }}
        >
          {SIDES.map(({ side, label, nameKey, row, col }) => (
            <button
              key={side}
              onClick={() => toggle(side)}
              style={{ gridRow: row, gridColumn: col }}
              type="button"
              className={`rounded border flex flex-col items-center justify-center text-xs font-bold transition ${
                isOpen(side)
                  ? 'bg-forge-gold text-forge-onAccent border-forge-gold shadow-gold'
                  : 'bg-forge-bg text-forge-parchment border-forge-border hover:border-forge-gold'
              }`}
              title={isOpen(side) ? t('openSide', { side: t(nameKey) }) : t('closedSide', { side: t(nameKey) })}
            >
              <span>{label}</span>
              <span className="text-base leading-none">{isOpen(side) ? '◌' : '▮'}</span>
            </button>
          ))}
          <div
            style={{ gridRow: 2, gridColumn: 2 }}
            className="bg-forge-panel border border-forge-border rounded overflow-hidden flex items-center justify-center"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] text-forge-parchment/60 text-center px-1 leading-tight">
                {t(`type${type}`)}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 text-xs space-y-1">
          <div className="text-forge-gold uppercase tracking-wider text-[10px]">{t('openings')}</div>
          <div className="text-forge-parchment/80">{t('openingsHint')}</div>
          <div className="text-forge-parchment/70">{t('openCount', { n: openCount(value) })}</div>
          <button
            type="button"
            onClick={handleReset}
            className="text-forge-parchment/70 hover:text-forge-gold underline text-xs"
          >
            {t('resetDefault')}
          </button>
        </div>
      </div>
    </div>
  );
}
