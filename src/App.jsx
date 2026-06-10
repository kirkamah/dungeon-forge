import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import TileSetPanel from './components/TileSetPanel.jsx';
import MapCanvas from './components/MapCanvas.jsx';
import GenerationPanel from './components/GenerationPanel.jsx';
import UploadTileModal from './components/UploadTileModal.jsx';
import EditTileModal from './components/EditTileModal.jsx';
import SavedMapsModal from './components/SavedMapsModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { getMapsDir } from './storage/settings.js';
import { loadStarterPack } from './storage/starterPack.js';
import {
  listTileSets,
  saveTileSets,
  getActiveTileSetId,
  setActiveTileSetId,
  listSavedMaps,
  saveSavedMaps,
  uid,
} from './storage/mapStorage.js';
import {
  saveTileImage,
  deleteTileImage,
  invalidateTileImageURL,
} from './storage/tileStorage.js';
import { generateDungeon, DEFAULT_PARAMS } from './engine/generator.js';
import { MAP_SIZES, makeGrid, randomSeed } from './engine/gridUtils.js';
import { effectiveOpenings, rotateMask } from './engine/tileRules.js';
import { useI18n } from './i18n/I18nContext.jsx';
import { useConfirm } from './components/ConfirmProvider.jsx';
import { tileSetLabel } from './utils/labels.js';
import { TRIAL, BOOSTY_URL, TRIAL_MAX_USER_TILESETS, drawTrialWatermark } from './trial.js';

export default function App() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const [tileSets, setTileSets] = useState(() => listTileSets());
  const [activeId, setActiveId] = useState(() => getActiveTileSetId());
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [generated, setGenerated] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 for animation
  const [savedMaps, setSavedMaps] = useState(() => listSavedMaps());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadInitialFiles, setUploadInitialFiles] = useState(null);
  const [editingTile, setEditingTile] = useState(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragFilesActive, setDragFilesActive] = useState(false);
  const dragCounter = useRef(0);
  const [warning, setWarning] = useState('');
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [brush, setBrush] = useState(null);
  const [playMode, setPlayMode] = useState(false);
  const [history, setHistory] = useState({ past: [], future: [] });

  // Snapshot of `generated`'s mutable fields. Pushed into history BEFORE each
  // edit, cleared by generate/load (which start a fresh map).
  const snapshotState = useCallback((g) => (
    g ? { dim: g.dim, seed: g.seed, grid: g.grid, entrances: g.entrances, exits: g.exits } : null
  ), []);

  const pushHistory = useCallback(() => {
    setHistory((h) => ({
      past: [...h.past, snapshotState(generated)].slice(-30),
      future: [],
    }));
  }, [generated, snapshotState]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      const prev = h.past[h.past.length - 1];
      const cur = snapshotState(generated);
      setGenerated(prev ? { ok: true, ...prev } : null);
      return {
        past: h.past.slice(0, -1),
        future: [...h.future, cur].slice(-30),
      };
    });
  }, [generated, snapshotState]);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      const next = h.future[h.future.length - 1];
      const cur = snapshotState(generated);
      setGenerated(next ? { ok: true, ...next } : null);
      return {
        past: [...h.past, cur].slice(-30),
        future: h.future.slice(0, -1),
      };
    });
  }, [generated, snapshotState]);

  const resetHistory = useCallback(() => setHistory({ past: [], future: [] }), []);

  // Initialise. The bundled starter pack is imported once (tracked by a flag),
  // so both fresh installs and existing users get it without a manual button.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const SEED_KEY = 'df.starterSeeded';
      const VER_KEY = 'df.starterVersion';
      const STARTER_VERSION = 2;
      const alreadySeeded = localStorage.getItem(SEED_KEY) === '1';
      const ver = parseInt(localStorage.getItem(VER_KEY) || '0', 10);

      // Migrate an older seeded starter set: tag it as the system set and drop
      // the hardcoded Russian tile names so labels follow the UI language.
      if (tileSets.length > 0 && ver < STARTER_VERSION) {
        const migrated = tileSets.map((s) =>
          (s.starter || s.name === 'Катакомбы' || s.name === 'Catacombs')
            ? { ...s, starter: true, tiles: s.tiles.map((tl) => ({ ...tl, name: '' })) }
            : s
        );
        setTileSets(migrated);
        saveTileSets(migrated);
        localStorage.setItem(VER_KEY, String(STARTER_VERSION));
      }

      // Fresh install: seed from the starter pack, or fall back to an empty set.
      if (tileSets.length === 0) {
        const starter = await loadStarterPack().catch(() => null);
        if (cancelled) return;
        if (starter) localStorage.setItem(SEED_KEY, '1');
        localStorage.setItem(VER_KEY, String(STARTER_VERSION));
        const initial = [starter || {
          id: uid('ts'),
          name: 'Dungeon',
          description: 'Default dungeon tile pack',
          tiles: [],
          createdAt: Date.now(),
        }];
        setTileSets(initial);
        saveTileSets(initial);
        setActiveId(initial[0].id);
        setActiveTileSetId(initial[0].id);
        return;
      }

      // Existing install that never received the pack: import it once.
      if (!alreadySeeded) {
        const starter = await loadStarterPack().catch(() => null);
        if (cancelled) return;
        localStorage.setItem(SEED_KEY, '1');
        localStorage.setItem(VER_KEY, String(STARTER_VERSION));
        if (starter && starter.tiles.length) {
          const next = [...tileSets, starter];
          setTileSets(next);
          saveTileSets(next);
          setActiveId(starter.id);
          setActiveTileSetId(starter.id);
          return;
        }
      }

      if (!activeId || !tileSets.find((t) => t.id === activeId)) {
        setActiveId(tileSets[0].id);
        setActiveTileSetId(tileSets[0].id);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSet = useMemo(() => tileSets.find((t) => t.id === activeId), [tileSets, activeId]);

  const persistTileSets = useCallback((next) => {
    setTileSets(next);
    saveTileSets(next);
  }, []);

  const persistSavedMaps = useCallback((next) => {
    setSavedMaps(next);
    saveSavedMaps(next);
  }, []);

  // --- Tile set CRUD ---
  const handleCreateTileSet = (name, description = '') => {
    // Trial build: at most one user-created tile set (starter pack not counted).
    if (TRIAL) {
      const userSets = tileSets.filter((s) => !s.starter).length;
      if (userSets >= TRIAL_MAX_USER_TILESETS) {
        setWarning(
          <span>
            {t('trialTileSetLimit')}{' '}
            <a
              href={BOOSTY_URL}
              target="_blank"
              rel="noreferrer"
              className="underline text-forge-gold hover:text-white"
            >
              boosty.to/no.harm.org
            </a>
          </span>
        );
        return;
      }
    }
    const newSet = { id: uid('ts'), name, description, tiles: [], createdAt: Date.now() };
    const next = [...tileSets, newSet];
    persistTileSets(next);
    setActiveId(newSet.id);
    setActiveTileSetId(newSet.id);
  };

  const handleRenameTileSet = (id, name) => {
    // Renaming the system set turns it into a regular (user-named) set.
    const next = tileSets.map((t) => (t.id === id ? { ...t, name, starter: false } : t));
    persistTileSets(next);
  };

  const handleDeleteTileSet = async (id) => {
    if (!(await confirm({ message: t('deleteSetConfirm'), okText: t('deleteAction'), danger: true }))) return;
    const set = tileSets.find((t) => t.id === id);
    if (set) {
      for (const tile of set.tiles) {
        await deleteTileImage(tile.id);
        invalidateTileImageURL(tile.id);
      }
    }
    const next = tileSets.filter((t) => t.id !== id);
    persistTileSets(next);
    if (activeId === id) {
      const nextActive = next[0]?.id ?? null;
      setActiveId(nextActive);
      setActiveTileSetId(nextActive);
    }
  };

  const handleSelectTileSet = (id) => {
    setActiveId(id);
    setActiveTileSetId(id);
  };

  // --- Tile upload / delete / edit ---
  const handleUploadTile = async ({ type, file, name, openings }) => {
    if (!activeSet) return;
    const tileId = uid('tl');
    await saveTileImage(tileId, file);
    const tile = {
      id: tileId,
      type,
      name: name || file.name.replace(/\.[^.]+$/, ''),
      openings,
      createdAt: Date.now(),
    };
    const next = tileSets.map((t) =>
      t.id === activeSet.id ? { ...t, tiles: [...t.tiles, tile] } : t
    );
    persistTileSets(next);
  };

  const handleDeleteTile = async (tileId) => {
    if (!activeSet) return;
    await deleteTileImage(tileId);
    invalidateTileImageURL(tileId);
    const next = tileSets.map((t) =>
      t.id === activeSet.id ? { ...t, tiles: t.tiles.filter((x) => x.id !== tileId) } : t
    );
    persistTileSets(next);
  };

  const handleEditTileSave = (updated) => {
    if (!activeSet) return;
    const next = tileSets.map((t) =>
      t.id === activeSet.id
        ? { ...t, tiles: t.tiles.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)) }
        : t
    );
    persistTileSets(next);
  };

  // --- Manual canvas editing ---
  const ensureGrid = useCallback(() => {
    if (generated) return generated;
    const dim = MAP_SIZES[params.size].dim;
    const blank = {
      ok: true,
      grid: makeGrid(dim),
      dim,
      seed: 'manual',
      entrances: [],
      exits: [],
    };
    setGenerated(blank);
    setProgress(1);
    return blank;
  }, [generated, params.size]);

  const cloneGrid = (grid) => grid.map((row) => row.slice());

  const handlePlaceTile = useCallback((x, y, rot) => {
    if (!brush) return;
    pushHistory();
    const base = ensureGrid();
    const grid = cloneGrid(base.grid);
    const openings = rotateMask(effectiveOpenings(brush), rot);
    grid[y][x] = { type: brush.type, rot, variantId: brush.id, openings, x, y };
    setGenerated({ ...base, grid });
  }, [brush, ensureGrid, pushHistory]);

  const handleDropPlaceTile = useCallback((tileId, x, y) => {
    if (!activeSet) return;
    const tile = activeSet.tiles.find((t) => t.id === tileId);
    if (!tile) return;
    pushHistory();
    const base = ensureGrid();
    const grid = cloneGrid(base.grid);
    const rot = 0;
    const openings = rotateMask(effectiveOpenings(tile), rot);
    grid[y][x] = { type: tile.type, rot, variantId: tile.id, openings, x, y };
    setGenerated({ ...base, grid });
  }, [activeSet, ensureGrid, pushHistory]);

  const handleRotateTile = useCallback((x, y, delta = 1) => {
    if (!generated) return;
    const cell = generated.grid[y]?.[x];
    if (!cell) return;
    const tile = activeSet?.tiles.find((t) => t.id === cell.variantId);
    const baseOpen = tile ? effectiveOpenings(tile) : 0;
    const newRot = (((cell.rot ?? 0) + delta) % 4 + 4) % 4;
    const newOpen = rotateMask(baseOpen, newRot);
    pushHistory();
    const grid = cloneGrid(generated.grid);
    grid[y][x] = { ...cell, rot: newRot, openings: newOpen };
    setGenerated({ ...generated, grid });
  }, [generated, activeSet, pushHistory]);

  const handleDeleteCell = useCallback((x, y) => {
    if (!generated) return;
    if (!generated.grid[y]?.[x]) return;
    pushHistory();
    const grid = cloneGrid(generated.grid);
    grid[y][x] = null;
    setGenerated({ ...generated, grid });
  }, [generated, pushHistory]);

  const handlePickupTile = useCallback((x, y) => {
    if (!generated || !activeSet) return;
    const cell = generated.grid[y]?.[x];
    if (!cell) return;
    const tile = activeSet.tiles.find((t) => t.id === cell.variantId);
    if (tile) setBrush(tile);
    pushHistory();
    const grid = cloneGrid(generated.grid);
    grid[y][x] = null;
    setGenerated({ ...generated, grid });
  }, [generated, activeSet, pushHistory]);

  const handleNewBlankMap = useCallback(() => {
    pushHistory();
    const dim = MAP_SIZES[params.size].dim;
    setGenerated({
      ok: true,
      grid: makeGrid(dim),
      dim,
      seed: 'manual',
      entrances: [],
      exits: [],
    });
    setProgress(1);
    setWarning('');
  }, [params.size, pushHistory]);

  const handleClearMap = useCallback(async () => {
    if (!generated) return;
    if (!(await confirm({ message: t('clearMapConfirm'), okText: t('clearMap'), danger: true }))) return;
    pushHistory();
    setGenerated({ ...generated, grid: makeGrid(generated.dim) });
  }, [generated, t, pushHistory, confirm]);

  // --- Global file drop: drag image files from OS to upload ---
  useEffect(() => {
    const hasFiles = (e) => {
      const types = e.dataTransfer?.types;
      if (!types) return false;
      return Array.from(types).includes('Files');
    };
    const onDragEnter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounter.current++;
      setDragFilesActive(true);
    };
    const onDragOver = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };
    const onDragLeave = (e) => {
      if (!hasFiles(e)) return;
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setDragFilesActive(false);
    };
    const onDrop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounter.current = 0;
      setDragFilesActive(false);
      const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'));
      if (files.length === 0) return;
      if (!activeSet) {
        setWarning(t('err_chooseSetFirst'));
        return;
      }
      setUploadInitialFiles(files);
      setUploadOpen(true);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [activeSet, t]);

  // --- Generation ---
  const runGenerate = useCallback((overrideParams = null) => {
    setWarning('');
    if (!activeSet) {
      setWarning(t('err_chooseSetFirst'));
      return;
    }
    const usedParams = overrideParams || params;
    setGenerating(true);
    setProgress(0);
    const result = generateDungeon(activeSet, usedParams);
    if (!result.ok) {
      setWarning(t(result.reasonKey || 'err_generationFailed'));
      setGenerated(null);
      setGenerating(false);
      return;
    }
    setGenerated(result);
    setParams({ ...usedParams, seed: result.seed });
    resetHistory();
    // Animate reveal
    const totalCells = result.dim * result.dim;
    const start = performance.now();
    const totalMs = Math.min(2500, totalCells * 12);
    const step = (now) => {
      const p = Math.min(1, (now - start) / totalMs);
      setProgress(p);
      if (p < 1) requestAnimationFrame(step);
      else setGenerating(false);
    };
    requestAnimationFrame(step);
  }, [activeSet, params, t]);

  const handleRegenerate = () => {
    runGenerate({ ...params, seed: randomSeed() });
  };

  // --- Save / load maps ---
  const handleSaveMap = (name) => {
    if (!generated) return;
    const map = {
      id: uid('mp'),
      name: name || `Map ${new Date().toLocaleString()}`,
      tileSetId: activeId,
      tileSetName: activeSet ? tileSetLabel(activeSet, t) : activeSet?.name,
      params,
      seed: generated.seed,
      dim: generated.dim,
      grid: generated.grid,
      entrances: generated.entrances,
      exits: generated.exits,
      createdAt: Date.now(),
    };
    persistSavedMaps([map, ...savedMaps]);
  };

  const handleLoadMap = (mapId) => {
    const map = savedMaps.find((m) => m.id === mapId);
    if (!map) return;
    // Switch tile set if needed
    if (map.tileSetId && tileSets.find((t) => t.id === map.tileSetId)) {
      setActiveId(map.tileSetId);
      setActiveTileSetId(map.tileSetId);
    }
    setParams(map.params);
    setGenerated({
      ok: true,
      grid: map.grid,
      dim: map.dim,
      seed: map.seed,
      entrances: map.entrances,
      exits: map.exits,
    });
    setProgress(1);
    resetHistory();
    setSavedOpen(false);
  };

  const handleDeleteMap = (mapId) => {
    persistSavedMaps(savedMaps.filter((m) => m.id !== mapId));
  };

  const handleExportPNG = useCallback(() => {
    if (!generated) return;
    let canvas = document.getElementById('df-export-canvas');
    if (!canvas) return;
    // Trial build: stamp a watermark onto a copy (the live export canvas
    // stays untouched so repeated exports don't stack watermarks).
    if (TRIAL) {
      const marked = document.createElement('canvas');
      marked.width = canvas.width;
      marked.height = canvas.height;
      const ctx = marked.getContext('2d');
      ctx.drawImage(canvas, 0, 0);
      drawTrialWatermark(ctx, marked.width, marked.height);
      canvas = marked;
    }
    const filename = `dungeon_${generated.seed || 'map'}.png`;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      // On desktop, if a maps folder is set, write the PNG straight there.
      const dir = getMapsDir();
      if (dir && window.dungeonForge?.isDesktop && window.dungeonForge.savePng) {
        try {
          const buf = new Uint8Array(await blob.arrayBuffer());
          const full = await window.dungeonForge.savePng(dir, filename, buf);
          window.dungeonForge.reveal?.(full);
          return;
        } catch { /* fall back to browser download */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }, [generated]);


  // --- Global hotkeys: Ctrl+Z/Y (undo/redo), Ctrl+G (generate), Ctrl+S (save),
  //     Ctrl+E (export), P (play mode toggle). Ignored when typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) redo(); else undo();
        e.preventDefault();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        redo();
        e.preventDefault();
        return;
      }
      if (mod && (e.key === 'g' || e.key === 'G')) {
        runGenerate();
        e.preventDefault();
        return;
      }
      if (mod && (e.key === 's' || e.key === 'S')) {
        handleSaveMap('');
        e.preventDefault();
        return;
      }
      if (mod && (e.key === 'e' || e.key === 'E')) {
        handleExportPNG();
        e.preventDefault();
        return;
      }
      if (!mod && (e.key === 'p' || e.key === 'P')) {
        setPlayMode((m) => !m);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, runGenerate, handleSaveMap, handleExportPNG]);

  return (
    <div className="h-full w-full flex flex-col bg-forge-bg text-forge-ink">
      <header className="app-titlebar flex items-center justify-between border-b border-forge-border bg-forge-panel2 px-4 py-2 pr-[150px]">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}Logo_Dungeon_Forge.png`} alt="" className="w-9 h-9 rounded shadow-gold" />
          <div className="flex items-baseline gap-3">
            <h1 className="font-medieval text-2xl text-forge-gold tracking-wide">Dungeon Forge</h1>
            <span className="text-xs text-forge-parchment/60 italic">
              {t('appSubtitle')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {TRIAL && (
            <a
              href={BOOSTY_URL}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] px-2 py-1 rounded border border-forge-gold/50 text-forge-gold/80 hover:text-forge-gold hover:border-forge-gold transition whitespace-nowrap"
              title={BOOSTY_URL}
            >
              {t('trialBadge')}
            </a>
          )}
          <button className="btn-ghost" onClick={() => setSavedOpen(true)}>
            {t('savedMaps')} ({savedMaps.length})
          </button>
          <button className="btn-ghost" onClick={() => setSettingsOpen(true)} title={t('settings')}>
            ⚙ {t('settings')}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-80 border-r border-forge-border bg-forge-panel2 flex flex-col min-h-0">
          <TileSetPanel
            tileSets={tileSets}
            activeId={activeId}
            onSelect={handleSelectTileSet}
            onCreate={handleCreateTileSet}
            onRename={handleRenameTileSet}
            onDelete={handleDeleteTileSet}
            onUploadClick={() => setUploadOpen(true)}
            onDeleteTile={handleDeleteTile}
            onEditTile={(tile) => setEditingTile(tile)}
            brush={brush}
            onPickBrush={(tile) => setBrush((current) => (current?.id === tile.id ? null : tile))}
          />
        </aside>

        <main className="flex-1 min-w-0 flex flex-col bg-forge-bg">
          <MapCanvas
            tileSet={activeSet}
            generated={generated}
            progress={progress}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid((s) => !s)}
            zoom={zoom}
            onZoom={setZoom}
            warning={warning}
            brush={brush}
            onCancelBrush={() => setBrush(null)}
            onPlaceTile={handlePlaceTile}
            onRotateTile={handleRotateTile}
            onDeleteTile={handleDeleteCell}
            onPickupTile={handlePickupTile}
            onDropPlaceTile={handleDropPlaceTile}
            playMode={playMode}
            onTogglePlayMode={() => setPlayMode((m) => !m)}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onUndo={undo}
            onRedo={redo}
          />
        </main>

        <aside className="w-80 border-l border-forge-border bg-forge-panel2 flex flex-col min-h-0">
          <GenerationPanel
            params={params}
            onChange={setParams}
            onGenerate={() => runGenerate()}
            onRegenerate={handleRegenerate}
            generating={generating}
            generated={generated}
            onSaveMap={handleSaveMap}
            tileSetName={activeSet ? tileSetLabel(activeSet, t) : ''}
            tileSet={activeSet}
            onNewBlankMap={handleNewBlankMap}
            onClearMap={handleClearMap}
            onExportPNG={handleExportPNG}
          />
        </aside>
      </div>

      {warning && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-xl w-[min(100%-2rem,36rem)]">
          <div className="bg-forge-blood/90 border-2 border-forge-gold rounded-lg shadow-gold px-4 py-3 flex items-start gap-3 text-forge-ink">
            <span className="text-3xl leading-none">⚠</span>
            <div className="flex-1">
              <div className="font-bold text-forge-gold uppercase tracking-wider text-xs mb-0.5">
                {t('warningTitle')}
              </div>
              <div className="text-sm">{warning}</div>
            </div>
            <button
              onClick={() => setWarning('')}
              className="text-forge-gold hover:text-white text-lg leading-none px-1"
              title={t('cancel')}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {dragFilesActive && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-forge-gold/10 border-[6px] border-dashed border-forge-gold" />
          <div className="relative bg-forge-panel2 border-2 border-forge-gold rounded-lg px-8 py-6 text-center shadow-gold">
            <div className="text-5xl mb-2">⤓</div>
            <div className="font-medieval text-2xl text-forge-gold mb-1">{t('dropFilesTitle')}</div>
            <div className="text-sm text-forge-parchment">{t('dropFilesHint')}</div>
          </div>
        </div>
      )}

      {uploadOpen && (
        <UploadTileModal
          initialFiles={uploadInitialFiles}
          onClose={() => { setUploadOpen(false); setUploadInitialFiles(null); }}
          onUpload={async (data) => {
            await handleUploadTile(data);
            setUploadOpen(false);
            setUploadInitialFiles(null);
          }}
        />
      )}

      {editingTile && (
        <EditTileModal
          tile={editingTile}
          onClose={() => setEditingTile(null)}
          onSave={handleEditTileSave}
        />
      )}

      {savedOpen && (
        <SavedMapsModal
          maps={savedMaps}
          onClose={() => setSavedOpen(false)}
          onLoad={handleLoadMap}
          onDelete={handleDeleteMap}
        />
      )}

      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
