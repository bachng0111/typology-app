import { describe, expect, it } from 'vitest';
import { packCards, rectsOverlap } from './layout';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('packCards', () => {
  it('places 2000 variably sized cards without overlap', () => {
    const rng = seeded(1);
    const sizes = Array.from({ length: 2000 }, () => ({ w: 48 + Math.floor(rng() * 152), h: 38 + 20 * Math.floor(rng() * 3) }));
    const pos = packCards(sizes, { rng });
    const rects = pos.map((p, i) => ({ ...p, ...sizes[i] }));
    // Check neighbours via sorting by x to keep the test fast.
    const sorted = rects.slice().sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length && sorted[j].x < sorted[i].x + sorted[i].w; j++) {
        expect(rectsOverlap(sorted[i], sorted[j])).toBe(false);
      }
    }
  });

  it('avoids obstacles', () => {
    const obstacle = { x: 0, y: 0, w: 500, h: 300 };
    const sizes = Array.from({ length: 50 }, () => ({ w: 100, h: 38 }));
    const pos = packCards(sizes, { obstacles: [obstacle], rng: seeded(2) });
    for (const [i, p] of pos.entries()) expect(rectsOverlap({ ...p, ...sizes[i] }, obstacle)).toBe(false);
  });

  it('is random across runs', () => {
    const sizes = Array.from({ length: 10 }, () => ({ w: 80, h: 38 }));
    expect(packCards(sizes, { rng: seeded(3) })).not.toEqual(packCards(sizes, { rng: seeded(4) }));
  });
});
