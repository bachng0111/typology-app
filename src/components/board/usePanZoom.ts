import { useEffect, type RefObject } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { clampZoom, currentViewport, spacePan, zoomAt } from './viewport';

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/** Can this element scroll further in the wheel direction? Then let it scroll natively. */
function canScroll(target: EventTarget | null, dy: number): boolean {
  const body = target instanceof Element ? target.closest<HTMLElement>('.bucket-body') : null;
  if (!body || body.scrollHeight <= body.clientHeight) return false;
  return dy < 0 ? body.scrollTop > 0 : body.scrollTop + body.clientHeight < body.scrollHeight - 1;
}

/** Zoom factor for a Ctrl/⌘+wheel event (trackpad pinch in Chrome/Edge/Firefox arrives this way). */
function wheelZoomFactor(e: WheelEvent): number {
  const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
  return Math.exp(-e.deltaY * unit * 0.0025);
}

/** Safari's non-standard pinch event (not in the TS DOM lib). */
interface GestureEventLike extends Event {
  scale: number;
  clientX: number;
  clientY: number;
}

/**
 * Pan with drag on empty space (or anywhere with space held / middle button),
 * wheel/trackpad scroll to pan, Ctrl/⌘+wheel or pinch to zoom around the cursor.
 */
export function usePanZoom(ref: RefObject<HTMLDivElement | null>, isBackground: (t: EventTarget | null) => boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const setViewport = useBoardStore.getState().setViewport;
    // While a Safari gesture is active, ignore any Ctrl+wheel it may also emit (avoids double zoom).
    let gestureActive = false;

    const onWheel = (e: WheelEvent) => {
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (!gestureActive) zoomAt(wheelZoomFactor(e), e.clientX - r.left, e.clientY - r.top);
        return;
      }
      if (canScroll(e.target, e.deltaY)) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? el.clientHeight : 1;
      const v = currentViewport();
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
      setViewport({ ...v, x: v.x - dx * unit, y: v.y - dy * unit });
    };

    // Pinch/Ctrl+wheel outside the canvas (toolbar, hint bar, dialogs) must not zoom the browser page,
    // which would push the toolbar out of view. Zoom the board around its centre instead.
    const onWindowWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.defaultPrevented) return;
      e.preventDefault();
      if (!gestureActive && !document.querySelector('dialog[open]')) zoomAt(wheelZoomFactor(e));
    };

    // Safari reports trackpad pinch as gesture events rather than Ctrl+wheel.
    let gestureStartZoom = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureActive = true;
      gestureStartZoom = currentViewport().zoom;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as GestureEventLike;
      if (!Number.isFinite(g.scale) || g.scale <= 0 || document.querySelector('dialog[open]')) return;
      const r = el.getBoundingClientRect();
      const inside = g.clientX >= r.left && g.clientX <= r.right && g.clientY >= r.top && g.clientY <= r.bottom;
      const factor = (gestureStartZoom * g.scale) / currentViewport().zoom;
      if (inside) zoomAt(factor, g.clientX - r.left, g.clientY - r.top);
      else zoomAt(factor);
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      gestureActive = false;
    };

    // Active pointers for pan / pinch.
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch: { dist: number; zoom: number } | null = null;
    let moved = false;

    const onPointerDown = (e: PointerEvent) => {
      const panAnywhere = e.button === 1 || (e.button === 0 && spacePan.active);
      if (!panAnywhere && !(e.button === 0 && isBackground(e.target))) return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      if (document.activeElement instanceof HTMLElement && isTyping(document.activeElement)) document.activeElement.blur();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: currentViewport().zoom };
      }
      el.classList.add('is-panning');
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* pointer may already be released */
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);
      if (Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y) > 0) moved = true;
      const v = currentViewport();
      if (pointers.size >= 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const r = el.getBoundingClientRect();
        const mid = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
        const zoom = clampZoom((pinch.zoom * dist) / Math.max(pinch.dist, 1));
        const k = zoom / v.zoom;
        // Zoom around the midpoint, plus pan by half this pointer's movement.
        setViewport({
          zoom,
          x: mid.x - (mid.x - v.x) * k + (cur.x - prev.x) / 2,
          y: mid.y - (mid.y - v.y) * k + (cur.y - prev.y) / 2,
        });
      } else {
        setViewport({ ...v, x: v.x + cur.x - prev.x, y: v.y + cur.y - prev.y });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) {
        el.classList.remove('is-panning');
        // A click (no movement) on empty space clears the selection.
        if (!moved && e.type === 'pointerup') useBoardStore.getState().select(null);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target) && !e.repeat) {
        spacePan.active = true;
        el.classList.add('space-pan');
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePan.active = false;
        el.classList.remove('space-pan');
      }
    };
    const onBlur = () => {
      spacePan.active = false;
      el.classList.remove('space-pan');
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('wheel', onWindowWheel, { passive: false });
    document.addEventListener('gesturestart', onGestureStart, { passive: false });
    document.addEventListener('gesturechange', onGestureChange, { passive: false });
    document.addEventListener('gestureend', onGestureEnd, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('wheel', onWindowWheel);
      document.removeEventListener('gesturestart', onGestureStart);
      document.removeEventListener('gesturechange', onGestureChange);
      document.removeEventListener('gestureend', onGestureEnd);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      spacePan.active = false;
    };
  }, [ref, isBackground]);
}
