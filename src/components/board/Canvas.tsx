import { memo, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { DEFAULT_BUCKET_W } from '../../store/operations';
import { BucketView } from './BucketView';
import { ItemCard } from './ItemCard';
import { usePanZoom } from './usePanZoom';
import { fitToContent, registerGhostEl, registerViewportEl, toBoard } from './viewport';

/** Applies the viewport transform. Re-renders on pan/zoom without re-rendering its children. */
function World({ children }: { children: ReactNode }) {
  const v = useBoardStore((s) => s.board?.viewport);
  if (!v) return null;
  return (
    <div
      className="world"
      style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`, ['--zoom' as string]: v.zoom }}
    >
      {children}
    </div>
  );
}

const DragGhost = memo(function DragGhost() {
  const text = useBoardStore((s) => (s.draggingItemId ? s.board?.items[s.draggingItemId]?.text : null));
  const target = useBoardStore((s) => (s.hoverBucketId ? s.board?.buckets[s.hoverBucketId] : null));
  return (
    <div
      ref={registerGhostEl}
      className={`card drag-ghost ${text ? 'is-visible' : ''} ${target ? 'over-bucket' : ''}`}
      aria-hidden
    >
      {text}
    </div>
  );
});

function isBackground(target: EventTarget | null): boolean {
  return target instanceof Element && !target.closest('.card, .bucket');
}

export default function Canvas() {
  const vpRef = useRef<HTMLDivElement>(null);
  const items = useBoardStore((s) => s.board!.items);
  const buckets = useBoardStore((s) => s.board!.buckets);
  const bucketOrder = useBoardStore((s) => s.board!.bucketOrder);

  const ungrouped = useMemo(() => {
    const grouped = new Set<string>();
    for (const bid of bucketOrder) for (const iid of buckets[bid].itemIds) grouped.add(iid);
    return Object.keys(items).filter((id) => !grouped.has(id));
  }, [items, buckets, bucketOrder]);

  usePanZoom(vpRef, isBackground);

  useEffect(() => {
    registerViewportEl(vpRef.current);
    const board = useBoardStore.getState().board;
    const v = board?.viewport;
    // A new or never-panned board: frame its content.
    if (v && v.x === 0 && v.y === 0 && v.zoom === 1) fitToContent(board.bucketOrder.length === 0);
    return () => registerViewportEl(null);
  }, []);

  const empty = Object.keys(items).length === 0 && bucketOrder.length === 0;

  return (
    <div
      ref={vpRef}
      className="viewport"
      data-testid="board-viewport"
      onDoubleClick={(e) => {
        if (!isBackground(e.target)) return;
        const p = toBoard(e.clientX, e.clientY);
        useBoardStore.getState().createBucket({ x: p.x - DEFAULT_BUCKET_W / 2, y: p.y - 20 }, true);
      }}
    >
      <World>
        <div className="layer-buckets">
          {bucketOrder.map((id, i) => (
            <BucketView key={id} id={id} index={i} />
          ))}
        </div>
        <div className="layer-cards">
          {ungrouped.map((id) => (
            <ItemCard key={id} id={id} />
          ))}
        </div>
        <DragGhost />
      </World>
      {empty && (
        <div className="board-empty">
          <p>
            <strong>This board is empty.</strong>
          </p>
          <p className="muted">Use “Add items” to paste or upload a list, or double-click anywhere to create a bucket.</p>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {ungrouped.length} ungrouped items
      </span>
    </div>
  );
}
