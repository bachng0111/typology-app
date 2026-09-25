import { memo, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { MIN_BUCKET_H, MIN_BUCKET_W } from '../../store/operations';
import { bucketColor } from '../../lib/colors';
import { bucketLabel } from '../../lib/export';
import { confirmAction } from '../ConfirmDialog';
import { BucketChip } from './ItemCard';
import InlineEditor from './InlineEditor';
import { spacePan } from './viewport';
import { startPointerDrag } from './pointerDrag';

type Live = { x: number; y: number; w: number; h: number };

export const BucketView = memo(function BucketView({ id, index }: { id: string; index: number }) {
  const bucket = useBoardStore((s) => s.board?.buckets[id]);
  const hovered = useBoardStore((s) => s.hoverBucketId === id);
  const dropIndex = useBoardStore((s) => (s.hoverBucketId === id ? s.dropIndex : null));
  const dragSource = useBoardStore((s) => s.draggingItemId);
  const renaming = useBoardStore((s) => s.renamingBucketId === id);
  const raised = useBoardStore((s) => s.raisedBucketId === id);
  const [live, setLiveState] = useState<Live | null>(null);
  const liveRef = useRef<Live | null>(null);
  const setLive = (l: Live | null) => {
    liveRef.current = l;
    setLiveState(l);
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  if (!bucket) return null;
  const color = bucketColor(bucket.colorIndex);
  const r = live ?? bucket;
  const label = bucketLabel(bucket.name, index);
  const unnamed = !bucket.name.trim();
  const itemIds = bucket.itemIds;
  const visibleIds = dragSource ? itemIds.filter((i) => i !== dragSource) : itemIds;

  const setRenaming = (on: boolean) => useBoardStore.getState().setRenamingBucket(on ? id : null);

  const onHeaderDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 || spacePan.active) return;
    if ((e.target as Element).closest('button, input, textarea')) return;
    e.stopPropagation();
    const s = useBoardStore.getState();
    s.raiseBucket(id);
    s.select(null);
    const origin = { x: bucket.x, y: bucket.y };
    startPointerDrag(
      e,
      (dx, dy) => setLive({ x: origin.x + dx, y: origin.y + dy, w: bucket.w, h: bucket.h }),
      () => {
        const l = liveRef.current;
        if (l) useBoardStore.getState().moveBucket(id, l.x, l.y);
        setLive(null);
      },
    );
  };

  const onResizeDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    useBoardStore.getState().raiseBucket(id);
    const origin = { w: bucket.w, h: bucket.h };
    startPointerDrag(
      e,
      (dx, dy) =>
        setLive({
          x: bucket.x,
          y: bucket.y,
          w: Math.max(MIN_BUCKET_W, origin.w + dx),
          h: Math.max(MIN_BUCKET_H, origin.h + dy),
        }),
      () => {
        const l = liveRef.current;
        if (l) useBoardStore.getState().resizeBucket(id, l.w, l.h);
        setLive(null);
      },
    );
  };

  const onDelete = async () => {
    setMenuOpen(false);
    const n = itemIds.length;
    if (n > 0) {
      const { ok } = await confirmAction({
        title: `Delete bucket “${label}”?`,
        message: `Its ${n} item${n === 1 ? '' : 's'} will return to the board. Nothing else is deleted.`,
        confirmLabel: 'Delete bucket',
        danger: true,
      });
      if (!ok) return;
    }
    const s = useBoardStore.getState();
    s.deleteBucket(id);
    s.showToast(`Deleted bucket “${label}”`, { undo: true });
  };

  const style = {
    transform: `translate(${r.x}px, ${r.y}px)`,
    width: r.w,
    height: r.h,
    '--accent': color.accent,
    '--tint': color.tint,
    '--chip': color.chip,
  } as CSSProperties;

  return (
    <section
      className={`bucket ${hovered ? 'is-drop-target' : ''} ${live ? 'is-moving' : ''} ${itemIds.length === 0 ? 'is-empty' : ''} ${raised ? 'is-raised' : ''}`}
      style={style}
      data-bucket-id={id}
      aria-label={`Bucket ${label}, ${itemIds.length} items`}
    >
      <header className="bucket-header" onPointerDown={onHeaderDown} title="Drag to move · double-click the name to rename">
        {renaming ? (
          <InlineEditor
            initial={bucket.name}
            maxLength={80}
            placeholder="Name this bucket"
            ariaLabel="Bucket name"
            className="bucket-name-input"
            onCommit={(name) => {
              useBoardStore.getState().renameBucket(id, name);
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <h3
            className={`bucket-name ${unnamed ? 'is-unnamed' : ''}`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setRenaming(true);
            }}
          >
            {unnamed ? 'Unnamed bucket' : bucket.name}
          </h3>
        )}
        <span className="bucket-count" title={`${itemIds.length} items`}>
          {itemIds.length}
        </span>
        <div className="bucket-menu" ref={menuRef}>
          <button
            className="bucket-menu-btn"
            aria-label={`Bucket options for ${label}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="menu" role="menu">
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setRenaming(true);
                }}
              >
                Rename
              </button>
              <button role="menuitem" className="danger" onClick={onDelete}>
                Delete bucket
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="bucket-body" data-bucket-body={id}>
        {visibleIds.length === 0 && !hovered ? (
          <p className="bucket-empty">Drag items here</p>
        ) : (
          visibleIds.map((iid, i) => (
            <FragmentWithMarker key={iid} showMarker={dropIndex === i}>
              <BucketChip id={iid} />
            </FragmentWithMarker>
          ))
        )}
        {hovered && dropIndex !== null && dropIndex >= visibleIds.length && <span className="drop-marker" />}
      </div>

      {hovered && <div className="drop-label">Drop into “{label}”</div>}
      <div className="bucket-resize" onPointerDown={onResizeDown} title="Drag to resize" aria-hidden />
    </section>
  );
});

function FragmentWithMarker({ showMarker, children }: { showMarker: boolean; children: ReactNode }) {
  return (
    <>
      {showMarker && <span className="drop-marker" />}
      {children}
    </>
  );
}
