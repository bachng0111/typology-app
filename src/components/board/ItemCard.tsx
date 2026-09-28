import { memo, useState } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { useItemDrag } from './useItemDrag';
import InlineEditor from './InlineEditor';

function useItemActions(id: string) {
  const deleteItem = () => {
    const s = useBoardStore.getState();
    const text = s.board?.items[id]?.text ?? '';
    s.deleteItems([id]);
    s.showToast(`Deleted “${text.length > 40 ? text.slice(0, 40) + '…' : text}”`, { undo: true });
  };
  const edit = (text: string) => useBoardStore.getState().editItem(id, text);
  return { deleteItem, edit };
}

/** A loose (ungrouped) item on the board. */
export const ItemCard = memo(function ItemCard({ id }: { id: string }) {
  const item = useBoardStore((s) => s.board?.items[id]);
  const selected = useBoardStore((s) => s.selectedItemId === id);
  const dragging = useBoardStore((s) => s.draggingItemId === id);
  const [editing, setEditing] = useState(false);
  const onPointerDown = useItemDrag(id);
  const { deleteItem, edit } = useItemActions(id);
  if (!item) return null;

  return (
    <div
      className={`card ${selected ? 'is-selected' : ''} ${dragging ? 'is-dragging' : ''} ${editing ? 'is-editing' : ''}`}
      style={{ transform: `translate(${item.x}px, ${item.y}px)` }}
      data-item-id={id}
      onPointerDown={editing ? undefined : onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title={editing ? undefined : 'Drag into a bucket · double-click to edit'}
    >
      {editing ? (
        <InlineEditor
          multiline
          initial={item.text}
          ariaLabel="Edit item"
          onCommit={(t) => {
            edit(t);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <span className="card-text">{item.text}</span>
      )}
      {!editing && (
        <button className="card-delete" aria-label={`Delete ${item.text}`} title="Delete item" onClick={deleteItem}>
          ×
        </button>
      )}
    </div>
  );
});

/** An item inside a bucket. */
export const BucketChip = memo(function BucketChip({ id }: { id: string }) {
  const text = useBoardStore((s) => s.board?.items[id]?.text);
  const selected = useBoardStore((s) => s.selectedItemId === id);
  const dragging = useBoardStore((s) => s.draggingItemId === id);
  const [editing, setEditing] = useState(false);
  const onPointerDown = useItemDrag(id);
  const { deleteItem, edit } = useItemActions(id);
  if (text === undefined) return null;

  return (
    <div
      className={`chip ${selected ? 'is-selected' : ''} ${dragging ? 'is-dragging' : ''} ${editing ? 'is-editing' : ''}`}
      data-chip-id={id}
      data-item-id={id}
      onPointerDown={editing ? undefined : onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title={editing ? undefined : 'Drag to another bucket or out to the board · double-click to edit'}
    >
      {editing ? (
        <InlineEditor
          multiline
          initial={text}
          ariaLabel="Edit item"
          onCommit={(t) => {
            edit(t);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <span className="chip-text">{text}</span>
      )}
      {!editing && (
        <span className="chip-actions">
          <button
            aria-label={`Return ${text} to the board`}
            title="Return to board"
            onClick={() => useBoardStore.getState().returnToBoard(id)}
          >
            ↩
          </button>
          <button aria-label={`Delete ${text}`} title="Delete item" onClick={deleteItem}>
            ×
          </button>
        </span>
      )}
    </div>
  );
});
