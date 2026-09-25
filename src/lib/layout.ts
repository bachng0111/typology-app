import type { Rect } from '../store/types';
import type { Size } from './measure';

export type Rng = () => number;

export interface PackOptions {
  origin?: { x: number; y: number };
  /** Rectangles that placed cards must not overlap (buckets, other cards). */
  obstacles?: Rect[];
  /** Minimum spacing between cards and obstacles. */
  gap?: number;
  /** Extra random horizontal spacing (0..jitterX) for a scattered look. */
  jitterX?: number;
  /** Random vertical offset (0..jitterY) within a row. */
  jitterY?: number;
  /** Width:height ratio of the area the cards are spread over. */
  aspect?: number;
  rng?: Rng;
}

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return (
    a.x < b.x + b.w + gap &&
    b.x < a.x + a.w + gap &&
    a.y < b.y + b.h + gap &&
    b.y < a.y + a.h + gap
  );
}

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Uniform grid over obstacles so collision checks stay fast with thousands of cards.
 */
class SpatialIndex {
  private cells = new Map<string, Rect[]>();
  constructor(private cellSize = 256) {}

  private keys(r: Rect): string[] {
    const s = this.cellSize;
    const out: string[] = [];
    for (let cx = Math.floor(r.x / s); cx <= Math.floor((r.x + r.w) / s); cx++) {
      for (let cy = Math.floor(r.y / s); cy <= Math.floor((r.y + r.h) / s); cy++) out.push(`${cx},${cy}`);
    }
    return out;
  }

  add(r: Rect) {
    for (const k of this.keys(r)) {
      const list = this.cells.get(k);
      if (list) list.push(r);
      else this.cells.set(k, [r]);
    }
  }

  /** Returns an obstacle overlapping `r` (with gap), or null. */
  hit(r: Rect, gap: number): Rect | null {
    const probe = { x: r.x - gap, y: r.y - gap, w: r.w + 2 * gap, h: r.h + 2 * gap };
    for (const k of this.keys(probe)) {
      const list = this.cells.get(k);
      if (!list) continue;
      for (const o of list) if (rectsOverlap(r, o, gap)) return o;
    }
    return null;
  }
}

/**
 * Scatter cards in randomized rows starting at `origin`, never overlapping each other
 * or any obstacle. Returns top-left positions in the same order as `sizes`.
 */
export function packCards(sizes: Size[], opts: PackOptions = {}): { x: number; y: number }[] {
  const {
    origin = { x: 0, y: 0 },
    obstacles = [],
    gap = 14,
    jitterX = 36,
    jitterY = 22,
    aspect = 1.6,
    rng = Math.random,
  } = opts;
  if (sizes.length === 0) return [];

  const index = new SpatialIndex();
  for (const o of obstacles) index.add(o);

  const area = sizes.reduce((sum, s) => sum + (s.w + gap + jitterX / 2) * (s.h + gap + jitterY / 2), 0);
  const maxCardW = Math.max(...sizes.map((s) => s.w));
  const rowWidth = Math.max(maxCardW + gap, Math.sqrt(area * aspect));

  const positions: { x: number; y: number }[] = [];
  let x = origin.x;
  let rowY = origin.y;
  let rowH = 0;
  let guard = 0;

  for (const size of sizes) {
    const dy = rng() * jitterY;
    let placed = false;
    while (!placed) {
      if (++guard > 1_000_000) throw new Error('packCards: layout did not converge');
      if (x > origin.x && x + size.w > origin.x + rowWidth) {
        x = origin.x;
        rowY += (rowH || size.h) + gap;
        rowH = 0;
      }
      const rect = { x, y: rowY + dy, w: size.w, h: size.h };
      const hit = index.hit(rect, gap);
      if (hit) {
        // Jump past the obstacle; if it blocks the whole row the wrap logic advances rowY.
        x = Math.max(x + 1, hit.x + hit.w + gap);
        if (x - origin.x > rowWidth * 4) {
          x = origin.x;
          rowY += Math.max(rowH, size.h) + gap;
          rowH = 0;
        }
        continue;
      }
      positions.push({ x: rect.x, y: rect.y });
      index.add(rect);
      rowH = Math.max(rowH, size.h + dy);
      x += size.w + gap + rng() * jitterX;
      placed = true;
    }
  }
  return positions;
}

export function boundsOf(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
