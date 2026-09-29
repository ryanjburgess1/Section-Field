# Main Program Integration

All 48 tiles load connected-tones Potrace proposals. The full-screen workspace embeds the shared correction editor, not a second implementation of its tools. Rebuild the static editor and proposal library with `npm run build:correction-editor` after source changes. The normal app build consumes those checked-in assets.

`Tile.correction` is the canonical edited geometry and unfinished pen draft. Tile previews and section renderers use that geometry, falling back to the new proposal. Aspect ratio is preserved in the 100-unit section coordinate space. Empty edited geometry stays empty rather than restoring a proposal automatically.

Legacy hand-drawn vectors and approvals are replaced on project load; original tile criteria, section records, and notes remain. New edits invalidate approval. Confirming a vector saves its current geometry. Reset restores the tile's proposal and is undoable.

Project saves separate corrections into `project_tile_corrections` to avoid the old single-record limit. Project metadata and per-tile corrections are written in one database batch. The migration is idempotent, and the API initializes the table for deployments that have not run it yet. IndexedDB retains pending local project drafts. Pending drafts take precedence over the cloud record on reopen; this is not a multi-user conflict-resolution system. Cloud writes are queued to avoid out-of-order completion.

Undo/redo history is retained locally per tile (eight persisted actions per direction, forty while open), independently of cloud geometry. It is restored only when it matches the current geometry and draft. History does not sync between computers.

Verification: typecheck, production build, focused lint of new modules, geometry regression tests, tile 02 editing/database persistence/reopen, tile 48 landscape framing, and section rendering. The existing section assembly algorithm is unchanged; this release integrates corrected geometry, not the later purposeful-assembly milestone.
