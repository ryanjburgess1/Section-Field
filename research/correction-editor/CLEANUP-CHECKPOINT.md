# Cleanup checkpoint

Local review prototype. Open a tile, then Cleanup study. Preview computes
fragment removal first and enclosed-hole filling second. Area thresholds are
percentages of the image canvas, not viewport pixels. Zero disables a pass.

Select objects before opening the study to protect them. Their full geometry,
including holes, remains untouched. Toggle Show original for comparison. Toggle
Cleanup study to hide the controls without hiding the preview. Close returns to
the detailed vector. Apply & Save replaces the editable geometry with the preview
and autosaves through the existing project workflow. The operation is one undo
step, including after reopening the editor. Ordinary SVG export remains available.

No contour fitting, smoothing, or anchor reduction occurs. Thin branches attached
to retained objects survive. Holes containing nested islands are conservatively
left intact. An unapplied preview is not persisted on close. Applying cleanup
marks the tile corrected and awaiting review, just like other geometry edits.
The existing generation workflow then consumes the saved corrected geometry.

Checkpoint tests: tiles 01 and 29, source immutability, protected objects, nested
islands, and a narrow connector. Run `node research/correction-editor/cleanup.test.mjs`.

Next approval gate: visually assess removal thresholds and retained intricacy.
Region-specific protection and separate permanent detailed/section-ready versions
remain future work; current recovery uses the editor's bounded undo history.
