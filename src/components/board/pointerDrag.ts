import type { PointerEvent as ReactPointerEvent } from 'react';
import { currentViewport } from './viewport';

/** Drag helper for moving/resizing: calls onMove with the board-space delta, onEnd on release. */
export function startPointerDrag(
  e: ReactPointerEvent,
  onMove: (dx: number, dy: number) => void,
  onEnd: (moved: boolean) => void,
) {
  const start = { x: e.clientX, y: e.clientY };
  const zoom = currentViewport().zoom;
  const id = e.pointerId;
  let moved = false;
  let frame = 0;
  let last = start;
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    last = { x: ev.clientX, y: ev.clientY };
    if (!moved && Math.hypot(last.x - start.x, last.y - start.y) < 3) return;
    moved = true;
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        onMove((last.x - start.x) / zoom, (last.y - start.y) / zoom);
      });
  };
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (frame) cancelAnimationFrame(frame);
    if (moved) onMove((last.x - start.x) / zoom, (last.y - start.y) / zoom);
    onEnd(moved);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}
