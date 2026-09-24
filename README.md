# typology-app

This is the open source repository for **Clusterly**, our internal app for quantitative exploration and typology creation.

Clusterly turns a list of items into cards on a free-form board, where you sort them into named buckets
(an open card sort). It runs entirely in the browser; boards are saved automatically in `localStorage`.

## Workflow

**Add text → Review items → Randomize → Create buckets → Drag items → Name buckets → Export**

1. **Create a board**: give it a name, then paste text, upload a plain-text file, or start empty.
2. **Parse**: the text is split on the delimiter (default `/`; presets `,` `;` `|` or new line, or a custom
   string of up to 5 characters). Each item is trimmed and empty items are ignored, so
   `doctor/nurse/pharmacist/customer service/product quality` becomes five items.
3. **Review**: edit, remove or add items; duplicates are flagged. Then confirm to create the board.
4. **Board**: items are scattered randomly without overlapping. The board supports:
   - Dragging cards anywhere.
   - Panning (drag empty space, scroll, or Space + drag) and zooming (Ctrl/⌘ + scroll, pinch, or the zoom buttons).
   - **Shuffle**, which re-randomizes the ungrouped items.
5. **Buckets**: create one with **+ Bucket**, the `B` key, or a double-click on empty space. Buckets can be named,
   renamed (double-click the title), moved (drag the header), resized (the corner handle) and deleted. Deleting
   asks for confirmation and returns the bucket's items to the board.
6. **Grouping**: drag items into buckets. The target bucket lights up and an insertion marker shows where the
   item will go. Items can be dragged between buckets or back onto the board, or sent back with the ↩ button.
7. **Editing**: double-click an item to edit it, and delete it with × or the Delete key. Every change can be
   undone and redone (Ctrl/⌘+Z, Ctrl/⌘+Shift+Z). **Reset…** returns every item to the board, optionally
   deleting the buckets.
8. **Save & resume**: every change is saved automatically, and **Saved** in the toolbar saves immediately.
   The home page lists your boards. **Export → Board backup** writes a JSON file you can import in another browser.
9. **Export**: download a PNG image of the board, or the bucket structure as text or CSV:

   ```text
   Healthcare
   doctor
   nurse
   pharmacist

   Fruit
   apple
   orange
   banana
   ```

## Development

Requires Node 20+.

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check and build to dist/ (static files; deploy anywhere)
npm test           # unit tests (Vitest)
npm run test:e2e   # end-to-end tests (Playwright; builds and serves the app)
npm run lint
```

### Project layout

| Path | Purpose |
| --- | --- |
| `src/lib/parse.ts` | Delimiter parsing and validation |
| `src/lib/layout.ts` | Random, non-overlapping card placement |
| `src/lib/storage.ts` | `localStorage` persistence, validation and repair of saved/imported boards |
| `src/lib/export.ts`, `exportImage.ts` | Text/CSV export and PNG rendering |
| `src/store/operations.ts` | Pure board operations (group, move, delete bucket, …) |
| `src/store/boardStore.ts` | Zustand store with undo/redo history |
| `src/store/persist.ts` | Debounced autosave, flushed when the page is hidden or closed |
| `src/components/board/` | Canvas, pan/zoom, drag and drop, buckets, toolbar |
| `src/pages/` | Home, new-board wizard and board pages |

### Performance notes

- Dragging only moves a floating "ghost" element; the store is updated once on drop.
- Components subscribe to just the item or bucket they render.
- Placement uses a spatial index, so thousands of cards lay out quickly.
- Boards of 2,000+ items stay usable.
