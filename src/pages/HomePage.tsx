import { useRef, useState } from 'react';
import { navigate } from '../router';
import { boardFromJSON, deleteBoard, listBoards, renameStoredBoard, saveBoard, StorageError } from '../lib/storage';
import { confirmAction } from '../components/ConfirmDialog';
import type { BoardSummary } from '../store/types';

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function HomePage() {
  const [boards, setBoards] = useState<BoardSummary[]>(() => listBoards());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const refresh = () => setBoards(listBoards());

  const remove = async (b: BoardSummary) => {
    const { ok } = await confirmAction({
      title: `Delete “${b.name}”?`,
      message: `This permanently deletes the board with its ${b.itemCount} items and ${b.bucketCount} buckets. This can't be undone.`,
      confirmLabel: 'Delete board',
      danger: true,
    });
    if (!ok) return;
    deleteBoard(b.id);
    refresh();
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const board = boardFromJSON(await file.text());
      saveBoard(board);
      navigate(`/board/${board.id}`);
    } catch (err) {
      setError(err instanceof StorageError ? err.message : 'Could not import that file.');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <a href="#/" className="brand">
          <img src="./favicon.svg" alt="" width={24} height={24} /> Clusterly
        </a>
        <span className="spacer" />
        <button className="btn" onClick={() => importRef.current?.click()}>
          Import backup
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <a className="btn btn-primary" href="#/new">
          + New board
        </a>
      </header>

      <main>
        {error && <p className="field-error">{error}</p>}
        {boards.length === 0 ? (
          <section className="hero">
            <h1>Sort anything into groups</h1>
            <p className="lead">
              Paste a list, scatter it on a board, and drag items into named buckets to build your typology.
            </p>
            <ol className="flow">
              <li>
                <span>1</span>Add text
              </li>
              <li>
                <span>2</span>Review items
              </li>
              <li>
                <span>3</span>Randomize
              </li>
              <li>
                <span>4</span>Create buckets
              </li>
              <li>
                <span>5</span>Drag items
              </li>
              <li>
                <span>6</span>Export
              </li>
            </ol>
            <a className="btn btn-primary btn-large" href="#/new">
              Create your first board
            </a>
          </section>
        ) : (
          <>
            <h1>Your boards</h1>
            <p className="muted">Boards are saved automatically in this browser.</p>
            <ul className="board-list">
              {boards.map((b) => (
                <li key={b.id} className="board-card">
                  {renaming === b.id ? (
                    <form
                      className="board-rename"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const value = new FormData(e.currentTarget).get('name');
                        if (typeof value === 'string' && value.trim()) renameStoredBoard(b.id, value);
                        setRenaming(null);
                        refresh();
                      }}
                    >
                      <input
                        name="name"
                        className="input"
                        defaultValue={b.name}
                        maxLength={120}
                        autoFocus
                        aria-label="Board name"
                        onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)}
                      />
                      <button className="btn btn-small btn-primary">Save</button>
                    </form>
                  ) : (
                    <a className="board-link" href={`#/board/${b.id}`}>
                      <strong className="board-name">{b.name}</strong>
                      <span className="muted small">
                        {b.itemCount} items · {b.bucketCount} buckets · {b.groupedCount}/{b.itemCount} grouped · edited{' '}
                        {timeAgo(b.updatedAt)}
                      </span>
                      {b.itemCount > 0 && (
                        <span className="progress" aria-hidden>
                          <span style={{ width: `${(100 * b.groupedCount) / b.itemCount}%` }} />
                        </span>
                      )}
                    </a>
                  )}
                  <div className="board-actions">
                    <button className="btn btn-small" onClick={() => setRenaming(b.id)}>
                      Rename
                    </button>
                    <button className="btn btn-small btn-danger-ghost" onClick={() => remove(b)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
