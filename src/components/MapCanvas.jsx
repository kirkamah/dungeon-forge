import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTileImageURL } from '../storage/tileStorage.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { effectiveOpenings, rotateMask, N, E, S, W } from '../engine/tileRules.js';
import { tileLabel } from '../utils/labels.js';
import Minimap from './Minimap.jsx';

const TILE_PX = 64;
const DRAG_THRESHOLD = 4;

async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function useTileImages(tileSet) {
  const [cache, setCache] = useState(() => new Map());
  useEffect(() => {
    if (!tileSet) return;
    let cancelled = false;
    (async () => {
      const next = new Map(cache);
      for (const t of tileSet.tiles) {
        if (next.has(t.id)) continue;
        const url = await getTileImageURL(t.id);
        if (!url) continue;
        try {
          const img = await loadImage(url);
          if (cancelled) return;
          next.set(t.id, img);
        } catch { /* ignore */ }
      }
      if (!cancelled) setCache(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileSet]);
  return cache;
}

function drawPlaceholderTile(ctx, x, y, size, type) {
  ctx.save();
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = '#e2b04a';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  ctx.fillStyle = '#e2b04a';
  ctx.font = `${Math.floor(size * 0.18)}px Cinzel, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(type.slice(0, 4), x + size / 2, y + size / 2);
  ctx.restore();
}

function drawGridLines(ctx, dim, size) {
  ctx.save();
  ctx.strokeStyle = 'rgba(226, 176, 74, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= dim; i++) {
    const x = i * size + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, dim * size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, x);
    ctx.lineTo(dim * size, x);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTileImage(ctx, img, gx, gy, size, rot) {
  ctx.save();
  ctx.translate(gx + size / 2, gy + size / 2);
  ctx.rotate((rot * Math.PI) / 2);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawEntranceExit(ctx, gx, gy, size, kind) {
  ctx.save();
  ctx.strokeStyle = kind === 'ENTRANCE' ? '#4ade80' : '#8b0000';
  ctx.lineWidth = 3;
  ctx.strokeRect(gx + 2, gy + 2, size - 4, size - 4);
  ctx.fillStyle = kind === 'ENTRANCE' ? '#4ade80' : '#ff6b6b';
  ctx.font = `bold ${Math.floor(size * 0.22)}px Cinzel, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(kind === 'ENTRANCE' ? 'IN' : 'OUT', gx + size / 2, gy + size / 2);
  ctx.restore();
}

// Marker on the four sides indicating where a placed tile is open
function drawOpeningsHints(ctx, gx, gy, size, openings) {
  ctx.save();
  ctx.fillStyle = 'rgba(226, 176, 74, 0.55)';
  const t = 3;
  if (openings & (1 << N)) ctx.fillRect(gx + size * 0.4, gy, size * 0.2, t);
  if (openings & (1 << S)) ctx.fillRect(gx + size * 0.4, gy + size - t, size * 0.2, t);
  if (openings & (1 << W)) ctx.fillRect(gx, gy + size * 0.4, t, size * 0.2);
  if (openings & (1 << E)) ctx.fillRect(gx + size - t, gy + size * 0.4, t, size * 0.2);
  ctx.restore();
}

export default function MapCanvas({
  tileSet,
  generated,
  progress,
  showGrid,
  onToggleGrid,
  zoom,
  onZoom,
  warning,
  brush,
  onCancelBrush,
  onPlaceTile,
  onRotateTile,
  onDeleteTile,
  onPickupTile,
  onDropPlaceTile,
  playMode,
  onTogglePlayMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) {
  const { t } = useI18n();
  const canvasRef = useRef(null);
  const exportCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);
  const [brushRot, setBrushRot] = useState(0);
  const [dragTile, setDragTile] = useState(null); // { tile } during DnD over canvas
  const [contextMenu, setContextMenu] = useState(null); // { screenX, screenY, gridX, gridY }
  const [wrapperSize, setWrapperSize] = useState({ w: 0, h: 0 });
  const interactionRef = useRef(null);

  // Track wrapper dimensions for the minimap viewport rectangle.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect;
      setWrapperSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const centerOnCell = useCallback((cellX, cellY) => {
    setPan({
      x: wrapperSize.w / 2 - 16 - cellX * TILE_PX * zoom,
      y: wrapperSize.h / 2 - 16 - cellY * TILE_PX * zoom,
    });
  }, [wrapperSize, zoom]);

  const images = useTileImages(tileSet);

  // When brush changes, reset its rotation
  useEffect(() => { setBrushRot(0); }, [brush?.id]);

  // Reset selection when map identity changes
  useEffect(() => { setSelected(null); }, [generated?.seed]);

  const orderedCells = useMemo(() => {
    if (!generated) return [];
    const cells = [];
    for (let y = 0; y < generated.dim; y++) {
      for (let x = 0; x < generated.dim; x++) {
        const t = generated.grid[y][x];
        if (t) cells.push({ t, x, y });
      }
    }
    const e = generated.entrances?.[0];
    if (e) {
      cells.sort((a, b) => (
        ((a.x - e.x) ** 2 + (a.y - e.y) ** 2) - ((b.x - e.x) ** 2 + (b.y - e.y) ** 2)
      ));
    }
    return cells;
  }, [generated]);

  // --- Drawing ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (!generated) {
      ctx.fillStyle = '#0e0e1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const size = TILE_PX;
    const dim = generated.dim;
    canvas.width = dim * size;
    canvas.height = dim * size;
    ctx.fillStyle = '#0e0e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const revealCount = Math.ceil(orderedCells.length * (progress ?? 1));
    const idLookup = new Map((tileSet?.tiles || []).map((t) => [t.id, t]));

    for (let i = 0; i < revealCount; i++) {
      const { t, x, y } = orderedCells[i];
      const gx = x * size;
      const gy = y * size;
      const tileMeta = idLookup.get(t.variantId);
      const img = tileMeta ? images.get(tileMeta.id) : null;
      if (img) drawTileImage(ctx, img, gx, gy, size, t.rot);
      else drawPlaceholderTile(ctx, gx, gy, size, t.type);
      if (!playMode && (t.type === 'ENTRANCE' || t.type === 'EXIT')) {
        drawEntranceExit(ctx, gx, gy, size, t.type);
      }
    }

    if (showGrid && !playMode) drawGridLines(ctx, dim, size);

    // Brush ghost preview at hover position
    if (!playMode && brush && hover && progress === 1) {
      const img = images.get(brush.id);
      ctx.save();
      ctx.globalAlpha = 0.55;
      const gx = hover.x * size;
      const gy = hover.y * size;
      if (img) drawTileImage(ctx, img, gx, gy, size, brushRot);
      else drawPlaceholderTile(ctx, gx, gy, size, brush.type);
      ctx.restore();
      // Outline + openings hint
      ctx.save();
      ctx.strokeStyle = '#e2b04a';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(gx + 1, gy + 1, size - 2, size - 2);
      ctx.restore();
      drawOpeningsHints(ctx, gx, gy, size, rotateMask(effectiveOpenings(brush), brushRot));
    }

    // Selected outline
    if (!playMode && selected) {
      ctx.save();
      ctx.strokeStyle = '#e2b04a';
      ctx.lineWidth = 2;
      ctx.strokeRect(selected.x * size + 1, selected.y * size + 1, size - 2, size - 2);
      ctx.restore();
      const cell = generated.grid[selected.y]?.[selected.x];
      if (cell && cell.openings != null) {
        drawOpeningsHints(ctx, selected.x * size, selected.y * size, size, cell.openings);
      }
    }

    // Hover halo (when no brush, just a faint outline on hover)
    if (!playMode && !brush && hover && (!selected || hover.x !== selected.x || hover.y !== selected.y)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(226, 176, 74, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hover.x * size + 1, hover.y * size + 1, size - 2, size - 2);
      ctx.restore();
    }
  }, [generated, orderedCells, progress, images, tileSet, showGrid, selected, hover, brush, brushRot, playMode]);

  // Export canvas (full-resolution, no overlays). Tile size matches the largest
  // source image (capped) so PNG export keeps every pixel of detail the user
  // uploaded — no upscaling, no aggressive downscaling.
  useEffect(() => {
    if (!generated) return;
    const canvas = exportCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let maxNatural = 0;
    for (const img of images.values()) {
      const m = Math.max(img.naturalWidth || 0, img.naturalHeight || 0);
      if (m > maxNatural) maxNatural = m;
    }
    // Pick a tile size that preserves source resolution.
    // Floor 256 if no images loaded, cap 1024 so a 24x24 XL map stays ~25 MP.
    const size = Math.min(1024, Math.max(256, maxNatural || 256));

    const dim = generated.dim;
    canvas.width = dim * size;
    canvas.height = dim * size;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#0e0e1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const idLookup = new Map((tileSet?.tiles || []).map((t) => [t.id, t]));
    for (const { t, x, y } of orderedCells) {
      const gx = x * size;
      const gy = y * size;
      const tileMeta = idLookup.get(t.variantId);
      const img = tileMeta ? images.get(tileMeta.id) : null;
      if (img) drawTileImage(ctx, img, gx, gy, size, t.rot);
      else drawPlaceholderTile(ctx, gx, gy, size, t.type);
      // No IN/OUT overlay on export — those are editor-only markers.
    }
  }, [generated, orderedCells, images, tileSet]);

  // --- Hit testing ---
  const cellAt = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas || !generated) return null;
    const rect = canvas.getBoundingClientRect();
    const localX = (clientX - rect.left) / zoom;
    const localY = (clientY - rect.top) / zoom;
    const cx = Math.floor(localX / TILE_PX);
    const cy = Math.floor(localY / TILE_PX);
    if (cx < 0 || cy < 0 || cx >= generated.dim || cy >= generated.dim) return null;
    return { x: cx, y: cy };
  }, [generated, zoom]);

  // --- Mouse handling: middle button = always pan; left = click or drag-pan;
  //     right = open context menu on a placed tile (suppressed in play mode).
  const onMouseDown = (e) => {
    if (e.button === 1) {
      // Middle (wheel) button: pan immediately, suppress Windows auto-scroll
      e.preventDefault();
      interactionRef.current = {
        startX: e.clientX, startY: e.clientY,
        panAnchorX: pan.x - e.clientX,
        panAnchorY: pan.y - e.clientY,
        moved: true,
        button: 1,
      };
      return;
    }
    if (e.button === 2) {
      e.preventDefault();
      if (playMode) return;
      const hit = cellAt(e.clientX, e.clientY);
      if (hit && generated?.grid?.[hit.y]?.[hit.x]) {
        setSelected({
          x: hit.x, y: hit.y,
          type: generated.grid[hit.y][hit.x].type,
          rot: generated.grid[hit.y][hit.x].rot,
          variantId: generated.grid[hit.y][hit.x].variantId,
        });
        setContextMenu({ screenX: e.clientX, screenY: e.clientY, gridX: hit.x, gridY: hit.y });
      } else {
        setContextMenu(null);
      }
      return;
    }
    if (e.button !== 0) return;
    if (playMode) {
      // Pan only; no selection / placement.
      interactionRef.current = {
        startX: e.clientX, startY: e.clientY,
        panAnchorX: pan.x - e.clientX,
        panAnchorY: pan.y - e.clientY,
        moved: false,
        button: 0,
        panOnly: true,
      };
      return;
    }
    setContextMenu(null);
    interactionRef.current = {
      startX: e.clientX, startY: e.clientY,
      panAnchorX: pan.x - e.clientX,
      panAnchorY: pan.y - e.clientY,
      moved: false,
      button: 0,
    };
  };
  const onMouseMove = (e) => {
    const i = interactionRef.current;
    if (i) {
      const dx = e.clientX - i.startX;
      const dy = e.clientY - i.startY;
      if (!i.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) i.moved = true;
      if (i.moved) {
        setPan({ x: e.clientX + i.panAnchorX, y: e.clientY + i.panAnchorY });
      }
    }
    const hit = cellAt(e.clientX, e.clientY);
    if (hit) {
      const cell = generated?.grid?.[hit.y]?.[hit.x];
      setHover(cell
        ? { x: hit.x, y: hit.y, type: cell.type, rot: cell.rot, variantId: cell.variantId }
        : { x: hit.x, y: hit.y, empty: true });
    } else {
      setHover(null);
    }
  };
  const onMouseUp = (e) => {
    const i = interactionRef.current;
    interactionRef.current = null;
    if (!i) return;
    if (i.button === 1) return; // middle button: no click action
    if (i.moved) return;        // left button + drag: no click action
    if (i.panOnly) return;       // play mode pan: no click action
    const hit = cellAt(e.clientX, e.clientY);
    if (!hit) { setSelected(null); return; }
    if (brush) {
      onPlaceTile?.(hit.x, hit.y, brushRot);
      setSelected({ x: hit.x, y: hit.y });
      return;
    }
    const cell = generated.grid[hit.y]?.[hit.x];
    if (cell) {
      setSelected({ x: hit.x, y: hit.y, type: cell.type, rot: cell.rot, variantId: cell.variantId });
    } else {
      setSelected(null);
    }
  };
  const onMouseLeave = () => {
    interactionRef.current = null;
    setHover(null);
  };

  // --- DnD from palette ---
  const onDragOverCanvas = (e) => {
    const tileId = Array.from(e.dataTransfer.types).includes('application/x-df-tile')
      ? null  // tileId will be read on drop; just allow
      : null;
    // Accept tile drags only
    if (!e.dataTransfer.types || !Array.from(e.dataTransfer.types).includes('application/x-df-tile')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const hit = cellAt(e.clientX, e.clientY);
    if (hit) setHover({ x: hit.x, y: hit.y, dragOver: true });
    if (!dragTile) {
      // Look up the tile (only ID is in dataTransfer.getData, which is undefined during dragover)
      // but we stash an id-less marker. Actual draw uses brush-style ghost via dragTileFromPalette ref set on dragstart.
    }
  };
  const onDragLeaveCanvas = (e) => {
    // Only clear if we left the wrapper entirely
    const rt = e.relatedTarget;
    if (rt && wrapperRef.current && wrapperRef.current.contains(rt)) return;
    setDragTile(null);
    setHover(null);
  };
  const onDropOnCanvas = (e) => {
    if (!Array.from(e.dataTransfer.types).includes('application/x-df-tile')) return;
    e.preventDefault();
    const tileId = e.dataTransfer.getData('application/x-df-tile');
    const hit = cellAt(e.clientX, e.clientY);
    setDragTile(null);
    if (!tileId || !hit) return;
    onDropPlaceTile?.(tileId, hit.x, hit.y);
    setSelected({ x: hit.x, y: hit.y });
  };

  // Native wheel listener: passive: false so preventDefault works.
  // Wheel rotates brush/selected if armed, otherwise zooms.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onWheelNative = (e) => {
      const forceZoom = e.ctrlKey || e.metaKey;
      const wantRotate = !forceZoom && (brush || (selected && selected.type));
      if (wantRotate) {
        e.preventDefault();
        const dir = e.deltaY > 0 ? 1 : -1;
        if (brush) {
          setBrushRot((r) => (((r + dir) % 4) + 4) % 4);
        } else if (selected && selected.type) {
          onRotateTile?.(selected.x, selected.y, dir);
        }
        return;
      }
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      onZoom(Math.min(3, Math.max(0.25, zoom * delta)));
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, [brush, selected, zoom, onZoom, onRotateTile]);

  // Sync local "selected" with the actual cell currently at that location
  // (handlers may have changed the underlying grid)
  useEffect(() => {
    if (!selected || !generated) return;
    const cell = generated.grid[selected.y]?.[selected.x];
    if (!cell) {
      // cell got deleted - keep position selected so user can click again
      if (selected.type) setSelected({ x: selected.x, y: selected.y });
    } else if (cell.type !== selected.type || cell.rot !== selected.rot || cell.variantId !== selected.variantId) {
      setSelected({ x: selected.x, y: selected.y, type: cell.type, rot: cell.rot, variantId: cell.variantId });
    }
  }, [generated, selected]);

  // --- Keyboard ---
  useEffect(() => {
    const onKey = (e) => {
      // Ignore when typing
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
      if (e.key === 'Escape') {
        if (contextMenu) { setContextMenu(null); e.preventDefault(); return; }
        if (brush) { onCancelBrush?.(); e.preventDefault(); return; }
        if (selected) { setSelected(null); e.preventDefault(); return; }
      }
      if (e.key === 'r' || e.key === 'R') {
        if (brush) {
          setBrushRot((r) => (r + 1) % 4);
          e.preventDefault();
        } else if (selected && selected.type) {
          onRotateTile?.(selected.x, selected.y);
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected && selected.type) {
          onDeleteTile?.(selected.x, selected.y);
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        if (selected && selected.type) {
          onPickupTile?.(selected.x, selected.y);
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [brush, selected, onCancelBrush, onRotateTile, onDeleteTile, onPickupTile, contextMenu]);

  // Close context menu on outside click anywhere.
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    // Use timeout to skip the same mousedown that opened it.
    const id = setTimeout(() => {
      window.addEventListener('mousedown', close);
    }, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener('mousedown', close);
    };
  }, [contextMenu]);

  const variantName = (variantId) => {
    if (!variantId || !tileSet) return null;
    const tile = tileSet.tiles.find((tl) => tl.id === variantId);
    return tile ? tileLabel(tile, t) : null;
  };

  const selectedHasTile = selected && selected.type;
  const selectedLabel = selectedHasTile
    ? `${t(`type${selected.type}`)} — ${variantName(selected.variantId) || '—'} (rot ${selected.rot})`
    : null;
  const hoverLabel = hover && !hover.empty ? t(`type${hover.type}`) : null;
  const cursor = brush ? 'crosshair' : (interactionRef.current?.moved ? 'grabbing' : 'grab');

  return (
    <div ref={containerRef} className="relative flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-forge-border bg-forge-panel2 text-xs">
        <button className="btn-ghost !py-0.5 !px-2" onClick={() => onZoom(Math.max(0.25, zoom / 1.2))}>−</button>
        <span className="font-mono text-forge-gold w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
        <button className="btn-ghost !py-0.5 !px-2" onClick={() => onZoom(Math.min(3, zoom * 1.2))}>+</button>
        <button className="btn-ghost !py-0.5 !px-2" onClick={() => { onZoom(1); setPan({ x: 0, y: 0 }); }}>{t('reset')}</button>
        <div className="flex items-center gap-1 ml-3 border-l border-forge-border pl-3">
          <button
            className="btn-ghost !py-0.5 !px-2 disabled:opacity-30"
            onClick={onUndo}
            disabled={!canUndo}
            title={t('undoHotkey')}
          >↶</button>
          <button
            className="btn-ghost !py-0.5 !px-2 disabled:opacity-30"
            onClick={onRedo}
            disabled={!canRedo}
            title={t('redoHotkey')}
          >↷</button>
        </div>
        <label className="flex items-center gap-1 ml-3 cursor-pointer text-forge-parchment">
          <input type="checkbox" checked={showGrid} onChange={onToggleGrid} />
          {t('grid')}
        </label>
        <button
          className={`!py-0.5 !px-2 text-[11px] rounded border ml-2 ${
            playMode
              ? 'bg-forge-gold text-forge-onAccent border-forge-gold shadow-gold'
              : 'border-forge-border text-forge-parchment hover:border-forge-gold'
          }`}
          onClick={onTogglePlayMode}
          title={t('playModeHotkey')}
        >
          {playMode ? '▶ ' : '○ '}{t('playMode')}
        </button>
        {selectedHasTile && (
          <div className="flex items-center gap-1 ml-3 border-l border-forge-border pl-3">
            <button
              className="btn-gold !py-0.5 !px-2 text-[11px]"
              onClick={() => onRotateTile?.(selected.x, selected.y)}
              title={t('rotateTile')}
            >↻ R</button>
            <button
              className="btn-ghost !py-0.5 !px-2 text-[11px]"
              onClick={() => onPickupTile?.(selected.x, selected.y)}
              title={t('pickupTile')}
            >✋ M</button>
            <button
              className="btn-danger !py-0.5 !px-2 text-[11px]"
              onClick={() => onDeleteTile?.(selected.x, selected.y)}
              title={t('deleteTile')}
            >✕ Del</button>
          </div>
        )}
        <div className="flex-1" />
        {brush && (
          <div className="flex items-center gap-2 mr-3 px-2 py-0.5 bg-forge-gold/20 border border-forge-gold rounded">
            <span className="text-forge-gold font-bold">{t('brush')}:</span>
            <span className="text-forge-ink truncate max-w-[160px]" title={tileLabel(brush, t)}>{tileLabel(brush, t)}</span>
            <span className="text-[10px] text-forge-parchment">rot {brushRot}</span>
            <button
              className="text-forge-gold hover:text-white px-1"
              onClick={() => onCancelBrush?.()}
              title={t('cancelBrush')}
            >✕</button>
          </div>
        )}
        {generated && (
          <span className="font-mono text-forge-parchment/70">
            {generated.dim}×{generated.dim} · seed:
            <span className="text-forge-gold ml-1">{generated.seed}</span>
          </span>
        )}
      </div>

      {warning && (
        <div className="px-3 py-2 bg-forge-blood/30 border-b border-forge-blood text-forge-ink text-sm">
          ⚠ {warning}
        </div>
      )}

      <div
        ref={wrapperRef}
        className="flex-1 overflow-hidden relative bg-forge-bg select-none"
        style={{ cursor }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onDragOver={onDragOverCanvas}
        onDragLeave={onDragLeaveCanvas}
        onDrop={onDropOnCanvas}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!generated ? (
          <div className="absolute inset-0 flex items-center justify-center text-center text-forge-parchment/50">
            <div>
              <div className="font-medieval text-3xl text-forge-gold mb-3">{t('awaitingForge')}</div>
              <div className="text-sm max-w-xs italic">
                {(() => {
                  const tmpl = t('forgeInstructions');
                  const parts = tmpl.split('{generate}');
                  return (
                    <>
                      {parts[0]}
                      <span className="text-forge-gold">{t('generateDungeon')}</span>
                      {parts[1] || ''}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="absolute"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              top: 16,
              left: 16,
            }}
          >
            <canvas ref={canvasRef} className="block" style={{ imageRendering: 'auto' }} />
          </div>
        )}
        <canvas id="df-export-canvas" ref={exportCanvasRef} style={{ display: 'none' }} />

        {generated && !playMode && (
          <Minimap
            generated={generated}
            pan={pan}
            zoom={zoom}
            wrapperSize={wrapperSize}
            onCenterAt={centerOnCell}
            tilePx={TILE_PX}
          />
        )}
      </div>

      <div className="border-t border-forge-border bg-forge-panel2 px-3 py-1 text-xs flex gap-4 text-forge-parchment min-h-[24px]">
        {brush ? (
          <span className="text-forge-gold">
            {t('brushPicked', { name: tileLabel(brush, t) })} — {t('clickToPlace')}
          </span>
        ) : selectedHasTile ? (
          <span><span className="text-forge-gold">{t('selected')}</span> {selectedLabel}</span>
        ) : (
          <span className="opacity-60">{t('clickToSelect')}</span>
        )}
        {hoverLabel && <span className="opacity-60 ml-auto"><span className="text-forge-gold">{t('hover')}</span> {hoverLabel}</span>}
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 bg-forge-panel2 border border-forge-gold rounded shadow-gold py-1 text-sm"
          style={{
            left: Math.min(contextMenu.screenX, window.innerWidth - 170),
            top: Math.min(contextMenu.screenY, window.innerHeight - 130),
            minWidth: 150,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            className="block w-full text-left px-3 py-1.5 text-forge-ink hover:bg-forge-gold hover:text-forge-onAccent"
            onClick={() => { onRotateTile?.(contextMenu.gridX, contextMenu.gridY); setContextMenu(null); }}
          >
            ↻ {t('ctxRotate')} <span className="text-forge-parchment/50 text-[10px] ml-1">R</span>
          </button>
          <button
            className="block w-full text-left px-3 py-1.5 text-forge-ink hover:bg-forge-gold hover:text-forge-onAccent"
            onClick={() => { onPickupTile?.(contextMenu.gridX, contextMenu.gridY); setContextMenu(null); }}
          >
            ✋ {t('ctxPickup')} <span className="text-forge-parchment/50 text-[10px] ml-1">M</span>
          </button>
          <button
            className="block w-full text-left px-3 py-1.5 text-forge-ink hover:bg-forge-blood"
            onClick={() => { onDeleteTile?.(contextMenu.gridX, contextMenu.gridY); setContextMenu(null); }}
          >
            ✕ {t('ctxDelete')} <span className="text-forge-parchment/50 text-[10px] ml-1">Del</span>
          </button>
        </div>
      )}
    </div>
  );
}
