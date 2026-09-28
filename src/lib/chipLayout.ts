import { FONT_FAMILY, wrapText } from './measure';

/** Chip and bucket metrics. Keep in sync with `.chip` / `.bucket` in styles/board.css. */
export const BUCKET_HEADER_H = 44;
export const BUCKET_PAD = 10;
export const BUCKET_BORDER = 2;
export const CHIP_FONT = `500 13px ${FONT_FAMILY}`;
export const CHIP_LINE = 18;
export const CHIP_PAD_X = 10;
export const CHIP_PAD_Y = 5;
export const CHIP_GAP = 6;

export interface ChipLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
}

/** Flow chips left-to-right, wrapping rows, within `innerW` (mirrors the bucket's flex-wrap). */
export function layoutChips(
  texts: string[],
  innerW: number,
  measure: (s: string) => number = chipTextWidth,
): { chips: ChipLayout[]; height: number } {
  const chips: ChipLayout[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const text of texts) {
    const lines = wrapText(text, innerW - 2 * CHIP_PAD_X - 4, measure);
    const w = Math.min(innerW, Math.ceil(Math.max(...lines.map(measure))) + 2 * CHIP_PAD_X + 4);
    const h = lines.length * CHIP_LINE + 2 * CHIP_PAD_Y;
    if (x > 0 && x + w > innerW) {
      x = 0;
      y += rowH + CHIP_GAP;
      rowH = 0;
    }
    chips.push({ x, y, w, h, lines });
    x += w + CHIP_GAP;
    rowH = Math.max(rowH, h);
  }
  return { chips, height: y + rowH };
}

let ctx: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

/** Width of `text` in the chip font (canvas-measured; estimated when no canvas is available). */
export function chipTextWidth(text: string): number {
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  if (ctx === undefined) {
    try {
      ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      ctx = null;
    }
    if (ctx) ctx.font = CHIP_FONT;
  }
  const w = ctx ? ctx.measureText(text).width : text.length * 7.1;
  if (cache.size > 20000) cache.clear();
  cache.set(text, w);
  return w;
}

const WIDTHS = [260, 320, 380, 460, 560];
const DROP_ROOM = 40;
const MIN_H = 160;

/** Bucket size that shows all of `texts` without scrolling, kept roughly square. */
export function bucketSizeFor(texts: string[]): { w: number; h: number } {
  if (texts.length === 0) return { w: 260, h: 220 };
  let size = { w: WIDTHS[0], h: 0 };
  for (const w of WIDTHS) {
    const inner = w - 2 * BUCKET_PAD - 2 * BUCKET_BORDER;
    const { height } = layoutChips(texts, inner);
    const h = Math.max(MIN_H, Math.ceil(BUCKET_HEADER_H + 2 * BUCKET_PAD + 2 * BUCKET_BORDER + height + DROP_ROOM));
    size = { w, h };
    if (h <= w * 1.2) break;
  }
  return size;
}
