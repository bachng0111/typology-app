import type { Board, Rect } from '../store/types';
import { bucketColor } from './colors';
import { boundsOf } from './layout';
import {
  CARD_BORDER,
  CARD_FONT,
  CARD_LINE_HEIGHT,
  CARD_MAX_WIDTH,
  CARD_PAD_X,
  CARD_PAD_Y,
  FONT_FAMILY,
  cardSize,
  wrapText,
} from './measure';
import { bucketLabel } from './export';
import { itemRect, ungroupedIds } from '../store/operations';

/** Chip metrics. Keep in sync with `.chip` / `.bucket` in styles/board.css. */
export const BUCKET_HEADER_H = 44;
export const BUCKET_PAD = 10;
const CHIP_FONT = `500 13px ${FONT_FAMILY}`;
const CHIP_LINE = 18;
const CHIP_PAD_X = 10;
const CHIP_PAD_Y = 5;
const CHIP_GAP = 6;
const PADDING = 48;
const TITLE_H = 56;

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
}

interface ChipLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
}

function layoutChips(ctx: CanvasRenderingContext2D, texts: string[], innerW: number): { chips: ChipLayout[]; height: number } {
  ctx.font = CHIP_FONT;
  const measure = (s: string) => ctx.measureText(s).width;
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

/** Render the board to a PNG blob by drawing directly from state. */
export async function renderBoardPNG(board: Board): Promise<Blob> {
  const measureCanvas = document.createElement('canvas').getContext('2d');
  if (!measureCanvas) throw new Error('Canvas is not supported in this browser.');

  // Pre-compute bucket layouts; buckets grow to show every item in the image.
  const bucketDraws = board.bucketOrder.map((bid, i) => {
    const b = board.buckets[bid];
    const innerW = b.w - 2 * BUCKET_PAD;
    const { chips, height } = layoutChips(
      measureCanvas,
      b.itemIds.map((id) => board.items[id]?.text ?? ''),
      innerW,
    );
    const h = Math.max(b.h, BUCKET_HEADER_H + BUCKET_PAD * 2 + height);
    return { b, rect: { x: b.x, y: b.y, w: b.w, h }, chips, label: bucketLabel(b.name, i) };
  });
  const loose = ungroupedIds(board).map((id) => board.items[id]);
  const bounds = boundsOf([...bucketDraws.map((d) => d.rect), ...loose.map(itemRect)]) ?? { x: 0, y: 0, w: 400, h: 200 };

  const width = bounds.w + PADDING * 2;
  const height = bounds.h + PADDING * 2 + TITLE_H;
  const scale = Math.max(0.25, Math.min(2, 16000 / width, 16000 / height, Math.sqrt(120e6 / (width * height))));

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');
  ctx.scale(scale, scale);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 22px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(board.name, PADDING, PADDING / 2 + TITLE_H / 2);

  ctx.translate(PADDING - bounds.x, PADDING + TITLE_H - bounds.y);

  for (const { b, rect, chips, label } of bucketDraws) {
    const color = bucketColor(b.colorIndex);
    roundRect(ctx, rect, 14);
    ctx.fillStyle = color.tint;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color.accent;
    ctx.stroke();

    ctx.save();
    roundRect(ctx, { x: rect.x, y: rect.y, w: rect.w, h: BUCKET_HEADER_H }, 14);
    ctx.clip();
    ctx.fillStyle = color.accent;
    ctx.fillRect(rect.x, rect.y, rect.w, BUCKET_HEADER_H);
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = `700 15px ${FONT_FAMILY}`;
    const count = String(b.itemIds.length);
    const countW = ctx.measureText(count).width + 16;
    let title = label;
    const maxTitle = rect.w - 2 * BUCKET_PAD - countW - 8;
    while (title.length > 1 && ctx.measureText(title).width > maxTitle) title = title.slice(0, -2) + '…';
    ctx.fillText(title, rect.x + 12, rect.y + BUCKET_HEADER_H / 2);
    roundRect(ctx, { x: rect.x + rect.w - BUCKET_PAD - countW, y: rect.y + 12, w: countW, h: 20 }, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 12px ${FONT_FAMILY}`;
    ctx.fillText(count, rect.x + rect.w - BUCKET_PAD - countW + 8, rect.y + 22);

    ctx.font = CHIP_FONT;
    for (const c of chips) {
      const cx = rect.x + BUCKET_PAD + c.x;
      const cy = rect.y + BUCKET_HEADER_H + BUCKET_PAD + c.y;
      roundRect(ctx, { x: cx, y: cy, w: c.w, h: c.h }, 6);
      ctx.fillStyle = color.chip;
      ctx.fill();
      ctx.fillStyle = color.accent;
      ctx.fillRect(cx, cy + 3, 3, c.h - 6);
      ctx.fillStyle = '#0f172a';
      c.lines.forEach((line, li) => ctx.fillText(line, cx + CHIP_PAD_X + 2, cy + CHIP_PAD_Y + CHIP_LINE * li + CHIP_LINE / 2));
    }
  }

  ctx.font = CARD_FONT;
  const inner = CARD_MAX_WIDTH - 2 * CARD_PAD_X - 2 * CARD_BORDER;
  for (const item of loose) {
    const s = cardSize(item.text);
    const r = { x: item.x, y: item.y, w: s.w, h: s.h };
    ctx.save();
    ctx.shadowColor = 'rgba(15,23,42,0.12)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    roundRect(ctx, r, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    wrapText(item.text, inner, (t) => ctx.measureText(t).width).forEach((line, li) =>
      ctx.fillText(line, r.x + CARD_PAD_X + CARD_BORDER, r.y + CARD_PAD_Y + CARD_BORDER + CARD_LINE_HEIGHT * li + CARD_LINE_HEIGHT / 2),
    );
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))), 'image/png'),
  );
}
