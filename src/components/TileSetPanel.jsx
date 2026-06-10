import { useEffect, useMemo, useState } from 'react';
import { TILE_TYPE_KEYS, effectiveOpenings, N, E, S, W } from '../engine/tileRules.js';
import { getTileImageURL } from '../storage/tileStorage.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { tileLabel, tileSetLabel } from '../utils/labels.js';

function OpeningsBadge({ openings }) {
  // Tiny 3x3 grid showing which sides are open (yellow) vs closed (gray)
  const open = (s) => (openings & (1 << s)) !== 0;
  const cell = (active) => ({
    background: active ? '#e2b04a' : '#2a2a4a',
    width: 5,
    height: 5,
  });
  return (
    <div
      className="grid gap-px"
      style={{ gridTemplateColumns: 'repeat(3, 5px)', gridTemplateRows: 'repeat(3, 5px)' }}
      title={`N${open(N) ? '·' : '×'} E${open(E) ? '·' : '×'} S${open(S) ? '·' : '×'} W${open(W) ? '·' : '×'}`}
    >
      <div /><div style={cell(open(N))} /><div />
      <div style={cell(open(W))} /><div style={{ background: '#16213e', width: 5, height: 5 }} /><div style={cell(open(E))} />
      <div /><div style={cell(open(S))} /><div />
    </div>
  );
}

function TileThumb({ tile, onDelete, onEdit, onPick, isBrush, t }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancel = false;
    getTileImageURL(tile.id).then((u) => { if (!cancel) setUrl(u); });
    return () => { cancel = true; };
  }, [tile.id]);
  const openings = effectiveOpenings(tile);
  const label = tileLabel(tile, t);
  return (
    <div
      onClick={() => onPick(tile)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-df-tile', tile.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className={`relative group bg-forge-bg border rounded overflow-hidden cursor-pointer transition ${
        isBrush ? 'border-forge-gold shadow-gold' : 'border-forge-border hover:border-forge-gold/60'
      }`}
      title={`${label} — ${t('clickToPlace')}`}
    >
      <div className="w-full aspect-square bg-black/50 flex items-center justify-center pointer-events-none">
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <span className="text-forge-parchment/50 text-xs">…</span>
        )}
      </div>
      <div className="px-1 py-0.5 text-[10px] flex items-center gap-1 text-forge-parchment" title={label}>
        <OpeningsBadge openings={openings} />
        <span className="truncate flex-1">{label}</span>
      </div>
      <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(tile); }}
          className="w-5 h-5 flex items-center justify-center rounded bg-forge-gold text-forge-onAccent text-xs"
          title={t('editTile')}
        >
          ✎
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(tile.id); }}
          className="w-5 h-5 flex items-center justify-center rounded bg-forge-blood text-forge-ink text-xs"
          title={t('deleteAction')}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function TileSetPanel({
  tileSets,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onUploadClick,
  onDeleteTile,
  onEditTile,
  brush,
  onPickBrush,
}) {
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const active = useMemo(() => tileSets.find((t) => t.id === activeId), [tileSets, activeId]);

  const tilesByType = useMemo(() => {
    const map = {};
    for (const k of TILE_TYPE_KEYS) map[k] = [];
    (active?.tiles || []).forEach((t) => { (map[t.type] ||= []).push(t); });
    return map;
  }, [active]);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="panel-header flex items-center justify-between">
        <span>{t('tileSets')}</span>
        <button
          className="text-xs text-forge-parchment hover:text-forge-gold"
          onClick={() => setCreating((s) => !s)}
        >
          {t('newSet')}
        </button>
      </div>

      {creating && (
        <div className="px-3 py-2 border-b border-forge-border flex gap-2">
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder={t('setNamePlaceholder')}
            className="input flex-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draftName.trim()) {
                onCreate(draftName.trim());
                setDraftName('');
                setCreating(false);
              } else if (e.key === 'Escape') {
                setCreating(false);
                setDraftName('');
              }
            }}
          />
          <button
            className="btn-gold !py-1 !px-2 text-xs"
            onClick={() => {
              if (draftName.trim()) {
                onCreate(draftName.trim());
                setDraftName('');
                setCreating(false);
              }
            }}
          >
            {t('add')}
          </button>
        </div>
      )}

      <div className="border-b border-forge-border max-h-44 overflow-y-auto">
        {tileSets.map((set) => {
          const isActive = set.id === activeId;
          const isRenaming = renamingId === set.id;
          return (
            <div
              key={set.id}
              className={`flex items-center gap-1 px-3 py-1.5 cursor-pointer ${
                isActive ? 'bg-forge-panel border-l-2 border-forge-gold' : 'hover:bg-forge-panel/50'
              }`}
              onClick={() => !isRenaming && onSelect(set.id)}
            >
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={() => setRenamingId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (renameDraft.trim()) onRename(set.id, renameDraft.trim());
                      setRenamingId(null);
                    } else if (e.key === 'Escape') {
                      setRenamingId(null);
                    }
                  }}
                  className="input flex-1 text-sm"
                />
              ) : (
                <div className="flex-1 truncate text-sm">
                  <span className={isActive ? 'text-forge-gold' : ''}>{tileSetLabel(set, t)}</span>
                  <span className="text-forge-parchment/50 text-xs ml-2">
                    {set.tiles.length}
                  </span>
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingId(set.id);
                  setRenameDraft(tileSetLabel(set, t));
                }}
                className="text-xs text-forge-parchment/60 hover:text-forge-gold px-1"
                title={t('rename')}
              >
                ✎
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(set.id); }}
                className="text-xs text-forge-blood hover:text-red-400 px-1"
                title={t('deleteAction')}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 flex gap-2">
        <button className="btn-gold flex-1 !py-1.5 text-xs" onClick={onUploadClick} disabled={!active}>
          {t('uploadTile')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {!active && (
          <div className="text-center text-forge-parchment/50 text-sm px-4 py-8">
            {t('chooseOrCreateSet')}
          </div>
        )}
        {active && active.tiles.length === 0 && (
          <div className="text-center text-forge-parchment/50 text-sm px-4 py-8 italic">
            {t('noTilesYet')}
          </div>
        )}
        {active && TILE_TYPE_KEYS.map((type) => {
          const tiles = tilesByType[type];
          if (!tiles || tiles.length === 0) return null;
          return (
            <div key={type} className="mb-3">
              <div className="text-[11px] uppercase tracking-wider text-forge-gold border-b border-forge-border pb-1 mb-2 px-1 flex items-center gap-2">
                <span>{t(`type${type}`)}</span>
                <span className="text-forge-parchment/50 normal-case">{tiles.length}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {tiles.map((tile) => (
                  <TileThumb
                    key={tile.id}
                    tile={tile}
                    onDelete={onDeleteTile}
                    onEdit={onEditTile}
                    onPick={onPickBrush}
                    isBrush={brush?.id === tile.id}
                    t={t}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
