# Two-tile connection checkpoint

## Three-tile checkpoint (verified in recovered local workspace)

The study now defaults to three tiles; the two-tile baseline remains selectable.
Three-tile runs search extensions of passing pairs and re-evaluate all three
source supported-void masks against the combined mass. No clearance erosion is
used in this mode: narrow passages remain eligible, with one-cell connections
flagged for review. At least 35% of each tile's supported void must occur in the
same component. An addition must preserve half the pair's connected void and add
at least 20 sampled cells, with no more than 65% overlap of the added mass.

Ranking combines component continuity (55%) and relative width variation (45%).
These are provisional proxies for clarity and hierarchy, not architectural
judgments. A mass-distance field divides the selected component into primary
potential, secondary potential and transition bands. These are not segmented
rooms, circulation routes, or program labels. Width bands can need user correction;
editing labels and persistent study records are not part of this checkpoint.

Original SVG paths remain untouched. The seed and full transformation recipe
are shown. Results still live only while the study is open. Automated tests cover
connected and disconnected triples, narrow passages and overlay partitioning.
Full typecheck passes in the recovered non-iCloud workspace. Browser verification
produced 15 candidates with seed connection-01 and the current six pilot vectors.

Open Connection Study in the local app. Uses only confirmed tiles 01-04, 25,
29 and their current corrected geometry. No physical assessment values or
architectural labels influence this test. Existing generator is unchanged.

Each seed evaluates 16 poses per unique pair. Search varies rotation, mirroring,
position and scale within bounds; no cropping. White SVG shapes are overlaid
as a union, without modifying original curves. The visible recipe uses a
100x100 study coordinate system (scale 100% means a tile's longest side is 100).

Evaluation samples vector paths on a 128x128 grid. Supported void is empty
space bracketed by mass in a row OR column of an individual tile. A four-neighbor
flood fill operates only inside the union of these supported void masks after
both mass masks are applied. Every route cell needs one-cell cardinal clearance.
Require a 2x2 shared patch, at least 8 shared cells, and 35% coverage of each
tile's original supported void in one connected component. Reject mass overlap
above 65% of the smaller tile. Retain best coverage per pair.

These are provisional geometric heuristics, not a proof of architectural
interiority or accessibility. Axis-aligned support is rotation-sensitive;
sampling can miss subpixel features. Cyan shows the tested connected component,
not program classifications or exclusively the overlapping portion. Results
are temporary studies, not section archive records. Reusing seed and unchanged
tile geometry reproduces the search. Saved tiles and approvals are untouched.

Approval gate: visually inspect void connections, pinched passages and whether
the pair adds useful spatial structure. Next steps: orientation-independent
support, refined geometric validation, persisted editable recipes, then small
multi-tile sections. Architectural ranking follows reviewed descriptors.

Tests: `node scripts/test-connection-study.mjs` on Node 22+ with type stripping.
