import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useBoardStore } from '../../store/boardStore';
import { MAX_NOTE_LENGTH, MIN_NOTE_H, MIN_NOTE_W } from '../../store/operations';
import InlineEditor from './InlineEditor';
import { startPointerDrag } from './pointerDrag';
import { spacePan } from './viewport';

type Live = { x: number; y: number; w: number; h: number };

/** A yellow sticky-note comment: drag to move, double-click to edit, corner to resize. */
export const NoteView = memo(function NoteView({ id }: { id: string }) {
  const note = useBoardStore((s) => s.board?.notes[id]);
  const editing = useBoardStore((s) => s.editingNoteId === id);
  const [live, setLiveState] = useState<Live | null>(null);
  const liveRef = useRef<Live | null>(null);
  const setLive = (l: Live | null) => {
    liveRef.current = l;
    setLiveState(l);
  };

  if (!note) return null;
  const r = live ?? note;
  const setEditing = (on: boolean) => useBoardStore.getState().setEditingNote(on ? id : null);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 || spacePan.active || editing) return;
    if ((e.target as Element).closest('button, textarea, .note-resize')) return;
    e.stopPropagation();
    useBoardStore.getState().select(null);
    const origin = { x: note.x, y: note.y };
    startPointerDrag(
      e,
      (dx, dy) => setLive({ x: origin.x + dx, y: origin.y + dy, w: note.w, h: note.h }),
      () => {
        const l = liveRef.current;
        if (l) useBoardStore.getState().moveNote(id, l.x, l.y);
        setLive(null);
      },
    );
  };

  const onResizeDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const origin = { w: note.w, h: note.h };
    startPointerDrag(
      e,
      (dx, dy) =>
        setLive({ x: note.x, y: note.y, w: Math.max(MIN_NOTE_W, origin.w + dx), h: Math.max(MIN_NOTE_H, origin.h + dy) }),
      () => {
        const l = liveRef.current;
        if (l) useBoardStore.getState().resizeNote(id, l.w, l.h);
        setLive(null);
      },
    );
  };

  const onDelete = () => {
    const s = useBoardStore.getState();
    s.deleteNote(id);
    s.showToast('Deleted comment', { undo: true });
  };

  return (
    <div
      className={`note ${editing ? 'is-editing' : ''} ${live ? 'is-moving' : ''}`}
      style={{ transform: `translate(${r.x}px, ${r.y}px)`, width: r.w, height: r.h }}
      data-note-id={id}
      role="note"
      aria-label={note.text ? `Comment: ${note.text}` : 'Empty comment'}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title={editing ? undefined : 'Drag to move · double-click to edit'}
    >
      <div className="note-strip" aria-hidden />
      <div className="note-body">
        {editing ? (
          <InlineEditor
            multiline
            submitOnEnter={false}
            commitOnEscape
            maxLength={MAX_NOTE_LENGTH}
            initial={note.text}
            placeholder="Write a comment…"
            ariaLabel="Comment text"
            className="note-editor"
            onCommit={(text) => {
              useBoardStore.getState().editNote(id, text);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <p className={`note-text ${note.text ? '' : 'is-empty'}`}>{note.text || 'Double-click to write a comment…'}</p>
        )}
      </div>
      {!editing && (
        <button className="note-delete" aria-label="Delete comment" title="Delete comment" onClick={onDelete}>
          ×
        </button>
      )}
      <div className="note-resize" onPointerDown={onResizeDown} title="Drag to resize" aria-hidden />
    </div>
  );
});
