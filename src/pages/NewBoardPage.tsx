import { useState } from 'react';
import ItemsWizard from '../components/ItemsWizard';
import { navigate } from '../router';
import { DEFAULT_DELIMITER } from '../lib/parse';
import { newId } from '../lib/id';
import { saveBoard, SCHEMA_VERSION, StorageError } from '../lib/storage';
import { createContent } from '../store/operations';
import type { Board } from '../store/types';

export default function NewBoardPage() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = (texts: string[], delimiter: string) => {
    const now = Date.now();
    const board: Board = {
      version: SCHEMA_VERSION,
      id: newId('board_'),
      name: name.replace(/\s+/g, ' ').trim() || 'Untitled board',
      delimiter,
      createdAt: now,
      updatedAt: now,
      ...createContent(texts),
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    try {
      saveBoard(board);
      navigate(`/board/${board.id}`, true);
    } catch (err) {
      setError(err instanceof StorageError ? err.message : 'Could not create the board.');
    }
  };

  return (
    <div className="page page-narrow">
      <header className="page-header">
        <a href="#/" className="brand">
          <img src="./favicon.svg" alt="" width={24} height={24} /> Clusterly
        </a>
      </header>
      <main>
        <h1>New board</h1>
        {error && <p className="field-error">{error}</p>}
        <ItemsWizard
          initialDelimiter={DEFAULT_DELIMITER}
          allowEmpty
          header={
            <label className="field">
              <span className="field-label">Board name</span>
              <input
                className="input input-large"
                placeholder="Untitled board"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          }
          confirmLabel={(n) => `Create board with ${n} item${n === 1 ? '' : 's'} →`}
          onConfirm={create}
          onCancel={() => navigate('/')}
        />
      </main>
    </div>
  );
}
