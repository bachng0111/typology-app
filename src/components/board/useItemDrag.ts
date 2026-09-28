import { useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { currentViewport, getGhostEl, getViewportEl, panBy, spacePan, toBoard } from './viewport';

const DRAG_THRESHOLD = 4;
const EDGE = 36;
const EDGE_SPEED = 16;

/** Auto-pan speed: 0 outside the edge zone, ramping up as the pointer nears the edge. */
function edgeSpeed(pos: number, min: number, max: number): number {
  if (pos < min + EDGE) return EDGE_SPEED * Math.min(1, (min + EDGE - pos) / EDGE);
  if (pos > max - EDGE) return -EDGE_SPEED * Math.min(1, (pos - (max - EDGE)) / EDGE);
  return 0;
}

/** Topmost bucket containing the board point, or null. */
export function hitBucket(p: { x: number; y: number }): string | null {
  const { board, raisedBucketId } = useBoardStore.getState();
  if (!board) return null;
  const raised = raisedBucketId ? board.buckets[raisedBucketId] : undefined;
  if (raised && p.x >= raised.x && p.x <= raised.x + raised.w && p.y >= raised.y && p.y <= raised.y + raised.h) {
    return raised.id;
  }
  for (let i = board.bucketOrder.length - 1; i >= 0; i--) {
    const b = board.buckets[board.bucketOrder[i]];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b.id;
  }
  return null;
}

/** Insertion index among the bucket's chips (excluding the dragged item) for a pointer position. */
export function dropIndexAt(bucketId: string, draggedId: string, clientX: number, clientY: number): number {
  const body = document.querySelector<HTMLElement>(`[data-bucket-body="${CSS.escape(bucketId)}"]`);
  if (!body) return 0;
  const chips = Array.from(body.querySelectorAll<HTMLElement>('[data-chip-id]')).filter(
    (c) => c.dataset.chipId !== draggedId,
  );
  for (let i = 0; i < chips.length; i++) {
    const r = chips[i].getBoundingClientRect();
    if (clientY < r.top) return i;
    if (clientY <= r.bottom && clientX < r.left + r.width / 2) return i;
  }
  return chips.length;
}

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('button, input, textarea, [data-no-drag]');
}

/**
 * Pointer-driven drag for items (loose cards and chips in buckets).
 * While moving, only the floating ghost element is touched; the store is updated once on drop.
 */
export function useItemDrag(itemId: string) {
  return useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || spacePan.active || isInteractive(e.target)) return;
      e.stopPropagation();
      const el = e.currentTarget;
      const store = useBoardStore.getState();
      store.select(itemId);

      const start = { x: e.clientX, y: e.clientY };
      const rect = el.getBoundingClientRect();
      const zoom = currentViewport().zoom;
      const grab = { x: (start.x - rect.left) / zoom, y: (start.y - rect.top) / zoom };
      const pointerId = e.pointerId;
      let last = { ...start };
      let dragging = false;
      let frame = 0;

      const placeGhost = () => {
        const ghost = getGhostEl();
        if (!ghost) return;
        const p = toBoard(last.x, last.y);
        ghost.style.transform = `translate(${p.x - grab.x}px, ${p.y - grab.y}px)`;
      };

      const tick = () => {
        frame = 0;
        // Auto-pan when dragging close to the viewport edge.
        const vp = getViewportEl()?.getBoundingClientRect();
        let dx = 0;
        let dy = 0;
        if (vp) {
          dx = edgeSpeed(last.x, vp.left, vp.right);
          dy = edgeSpeed(last.y, vp.top, vp.bottom);
        }
        if (dx || dy) panBy(dx, dy);
        placeGhost();
        const p = toBoard(last.x, last.y);
        const bucketId = hitBucket(p);
        const index = bucketId ? dropIndexAt(bucketId, itemId, last.x, last.y) : null;
        useBoardStore.getState().setDrag(itemId, bucketId, index);
        if (dx || dy) frame = requestAnimationFrame(tick);
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('keydown', onKey);
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        document.body.classList.remove('is-dragging-item');
      };

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        last = { x: ev.clientX, y: ev.clientY };
        if (!dragging) {
          if (Math.hypot(last.x - start.x, last.y - start.y) < DRAG_THRESHOLD) return;
          dragging = true;
          document.body.classList.add('is-dragging-item');
          const ghost = getGhostEl();
          if (ghost) {
            ghost.style.width = '';
            ghost.style.maxWidth = `${Math.max(120, rect.width / zoom)}px`;
          }
          placeGhost();
          useBoardStore.getState().setDrag(itemId, null, null);
        }
        if (!frame) frame = requestAnimationFrame(tick);
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        cleanup();
        if (!dragging) return;
        const s = useBoardStore.getState();
        const p = toBoard(ev.clientX, ev.clientY);
        const bucketId = hitBucket(p);
        const index = bucketId ? dropIndexAt(bucketId, itemId, ev.clientX, ev.clientY) : undefined;
        s.setDrag(null, null, null);
        if (bucketId) s.assignItem(itemId, bucketId, index);
        else s.placeItemOnBoard(itemId, p.x - grab.x, p.y - grab.y);
      };

      const onCancel = () => {
        cleanup();
        useBoardStore.getState().setDrag(null, null, null);
      };

      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape' && dragging) onCancel();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey);
    },
    [itemId],
  );
}
