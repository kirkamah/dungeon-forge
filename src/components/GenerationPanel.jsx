import { useMemo, useState } from 'react';
import { MAP_SIZES } from '../engine/gridUtils.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { TILE_TYPE_KEYS } from '../engine/tileRules.js';

const PATH_TYPES = ['STRAIGHT', 'CORNER', 'T_JUNCTION', 'CROSSROADS', 'ROOM_SMALL', 'ROOM_LARGE'];

const SHAPES = ['Linear', 'Sprawl', 'Spiral', 'Web'];
const SIZE_LABEL_KEYS = { S: 'sizeSmall', M: 'sizeMedium', L: 'sizeLarge', XL: 'sizeHuge' };
const SHAPE_LABEL_KEYS = { Linear: 'shapeLinear', Sprawl: 'shapeSprawl', Spiral: 'shapeSpiral', Web: 'shapeWeb' };

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="label block mb-1">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-forge-parchment/50 mt-0.5">{hint}</div>}
    </div>
  );
}

function NumberRow({ label, value, min, max, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <label className="label flex-1">{label}</label>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-6 h-6 rounded bg-forge-bg border border-forge-border text-forge-gold hover:border-forge-gold"
      >−</button>
      <span className="font-mono w-6 text-center text-forge-gold">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-6 h-6 rounded bg-forge-bg border border-forge-border text-forge-gold hover:border-forge-gold"
      >+</button>
    </div>
  );
}

function ChecklistRow({ ok, required, label, count, hint }) {
  const color = ok ? 'text-green-400' : required ? 'text-red-400' : 'text-forge-parchment/60';
  const icon = ok ? '✓' : required ? '✗' : '○';
  return (
    <div className={`text-xs flex items-center gap-2 ${color}`}>
      <span className="font-bold w-3">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono">{count}</span>
      <span className="text-[9px] uppercase tracking-wider opacity-70">{hint}</span>
    </div>
  );
}

function SliderRow({ label, value, min, max, step = 1, onChange, suffix = '', hint }) {
  return (
    <div>
      <div className="flex justify-between items-center">
        <label className="label">{label}</label>
        <span className="font-mono text-forge-gold text-sm">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      {hint && <div className="text-[10px] text-forge-parchment/50 mt-0.5 leading-tight">{hint}</div>}
    </div>
  );
}

export default function GenerationPanel({
  params,
  onChange,
  onGenerate,
  onRegenerate,
  generating,
  generated,
  onSaveMap,
  tileSetName,
  tileSet,
  onNewBlankMap,
  onClearMap,
  onExportPNG,
}) {
  const { t } = useI18n();
  const [mapName, setMapName] = useState('');
  const [copied, setCopied] = useState(false);

  const typeCounts = useMemo(() => {
    const map = {};
    for (const k of TILE_TYPE_KEYS) map[k] = 0;
    for (const tile of tileSet?.tiles || []) map[tile.type] = (map[tile.type] || 0) + 1;
    return map;
  }, [tileSet]);

  const hasEntrance = typeCounts.ENTRANCE > 0;
  const hasExit = typeCounts.EXIT > 0;
  const hasPath = PATH_TYPES.some((k) => typeCounts[k] > 0);
  const canGenerate = hasEntrance && hasExit && hasPath;
  const blockedReason = !hasEntrance ? t('err_missingEntrance')
    : !hasExit ? t('err_missingExit')
    : !hasPath ? t('err_missingPath')
    : '';

  const set = (patch) => onChange({ ...params, ...patch });

  const handleCopySeed = async () => {
    if (!generated?.seed) return;
    try {
      await navigator.clipboard.writeText(generated.seed);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="panel-header">{t('generation')}</div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-sm">
        <div className="text-xs text-forge-parchment/70">
          {t('activeSet')} <span className="text-forge-gold">{tileSetName || '—'}</span>
        </div>

        <div className="bg-forge-bg/60 border border-forge-border rounded p-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-forge-gold">
            {t('tileChecklist')}
          </div>
          <ChecklistRow ok={hasEntrance} required label={`${t('typeENTRANCE')}`} count={typeCounts.ENTRANCE} hint={t('required')} />
          <ChecklistRow ok={hasExit} required label={`${t('typeEXIT')}`} count={typeCounts.EXIT} hint={t('required')} />
          <ChecklistRow ok={hasPath} required label={`${t('typeSTRAIGHT')} / ${t('typeCORNER')} / …`} count={PATH_TYPES.reduce((s, k) => s + typeCounts[k], 0)} hint={t('required')} />
          <ChecklistRow ok={typeCounts.T_JUNCTION > 0} label={t('typeT_JUNCTION')} count={typeCounts.T_JUNCTION} hint={t('recommended')} />
          <ChecklistRow ok={typeCounts.CROSSROADS > 0} label={t('typeCROSSROADS')} count={typeCounts.CROSSROADS} hint={t('recommended')} />
          <ChecklistRow ok={typeCounts.DEAD_END > 0} label={t('typeDEAD_END')} count={typeCounts.DEAD_END} hint={t('optional')} />
          <ChecklistRow ok={typeCounts.ROOM_SMALL + typeCounts.ROOM_LARGE > 0} label={`${t('typeROOM_SMALL')} / ${t('typeROOM_LARGE')}`} count={typeCounts.ROOM_SMALL + typeCounts.ROOM_LARGE} hint={t('optional')} />
        </div>

        <Field label={t('mapSize')}>
          <div className="grid grid-cols-4 gap-1">
            {Object.entries(MAP_SIZES).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => set({ size: key })}
                className={`px-2 py-1 rounded border text-xs ${
                  params.size === key
                    ? 'bg-forge-gold text-forge-onAccent border-forge-gold'
                    : 'border-forge-border text-forge-parchment hover:border-forge-gold'
                }`}
                title={`${t(SIZE_LABEL_KEYS[key])} — ${meta.dim}×${meta.dim}`}
              >
                {key}
              </button>
            ))}
          </div>
        </Field>

        {params.shape === 'Spiral' || params.shape === 'Web' ? (
          <div className="text-[11px] text-forge-parchment/60 italic">{t('entrancesSingleHint')}</div>
        ) : (
          <NumberRow label={t('entrances')} value={params.entrances} min={1} max={4} onChange={(v) => set({ entrances: v })} />
        )}
        <NumberRow label={t('exits')} value={params.exits} min={1} max={4} onChange={(v) => set({ exits: v })} />

        <SliderRow
          label={t('complexity')}
          value={params.complexity}
          min={1}
          max={5}
          onChange={(v) => set({ complexity: v })}
          hint={t('complexityHint')}
        />
        <SliderRow
          label={t('roomDensity')}
          value={params.roomDensity}
          min={0}
          max={100}
          onChange={(v) => set({ roomDensity: v })}
          suffix="%"
          hint={t('roomDensityHint')}
        />

        <Field label={t('shape')}>
          <div className="grid grid-cols-2 gap-1">
            {SHAPES.map((s) => (
              <button
                key={s}
                onClick={() => set({ shape: s })}
                className={`px-2 py-1 rounded border text-xs ${
                  params.shape === s
                    ? 'bg-forge-gold text-forge-onAccent border-forge-gold'
                    : 'border-forge-border text-forge-parchment hover:border-forge-gold'
                }`}
              >
                {t(SHAPE_LABEL_KEYS[s])}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('seed')} hint={t('seedHint')}>
          <input
            value={params.seed}
            onChange={(e) => set({ seed: e.target.value })}
            className="input w-full font-mono text-sm"
            placeholder={t('seedPlaceholder')}
          />
        </Field>

        <div className="space-y-2 pt-2">
          <button
            className="btn-gold w-full !py-2.5 text-base"
            onClick={onGenerate}
            disabled={generating || !canGenerate}
            title={!canGenerate ? blockedReason : t('generateHotkey')}
          >
            {generating ? t('forging') : t('generateDungeon')}
          </button>
          {!canGenerate && (
            <div className="text-[11px] text-red-400">{t('cannotGenerate')}</div>
          )}
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={onRegenerate} disabled={generating || !canGenerate}>
              {t('regenerate')}
            </button>
            <button className="btn-ghost flex-1" onClick={handleCopySeed} disabled={!generated}>
              {copied ? t('copied') : t('copySeed')}
            </button>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={onNewBlankMap}>
              {t('newBlankMap')}
            </button>
            <button className="btn-ghost flex-1" onClick={onClearMap} disabled={!generated}>
              {t('clearMap')}
            </button>
          </div>
        </div>

        <div className="border-t border-forge-border pt-3 mt-3 space-y-2">
          <div className="label">{t('saveCurrentMap')}</div>
          <input
            value={mapName}
            onChange={(e) => setMapName(e.target.value)}
            placeholder={t('mapName')}
            className="input w-full"
          />
          <button
            className="btn-gold w-full"
            disabled={!generated}
            onClick={() => { onSaveMap(mapName.trim()); setMapName(''); }}
            title={t('saveHotkey')}
          >
            {t('saveToLibrary')}
          </button>
        </div>

        <div className="border-t border-forge-border pt-3 mt-3 space-y-2">
          <div className="label">{t('export')}</div>
          <button
            className="btn-ghost w-full"
            disabled={!generated}
            onClick={onExportPNG}
            title={t('exportHotkey')}
          >
            {t('exportPNG')}
          </button>
        </div>
      </div>
    </div>
  );
}
