# Tile 29 Correction Editor

Isolated checkpoint prototype, not part of the deployed site. Loads the connected-tones proposal and raster from `../vector-experiment/`. Approved drawings are never written.

## Run

From the repository root, run `node node_modules/vite/bin/vite.js research --host 127.0.0.1 --port 5199` and open http://127.0.0.1:5199/correction-editor/ . Use another port if occupied. Node is also available in the bundled Codex runtime.

## Tools

- Select: choose an object; drag its small cross-shaped anchors or existing curve handles. Double-click a nearby edge to insert an anchor. Delete removes the active anchor (minimum three remain) or selected objects.
- Marquee: fully enclose objects to select them. Holes stay associated with their parent mass. Shift-click with Select toggles objects; Shift-drag pans.
- Add Mass / Subtract Void: click a polygon, then close it by clicking the first anchor, pressing Enter, or using the checkmark. Escape cancels. Open polygons autosave with their operation type.
- Eraser: an adjustable round brush subtracts true vector geometry. One continuous stroke is one undo action.
- Undo/redo: toolbar or Command/Ctrl+Z and Command/Ctrl+Shift+Z. Forty actions in memory, up to eight persisted in each direction on reload. If storage is tight, the current draft is saved without history; a save failure is shown explicitly.
- Zoom buttons anchor at the image center. Wheel and trackpad pinch-wheel events anchor at the cursor. Pan via Hand or Shift-drag; Fit restores framing.
- Raster is locked. Raster/vector/anchors visibility and vector opacity are independent. Export emits white filled SVG paths with transparent holes. Opacity is a viewing control, not an export setting.

## Storage and Scope

Drafts use this browser's local storage under `tile29-correction-prototype-v1`. They are not cloud-synced, not stored on the private website, and not available in another browser. Reset restores the proposal and is undoable. Exports contain finished mass geometry, not the unfinished pen path. Keep the same local origin/port to reopen a draft.

No automatic simplification, lasso, freehand mass painting, approval workflow, or live-site integration is included. Native trackpad hardware behavior still needs user review; browser wheel handling is implemented. Very detailed Boolean operations may take noticeable time. This is the usability checkpoint, not a claim of production readiness.

## Verification

Run `node research/correction-editor/geometry.test.mjs` from the repository root. Tests cover nested holes/islands, subtraction, union, JSON round trips, and 16,128 sample positions comparing the source tile with separated selectable objects (a 0.001 image-unit contour tolerance handles path serialization).

Browser checks performed: polygon addition, erasing/splitting, Command+Z and Command+Shift+Z, marquee deletion, interior subtraction, anchor movement, reload persistence, and unfinished subtraction-path recovery. Responsive viewport checks and final review are recorded in the task conversation.

Paper.js 0.12.18 is vendored from the official npm registry under `package/`, with its original license. Boolean operations use Paper.js; the prototype does not implement its own polygon-clipping engine. Lucide icons, React rendering utilities, and Vite use the existing repository dependencies.
