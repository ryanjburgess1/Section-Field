# Checkpoint B: Vector Target Benchmark

1. **Status: reference review complete; Checkpoint B awaits user approval.** Stage 2 only. All three tiles now have user-supplied SVG-only and overlay screenshots. These establish the visual benchmark without requiring access to saved paths. Exact path geometry remains unverified. No saved drawings, application code, or hosted records were changed. No tracing experiments have started.

2. **Authority.** The user's interpretation is the target, not automatic tracing and not necessarily the latest saved path. The approved examples establish mass/void meaning but may benefit from additional contour detail. Detail additions require review; they must not silently change the topology. Screenshots are visual reference evidence, not pixel-perfect masks or sources of exact vector coordinates.

3. **Input provenance.** Tile identifiers were checked against the application's initialization: tile 02 is IMG_5205, tile 04 is IMG_5207, and tile 29 is IMG_5232. The included PNGs are copies of the application raster assets, not independently verified original camera files. They already have background processing, which could have affected edge detail. Before Stage 3, verify whether higher-resolution unprocessed images are available and useful; do not substitute inputs silently.

| Tile | Application raster | Approved reference available | Benchmark readiness |
|---|---|---|---|
| 02 | IMG_5205.png | User SVG-only and overlay screenshots | Visual comparison complete; feature acceptance pending |
| 04 | IMG_5207.png | User SVG-only and overlay screenshots | Visual comparison complete; feature acceptance pending |
| 29 | IMG_5232.png | User SVG-only, overlay, and raster screenshots | Visual comparison available; feature acceptance pending |

## Tile 29: Approved Interpretation

4. **Visual references.** The following screenshots were supplied by the user and copied unchanged. The raster is larger than the screenshots, so compare at matching tile orientation and extent, not by assuming identical pixel coordinates. Exclude card borders, labels, and status dots from any future comparison. No screenshot-derived numerical accuracy is claimed.

![Tile 29 application raster](vector-benchmark/IMG_5232.png)

![Tile 29 user-approved overlay](vector-benchmark/tile-29-approved-overlay.png)

![Tile 29 user-approved SVG-only screenshot](vector-benchmark/tile-29-approved-svg.png)

5. **T29-A: upper-right mass.** The approved white region occupies the upper-right portion and has an irregular concave boundary against the upper dark recess. Preserve this broad mass and its recess rather than tracing only the brightest pixels or filling the whole photographed silhouette. Additional contour detail may refine the boundary without inventing small holes from texture.

6. **T29-B: upper thin branch.** A slender curved white connection rises toward the upper-left and joins the upper network. Preserve its continuity and curved character. Do not erase it as noise or replace it with a disconnected centerline. Its precise width is not measurable reliably from this small screenshot.

7. **T29-C: left-projecting branch network.** The approved vector includes a narrow irregular projection toward the left with branching connections toward the right-hand mass. Preserve junctions and the intervening black gaps. A trace that produces only the two broad right-hand regions fails this feature, even if its overall area overlap is high.

8. **T29-D: central void.** A prominent dark opening lies between the upper network and the lower diagonal connection. Preserve its extent and the branching masses that frame it. Do not fill it because of bright reflected texture in the photograph, and do not claim an exact count of enclosed holes from the thumbnail alone.

9. **T29-E: descending connection and lower notch.** A slender mass descends diagonally from the left-side network toward the lower-right mass, alongside a narrow downward void/notch. Preserve both the positive connection and the negative opening. Smoothing that merges the opening into solid or breaks the branch is a topology error, not merely a cosmetic difference.

10. **T29-F: lower-right mass and right-side recess.** Retain the substantial lower white region and its irregular right-side cut-in. Its broad, somewhat simplified contour may gain reviewed detail. Do not fill the right-side recess or extend the white region across the entire lower photographed object.

11. **T29-G: photographed material excluded from the interpretation.** Much of the dark outer and bottom photographic extent is absent from the approved filled vector. This is intentional sectional interpretation, not automatically missing mass. A whole-object segmentation would therefore be an unsuitable target even if it accurately isolated the photographed object from its background.

12. **Tile 29 review decision.** Confirm that T29-A through T29-G describe the intended reading. Identify any branch that is only a visual suggestion rather than material mass. Additional detail should follow meaningful boundary changes while leaving photographic grain and highlights out unless specifically marked as geometry.

## Tile 02: Approved Interpretation

![Tile 02 application raster](vector-benchmark/IMG_5205.png)

![Tile 02 approved SVG](vector-benchmark/tile-02-approved-svg.png)

![Tile 02 approved overlay](vector-benchmark/tile-02-approved-overlay.png)

13. **T02-A: major masses and central void.** The approved vector includes broad upper and lower filled regions separated by a large central black opening extending toward the left. Preserve their substantial area and the cavity between them. The lower mass has a left-side concave cut-in beneath a short inward-projecting ledge. Preserve that ledge and cut-in rather than reducing the lower mass to a rectangle. Photographic surfaces visible inside the central recess do not become mass merely because they have texture.

14. **T02-B: slender connection and isolated fragment.** A thin irregular white strip along the right side visibly links the upper and lower regions. This is a critical connection: deleting it or thickening it enough to close the central void is a failure. On the left, preserve the upper tapered projection and the small apparently detached white fragment below it. Do not remove that fragment as noise or connect it automatically. Exact junction widths remain subject to higher-resolution review if needed.

15. **T02-C: useful benchmark distinction.** This tile tests broad-mass retention, an open central recess, a narrow positive connection, and a small isolated mass in one example. Grain and striations in the broad faces are absent from the approved void interpretation. Additional detail should refine meaningful edges without perforating those faces with photographic noise.

## Tile 04: Approved Interpretation

![Tile 04 application raster](vector-benchmark/IMG_5207.png)

![Tile 04 approved SVG](vector-benchmark/tile-04-approved-svg.png)

![Tile 04 approved overlay](vector-benchmark/tile-04-approved-overlay.png)

16. **T04-A: continuous mass around an open recess.** The approved vector retains a broad upper mass and a lower strip joined by mass along the left. A large dark recess enters from the right, curves inward at its left end, and leaves an irregular lower boundary. Preserve its opening to the exterior; it is not an enclosed hole. Do not sever the left-side mass connection or fill the recess into a solid block.

17. **T04-B: local holes and eroded boundaries.** The approved vector shows a small dark opening near the upper-left shoulder and another small dark opening near the mid-right edge above the large recess. Both appear enclosed at screenshot scale and should not be discarded by size-based cleanup. Preserve the irregular side contours and their notches separately from these openings. If enclosure is ambiguous in a later pixel comparison, request a closer view instead of silently joining an opening to the exterior.

18. **T04-C: surface line versus opening.** The raster's horizontal surface line does not split the broad mass in the approved vector. The benchmark must therefore reject a trace that turns that line into a crack. This tile tests continuity across shading and surface marks while still preserving genuine small openings and the larger edge-connected recess.

## Proposed Acceptance Rules

19. **Topology before cosmetics.** A proposed vector fails if it removes a confirmed mass connection, seals a confirmed opening, merges distinct required regions, introduces false holes, or reverses the approved mass/void interpretation. Correct topology alone is not enough: meaningful contour detail must also survive. Incidental gaps and islands are not automatically removed.

20. **Contour fidelity.** Compare identifiable edges, concavities, branch junctions, and cavity mouths at matched framing. Mark deviations locally as missing mass, excess mass, lost opening, broken connection, or contour simplification. A global '90% accurate' result cannot excuse an important local failure. No 10-20% blanket error allowance is adopted.

21. **Detail classes for user review.** REQUIRED: approved main mass/void reading, important branches, openings, and spatial boundaries. REVIEWABLE: extra recesses, small edge changes, and finer curvature consistent with the approved reading. EXCLUDED unless selected: surface grain, illumination gradients, labels, and background material not present in the sectional interpretation. Membership must be decided per feature, not solely by pixel size.

22. **Display invariants.** Filled white shapes mean mass. Transparent areas mean void. Preserve aspect ratio and tile orientation. Any material connection represented as a stroke needs a width before assembly analysis. Unfinished paths are not silently counted as filled mass. All display layers must align in one coordinate system.

23. **Benchmark record for future trials.** Record input identity and resolution, preparation method, tracing parameters, tracing runtime, user correction time, required-feature failures, optional-detail changes, approval decision, and reviewer comments. Compare against an Illustrator baseline measured during an actual session, not guessed. Keep raw proposal and corrected result distinct.

24. **No fabricated scores.** Current status is qualitative visual review. No segmentation, contour-distance measurement, threshold tuning, Potrace run, or timing trial has been performed. Exact area comparison would require an agreed aligned mask or vector reference and would remain secondary to feature-level review.

## Checkpoint B Gate

25. **Evidence complete for qualitative review.** All requested screenshots are present. Tile 02 tests a thin positive connection and an isolated fragment; tile 04 tests small negative openings and a broad continuous mass around an edge-connected recess; tile 29 tests an intricate branching network. Confirm these feature descriptions and the required/reviewable/excluded detail distinction. Screenshots suffice for this visual benchmark, but uncertain subpixel junctions cannot support exact topology measurements. Request closer views only where an actual test requires them.

26. **Decision after evidence is complete.** Review annotated feature lists for all three tiles with the user. Only explicit Checkpoint B approval authorizes Stage 3's tracing experiment. Until then, preserve the application and all approved vectors unchanged. Illustrator remains the comparison workflow and fallback, not a selected implementation yet.
