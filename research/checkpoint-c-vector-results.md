# Checkpoint C: Vector Tracing Trials

Status: experiments complete; user review and workflow selection pending.
Checkpoint B approved by user. No application code, saved drawings, or deployment changed.

## Evidence

Open `vector-experiment/index.html` for raster, approved screenshot, and actual SVG comparisons. Individual SVGs, selected-pixel masks, rendered PNGs, source hashes, parameters, timings, and render checks are retained alongside it.

24 proposals were generated: four methods on reference tiles 02, 04, 29 and unapproved probes 12, 16, 25. Original transparent PNG sources were reduced to a maximum dimension of 720 pixels. These are not full-resolution experiments. Approved screenshots are visual targets, not aligned ground-truth masks; no reference-accuracy percentage is claimed.

## Methods

All candidates use the pure Python `potracer` 0.0.4 port, not the native Potrace executable. White compound paths use even-odd fill so holes remain transparent.

- Raw Otsu: one automatically selected brightness threshold.
- Soft Otsu: slight Gaussian smoothing before thresholding.
- Connected tones: grow bright seed regions into connected, moderately darker pixels.
- Local light: bounded local illumination compensation before thresholding.

No per-tile hand tuning was applied. Potrace parameters: turdsize=0, alphamax=0.7, opttolerance=0.15. No explicit small-component deletion was used. Thresholding, resampling, and smoothing can nevertheless lose small features; disabling speck deletion is not a preservation guarantee.

## Visual Findings

| Tile | Useful result | Remaining failure |
| --- | --- | --- |
| 02 | Broad upper/lower masses and central void are recognizable; connected tones strengthens the right-side connection. | Left projections and detached fragment remain noisy or incomplete; unwanted texture appears around recess boundaries. |
| 04 | Main continuous mass and right-opening recess survive. Connected tones produces a cleaner lower face. | Side notches and small openings differ from the approved interpretation; other methods retain false surface marks and lower-face gaps. |
| 29 | Upper-right and lower-right masses and much of the connecting network are recovered. | Thin branches are fragmented or too thin; unwanted lower photographic material becomes mass. Connected tones recovers more connectors but also expands unwanted regions. |
| 12, unapproved | Connected tones makes more of the intricate network continuous. | Excess texture remains; no approved reference establishes which extra geometry is meaningful. |
| 16, unapproved | Main bright faces are recovered. | Darker connectors remain incomplete; illumination compensation adds considerable texture. |
| 25, unapproved | Central bright region is recognizable. | Textured upper material becomes extensive noisy geometry; brightness alone is particularly unreliable here. |

Soft Otsu reduces noise compared with raw thresholding, but does not resolve interpretation. Connected tones is worth offering as a proposal because it recovers some darker connections; it is not a universal winner. Local compensation did not consistently improve these examples.

## Verification and Limits

All 24 SVGs were rendered with Sharp/librsvg. The six contact sheets were visually inspected. `render-checks.json` compares each input mask to its rendered SVG; this checks export fidelity, NOT architectural accuracy. Pixel component/hole counts are diagnostic and must not be used as tile porosity scores.

Recorded tracing/export times were approximately 0.17-2.48 seconds per candidate on this machine, excluding preprocessing and human correction. Neither correction time nor Illustrator performance has been measured. Higher resolution, interactive region guidance, and alternative segmentation models remain untested. No claim of production readiness or guaranteed detail preservation is warranted.

## Recommendation and Stop Gate

Do not replace approved drawings or roll automatic tracing into production yet. Potrace is a useful contour generator, but the preceding mass-selection step remains the main bottleneck.

Proposed next controlled comparison, subject to approval:

1. Use connected tones and soft Otsu as optional proposals on tiles 02, 04, and 29.
2. Compare correction of a proposal with the user's familiar Illustrator workflow on the same tiles. Record actual editing time and check branches, intended gaps/islands, broad faces, and unwanted texture.
3. Choose the workflow by time to an acceptable interpretation, not path count or visual smoothness alone. Keep Illustrator SVG import as the fallback; do not require tracing all tiles twice.
4. Only proceed to production integration after the user accepts the quality and editing effort. Existing approved vectors remain untouched.

For an in-app workflow, region-by-region acceptance plus existing anchor editing is a more bounded next experiment than another global sensitivity slider. This is a proposal, not an implemented feature or a proven faster method.

## Reproduction and Sources

Scripts: `run_vector_experiment.py`, `render_vector_experiment.cjs`, `inspect_vector_experiment.py`. Python dependencies for this run were installed separately under `/private/tmp/section-vector-deps`: potracer 0.0.4, scipy 1.18.1, numpy 2.5.3. Pillow came from the bundled runtime. The renderer uses the bundled Sharp runtime path. Temporary dependencies must be restored if removed; this is not yet a portable application build.

- Potrace manual: https://potrace.sourceforge.net/potrace.1.html
- Python port and package/license metadata: https://pypi.org/project/potracer/

Review dependency licensing before any production integration or distribution.
