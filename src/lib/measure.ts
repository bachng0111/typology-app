/** Shared card metrics. Keep in sync with `.card` in styles/board.css. */
export const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const CARD_FONT_SIZE = 14;
export const CARD_FONT = `500 ${CARD_FONT_SIZE}px ${FONT_FAMILY}`;
export const CARD_LINE_HEIGHT = 20;
export const CARD_PAD_X = 12;
export const CARD_PAD_Y = 8;
export const CARD_BORDER = 1;
export const CARD_MAX_WIDTH = 200;
export const CARD_MIN_WIDTH = 48;

export interface Size {
  w: number;
  h: number;
}

let ctx: CanvasRenderingContext2D | null | undefined;

function getContext(): CanvasRenderingContext2D | null {
  if (ctx !== undefined) return ctx;
  try {
    ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  } catch {
    ctx = null;
  }
  if (ctx) ctx.font = CARD_FONT;
  return ctx;
}

const widthCache = new Map<string, number>();

export function textWidth(text: string): number {
  const cached = widthCache.get(text);
  if (cached !== undefined) return cached;
  const c = getContext();
  // Fallback (tests / no canvas): average glyph width for a 14px sans font.
  const w = c ? c.measureText(text).width : text.length * 7.6;
  if (widthCache.size > 20000) widthCache.clear();
  widthCache.set(text, w);
  return w;
}

/** Greedy word wrap that mirrors CSS `overflow-wrap: anywhere` closely enough for layout. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number = textWidth): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  const pushLongWord = (word: string) => {
    let chunk = '';
    for (const ch of word) {
      if (measure(chunk + ch) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else chunk += ch;
    }
    return chunk;
  };
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = measure(word) > maxWidth ? pushLongWord(word) : word;
  }
  if (line || lines.length === 0) lines.push(line);
  return lines;
}

const sizeCache = new Map<string, Size>();

/** Estimated rendered size of an ungrouped card. */
export function cardSize(text: string): Size {
  const cached = sizeCache.get(text);
  if (cached) return cached;
  const inner = CARD_MAX_WIDTH - 2 * CARD_PAD_X - 2 * CARD_BORDER;
  const lines = wrapText(text, inner);
  const widest = Math.max(...lines.map((l) => textWidth(l)));
  const size = {
    w: Math.max(CARD_MIN_WIDTH, Math.min(CARD_MAX_WIDTH, Math.ceil(widest) + 2 * CARD_PAD_X + 2 * CARD_BORDER)),
    h: lines.length * CARD_LINE_HEIGHT + 2 * CARD_PAD_Y + 2 * CARD_BORDER,
  };
  if (sizeCache.size > 20000) sizeCache.clear();
  sizeCache.set(text, size);
  return size;
}
