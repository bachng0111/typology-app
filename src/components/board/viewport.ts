/**
 * Screen <-> board coordinate helpers and viewport commands.
 * There is only ever one board canvas mounted, so its elements are registered here.
 */
import { useBoardStore } from '../../store/boardStore';
import { contentBounds } from '../../store/operations';
import type { Rect, Viewport } from '../../store/types';

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 3;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

let viewportEl: HTMLDivElement | null = null;
let ghostEl: HTMLDivElement | null = null;

export const registerViewportEl = (el: HTMLDivElement | null) => {
  viewportEl = el;
};
export const registerGhostEl = (el: HTMLDivElement | null) => {
  ghostEl = el;
};
export const getViewportEl = () => viewportEl;
export const getGhostEl = () => ghostEl;

export function currentViewport(): Viewport {
  return useBoardStore.getState().board?.viewport ?? { x: 0, y: 0, zoom: 1 };
}

function setViewport(v: Viewport) {
  useBoardStore.getState().setViewport(v);
}

export function toBoard(clientX: number, clientY: number): { x: number; y: number } {
  const v = currentViewport();
  const r = viewportEl?.getBoundingClientRect() ?? { left: 0, top: 0 };
  return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
}

export function viewportSize(): { w: number; h: number } {
  return { w: viewportEl?.clientWidth ?? 1200, h: viewportEl?.clientHeight ?? 800 };
}

export function visibleCenter(): { x: number; y: number } {
  const v = currentViewport();
  const { w, h } = viewportSize();
  return { x: (w / 2 - v.x) / v.zoom, y: (h / 2 - v.y) / v.zoom };
}

export function visibleRect(): Rect {
  const v = currentViewport();
  const { w, h } = viewportSize();
  return { x: -v.x / v.zoom, y: -v.y / v.zoom, w: w / v.zoom, h: h / v.zoom };
}

/** Zoom by `factor`, keeping the point at local screen coords (sx, sy) fixed. */
export function zoomAt(factor: number, sx?: number, sy?: number) {
  const v = currentViewport();
  const { w, h } = viewportSize();
  const px = sx ?? w / 2;
  const py = sy ?? h / 2;
  const zoom = clampZoom(v.zoom * factor);
  const k = zoom / v.zoom;
  setViewport({ zoom, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
}

export function panBy(dx: number, dy: number) {
  const v = currentViewport();
  setViewport({ ...v, x: v.x + dx, y: v.y + dy });
}

export function fitRect(rect: Rect, maxZoom = 1.25) {
  const { w, h } = viewportSize();
  const pad = 48;
  const zoom = clampZoom(Math.min(maxZoom, (w - pad * 2) / Math.max(rect.w, 1), (h - pad * 2) / Math.max(rect.h, 1)));
  setViewport({
    zoom,
    x: w / 2 - (rect.x + rect.w / 2) * zoom,
    y: h / 2 - (rect.y + rect.h / 2) * zoom,
  });
}

export function fitToContent() {
  const board = useBoardStore.getState().board;
  if (!board) return;
  const b = contentBounds(board);
  if (!b) setViewport({ x: viewportSize().w / 2, y: viewportSize().h / 3, zoom: 1 });
  else fitRect(b);
}

/** Pan (without zooming) so that `rect` is visible, if it isn't already. */
export function ensureVisible(rect: Rect) {
  const vis = visibleRect();
  const inside = rect.x >= vis.x && rect.y >= vis.y && rect.x + rect.w <= vis.x + vis.w && rect.y + rect.h <= vis.y + vis.h;
  if (inside) return;
  const v = currentViewport();
  const { w, h } = viewportSize();
  setViewport({ ...v, x: w / 2 - (rect.x + rect.w / 2) * v.zoom, y: h / 2 - (rect.y + rect.h / 2) * v.zoom });
}

/** Set while the space bar is held: any drag pans the board. */
export const spacePan = { active: false };
