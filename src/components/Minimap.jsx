import { useEffect, useRef } from 'react';

const MINIMAP_MAX = 192;

const BG_EMPTY = '#16213e';
const BG_CELL = '#1f1f3a';
const BG_ROOM = '#3a3a55';
const BG_ENTRANCE = '#4ade80';
const BG_EXIT = '#ff6b6b';
const STROKE_OPEN = '#e2b04a';
const STROKE_OPEN_DARK = '#0e0e1a';

const N_BIT = 1, E_BIT = 2, S_BIT = 4, W_BIT = 8;

export default function Minimap({ generated, pan, zoom, wrapperSize, onCenterAt, tilePx }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const draggingRef = useRef(false);

  const dim = generated.dim;
  const cellPx = Math.max(4, Math.floor(MINIMAP_MAX / dim));
  const mapPx = cellPx * dim;

  // Repaint cells when grid changes. Each occupied cell is drawn as:
  //   - a filled background (gold-green for ENTRANCE, blood-red for EXIT,
  //     slightly-lighter slate for rooms, dark slate for corridors)
  //   - line segments from the cell's centre to each OPEN edge, so the
  //     topology of every junction is readable at a glance.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = mapPx;
    c.height = mapPx;
    const ctx = c.getContext('2d');
    ctx.fillStyle = BG_EMPTY;
    ctx.fillRect(0, 0, mapPx, mapPx);

    const lineW = Math.max(1, Math.floor(cellPx / 4));
    const dotSize = Math.max(2, Math.floor(cellPx / 3));
    ctx.lineCap = 'butt';
    ctx.lineWidth = lineW;

    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        const t = generated.grid[y][x];
        if (!t) continue;
        const gx = x * cellPx;
        const gy = y * cellPx;
        const cx = gx + cellPx / 2;
        const cy = gy + cellPx / 2;

        const isEntrance = t.type === 'ENTRANCE';
        const isExit = t.type === 'EXIT';
        const isRoom = t.type === 'ROOM_SMALL' || t.type === 'ROOM_LARGE';

        ctx.fillStyle = isEntrance
          ? BG_ENTRANCE
          : isExit
            ? BG_EXIT
            : isRoom
              ? BG_ROOM
              : BG_CELL;
        ctx.fillRect(gx, gy, cellPx, cellPx);

        // Stroke for opening lines: dark on bright (entrance/exit) fills,
        // gold on dark fills.
        ctx.strokeStyle = (isEntrance || isExit) ? STROKE_OPEN_DARK : STROKE_OPEN;
        const open = t.openings || 0;
        ctx.beginPath();
        if (open & N_BIT) { ctx.moveTo(cx, cy); ctx.lineTo(cx, gy); }
        if (open & E_BIT) { ctx.moveTo(cx, cy); ctx.lineTo(gx + cellPx, cy); }
        if (open & S_BIT) { ctx.moveTo(cx, cy); ctx.lineTo(cx, gy + cellPx); }
        if (open & W_BIT) { ctx.moveTo(cx, cy); ctx.lineTo(gx, cy); }
        ctx.stroke();

        // Centre dot — anchors the topology cross visually, makes dead
        // ends readable (otherwise a 1-opening cell looks like a stray line).
        ctx.fillStyle = (isEntrance || isExit) ? STROKE_OPEN_DARK : STROKE_OPEN;
        ctx.fillRect(
          Math.floor(cx - dotSize / 2),
          Math.floor(cy - dotSize / 2),
          dotSize,
          dotSize,
        );
      }
    }
  }, [generated, cellPx, mapPx, dim]);

  // Viewport rect in minimap pixels, clamped to map bounds.
  const ratio = cellPx / tilePx;
  const rawX = (-16 - pan.x) / zoom * ratio;
  const rawY = (-16 - pan.y) / zoom * ratio;
  const rawW = wrapperSize.w / zoom * ratio;
  const rawH = wrapperSize.h / zoom * ratio;
  const vpX = Math.max(0, rawX);
  const vpY = Math.max(0, rawY);
  const vpW = Math.max(2, Math.min(mapPx - vpX, rawX + rawW - vpX));
  const vpH = Math.max(2, Math.min(mapPx - vpY, rawY + rawH - vpY));

  const fromEvent = (e) => {
    const r = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const cellX = mx / cellPx;
    const cellY = my / cellPx;
    return [cellX, cellY];
  };

  const onDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    const [cx, cy] = fromEvent(e);
    onCenterAt(cx, cy);
  };
  const onMove = (e) => {
    if (!draggingRef.current) return;
    const [cx, cy] = fromEvent(e);
    onCenterAt(cx, cy);
  };
  const onUp = () => { draggingRef.current = false; };

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  });

  return (
    <div
      ref={containerRef}
      className="absolute bottom-3 right-3 z-20 bg-forge-panel2/90 border border-forge-gold rounded shadow-gold p-1 cursor-crosshair"
      style={{ width: mapPx + 8, height: mapPx + 8 }}
      onMouseDown={onDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative" style={{ width: mapPx, height: mapPx }}>
        <canvas ref={canvasRef} className="block" />
        <div
          className="absolute border-2 border-forge-gold pointer-events-none"
          style={{ left: vpX, top: vpY, width: vpW, height: vpH }}
        />
      </div>
    </div>
  );
}
