# Checkpoint A: Architectural Foundation

1. **Status and scope.** Research proposal for Ryan Burgess and Dillon Mitko's Design 7 project, prepared September 21, 2026. Awaiting user review. No application behavior, drawings, or hosted records have been changed. This document is a design brief for future implementation, not a claim that the current generator already implements these rules.

2. **Project intent.** Automatically compose detailed, approved tile vectors into coherent, varied 2D sectional studies. Preserve the spatial character of the erosion experiments. The generator chooses interactions; the user interprets results afterward. FAU slides 18-29 establish the near-term exploratory scope. Slides 81-84 remain a long-term ambition, not an immediate deliverable.

3. **Evidence labels.** SOURCE means a statement documented by the presentation, architect, or researcher. INTERPRETATION means a reading proposed for this project. PROPOSED RULE means a possible implementation approach requiring testing and approval. A precedent is evidence of a design approach, not proof that copying its geometry produces the same experience.

## Project References

4. **Design 7, slides 35-36: vocabulary.** SOURCE: the matrix distinguishes formal, organizational, and experiential descriptors. INTERPRETATION: the generator needs different types of knowledge, not one undifferentiated quality score. Preserve the distinction between geometric evidence and experiential readings. The matrix's material, volumetric, and daylight measures cannot all transfer literally into a 2D section.

![Descriptor matrix from Design 7, slide 35](reference-images/035.jpg)

5. **Design 7, slides 39-42: material origin.** SOURCE: the experiments and tile inventory show irregular cavities, narrow material connections, and varied mass/void relationships. PROPOSED RULE: retain topology and significant contour detail before pursuing smoothness. A tiny bridge or opening may matter more than a large area of photographic texture. Tile criteria describe components, not their final program identity.

6. **Design 7, slides 43-44: lobby study group.** Working interpretation follows the user's grouping despite carryover wording. SOURCE: compressed sequential, ground-field, vertical void, continuous hall, and linear gallery are the example names. The critique flags overlap between ground-field and gathering. PROPOSED RULE: generate distinct organizational alternatives, allow overlapping readings, and avoid claiming that every open space is a lobby.

![Lobby study examples from Design 7, slide 43](reference-images/043.jpg)

7. **Design 7, slides 45-46: gathering study group.** SOURCE: void-field, room-in-volume, stepped amphitheater, inserted place, and linear edge. The critique relates pockets to distributed gathering, enclosure to intimacy, and staggered joints to steps. PROPOSED RULE: vary concentration and enclosure while connecting principal spaces. Treat an apparently enclosed pocket as a candidate needing a threshold, not automatically as an accessible room.

![Gathering study examples from Design 7, slide 45](reference-images/045.jpg)

8. **Design 7, slides 47-48: office study group.** SOURCE: terraced, void-edge, open hall, flat deep-plan, and folded. The critique warns against over-eroding the deep-plan arrangement and identifies terracing as an arrangement decision. PROPOSED RULE: protect broad work-space candidates and their bounding masses; neither high density nor maximal openness determines office suitability. In a section, horizontal ledges are only potential supporting surfaces, not proof of usable floor area.

![Office study examples from Design 7, slide 47](reference-images/047.jpg)

## External Reference Library

9. **R1: Gilder Center, Studio Gang.** SOURCE: the architect describes a geology-informed atrium that links adjacent museum buildings, replaces dead ends with loops, and connects surrounding activities through openings and bridges. INTERPRETATION: erosion can organize relationships rather than serve only as surface expression. PROPOSED RULE: compose a shared principal void with differentiated adjoining spaces, retaining narrow mass connections where they frame that network. LIMIT: visual connection, void continuity, and physical access are distinct. A museum is not direct evidence of office performance. [Architect's project and section imagery](https://studiogang.com/projects/gilder-center/).

10. **R2: Namba Parks, JERDE.** SOURCE: JERDE describes a canyon organizing circulation, a park over retail levels, and bridges crossing the open space. INTERPRETATION: a continuous void can remain legible across changes of level and enclosure. PROPOSED RULE: offset compatible tiles around a shared opening, allowing terraces and cross-connections without requiring freeform deformation. LIMIT: this commercial/public precedent supplies sectional relationships, not office dimensions or mandatory circulation geometry. [Architect's project, concept sketch, and photographs](https://www.jerde.com/projects/7917/namba-parks).

11. **R3: Valley, MVRDV.** SOURCE: the project combines programs and provides public access to an elevated valley between towers; its contrasting exterior and inner geological expression distinguish different spatial conditions. INTERPRETATION: retained building mass and a shared public void can coexist. PROPOSED RULE: preserve substantial mass while opening selected edges, with stepped transitions rather than indiscriminate subtraction. LIMIT: tower scale, planting, material finish, and facade complexity are not targets for this 2D stage. [Architect's project and gallery](https://mvrdv.com/projects/233/valley).

12. **R4: Villa VPRO, MVRDV.** SOURCE: the office uses a stepped and undulating floor landscape with varied spatial settings, seeking to retain informality at a larger scale. INTERPRETATION: office space can have sectional differentiation without reducing work to repetitive enclosed cells. PROPOSED RULE: test broad connected work-space candidates with offsets and adjacent open regions; preserve quieter pockets as alternatives to one completely exposed field. LIMIT: this does not establish that arbitrary slopes are usable work surfaces; preserve the distinction between formal study and resolved occupation. [Architect's project and gallery](https://www.mvrdv.com/projects/172/villa-vpro?photo=2335).

13. **R5: Space Syntax Laboratory and SocioBuildings, UCL.** SOURCE: the research examines configuration and social interaction; SocioBuildings combines visibility models with observed and reported interaction data. INTERPRETATION: geometric relationships are useful evidence, but geometry alone cannot prove social success. PROPOSED RULE: report visibility, connectedness, and spatial sequence separately from program interpretation. LIMIT: a sectional visibility diagram is not a complete building visibility graph; occupancy, plan organization, and behavior remain unknown. [Space Syntax Laboratory](https://www.ucl.ac.uk/bartlett/architecture/research/space-syntax-laboratory), [SocioBuildings](https://www.ucl.ac.uk/bartlett/sociobuildings).

14. **R6: UCL workplace research summary.** SOURCE: the university reports relationships between desk circumstances, visual control, and perceived workplace outcomes, with a suggestion to consider smaller, more intimate areas within larger open offices. INTERPRETATION: more openness is not an automatic quality improvement. PROPOSED RULE: preserve alternatives with differentiated exposure and enclosure, rather than maximize visible area. LIMIT: self-reported outcomes and specific workplace conditions cannot become universal sectional thresholds or productivity predictions. [UCL research summary](https://www.ucl.ac.uk/news/2021/apr/window-views-and-smaller-offices-improve-productivity).

## Descriptor Dictionary

15. **Original tile descriptors remain authoritative.** Branching: connective material between masses. Porosity: opening multiplicity, honoring the user's preference for several small openings over one large opening; record sizes separately. Complexity: shape, boundary, and relationship variety. Spatial density: compression or openness of spaces, not simply percentage solid. Keep human-reviewed values and provenance. Do not confuse material branching with a branching circulation graph.

16. **Section descriptors below are proposed interpretations of Design 7's vocabulary.** Measurements are evidence for review, not calibrated scores or universal architectural standards. No numerical thresholds are approved at this checkpoint.

| Descriptor | Meaning for this project | Candidate 2D evidence | Proposed assembly action | Common false positive |
|---|---|---|---|---|
| Void continuity | Principal program spaces share a spatial network | Connections between bounded candidate void regions | Align cavity mouths; test offsets and selective subtraction | All spaces connect only by going around the outside |
| Carved | Void reads as removed from a legible larger mass | Surrounding mass and concave recesses | Join masses around existing cavities; preserve their contours | Any leftover gap between unrelated fragments |
| Stepped / terraced | Successive offsets create readable sectional levels | Repeated horizontal/vertical shifts with potential ledges | Translate and stack without mandatory subtraction | Arbitrary scatter or microscopic contour noise |
| Porous | Multiple distinct openings articulate mass | Opening count, distribution, and size recorded separately | Retain openings while aligning selected connections | Texture speckles counted as meaningful space |
| Continuous | A spatial or boundary sequence remains legible across tile joins | Boundary alignment or connected void sequence, reported separately | Align, overlap, or unite compatible parts | Assuming a seamless 2D contour proves material continuity |
| Retained / resistant | A substantial element persists beside erosion | Stable mass component and limited local subtraction | Protect a chosen component while arranging around it | High solid percentage with no spatial role |
| Threaded | A shared spatial sequence encounters several program regions | Connected sequence touching annotated regions | Place successive cavities along the common void | Mere contact at a point, or an unrelated long line |
| Graduated | Enclosure changes through intermediate conditions | Ordered changes in surrounding boundary and opening size | Arrange sheltered and exposed pockets sequentially | Unordered diversity of enclosure |
| Non-hierarchical | More than one plausible spatial connection remains available | Alternative void connections; human assessment | Preserve secondary openings and possible loops | Assuming every visible opening is a usable route |
| Force-driven | A declared input visibly influences composition | Recorded intent and operation provenance | Respond to entry/destination or another explicit rule | Inventing an erosion, sunlight, or circulation story afterward |
| Light-filled | A study suggests access to exterior light | Exterior-facing openings and sectional sightlines | Preserve upward or lateral exposure | Claiming daylight performance from a single 2D image |
| Monumental | Scale relationships suggest spatial significance | Void proportions; human-scale reference only if specified | Contrast a dominant opening with smaller surrounding spaces | Equating a large pixel area with monumentality |
| Compresses then releases | A connected sequence narrows before expanding | Changes in local void width/height along a stated sequence | Align necks and broader chambers | Comparing disconnected openings of different sizes |
| Sectional density | Space feels more compressed or open across the composition | Distribution of clearances and intervals, with human review | Cluster or separate masses without destroying topology | Treating solid-area ratio as the whole experience |

## Candidate Assembly Strategies

17. **Strategy status.** The following are project-specific hypotheses derived from the presentations and references, not verified generation algorithms. The generator would choose relationships automatically; the user would review their readings afterward. The same tile may serve several strategies. Categories may overlap.

| Program | Strategy | Proposed relationship | What must be preserved or checked |
|---|---|---|---|
| Lobby | Compressed sequential | Narrow threshold leads into a wider connected opening | Sequence, not merely different opening sizes |
| Lobby | Ground-field | Several lower-level pockets share a common void | May also read as gathering; no forced single label |
| Lobby | Vertical void | Connect openings along a vertical emphasis | Void continuity does not establish vertical access |
| Lobby | Continuous hall | Maintain a broad extended shared opening | Avoid fragmenting the main spatial reading |
| Lobby | Linear gallery | Link a more directional sequence of differentiated spaces | Must remain distinguishable from an undifferentiated hall |
| Gathering | Void-field | Distribute pockets around a shared network | Preserve secondary pockets and relationships |
| Gathering | Room-in-volume | Frame a more contained chamber within substantial mass | Need a proposed threshold if it is to join the shared network |
| Gathering | Stepped amphitheater | Offset ledges around a common spatial focus | Suggestive geometry only; no capacity or accessibility claim |
| Gathering | Inserted place | Form a local gathering pocket within a broader composition | Local distinction without isolation |
| Gathering | Linear edge | Arrange meeting pockets along a shared boundary or passage | Variation along the edge, not repeated decoration |
| Office | Terraced | Offset work-space candidates beside shared void | Retain substantial bounding geometry |
| Office | Void-edge | Concentrate erosion near one edge | Preserve the less-eroded portion |
| Office | Open hall | Frame a generous connected work-space candidate | Must be large relative to surrounding pockets, not assumed usable |
| Office | Flat deep-plan | Preserve a broader, less-eroded sectional interval | True plan depth cannot be established from this drawing alone |
| Office | Folded | Seek a connected changing boundary profile | Use existing tile profiles; do not introduce automatic reshaping |

18. **Shared network proposal.** All selected principal program regions should join one composition-level void network. This does not require every incidental cavity to connect or every region to have equal openness. A meaningful composition boundary and intended openings must distinguish internal relationships from the unbounded background. Point contacts and tiny numerical slivers cannot count as convincing connections. Tolerances and passage-scale interpretation belong to later geometric testing, not invented universal dimensions here.

19. **Mass and void rule.** White filled vectors are mass; transparency denotes void. Separate connection strokes that represent material need an explicit width before geometric evaluation. Filled masses are not occupied rooms: program interpretation belongs to adjoining voids and possible supporting surfaces. A single sectional slice cannot resolve out-of-plane connections.

20. **Variation without arbitrary placement.** Future generation can sample several strategies and several rigid arrangements within each strategy, keeping seeds reproducible. Evaluate candidate geometric relationships internally, then present alternatives for user interpretation. Do not collapse all descriptors into one quality score that repeatedly selects the same outcome. Keep successful and ambiguous readings visible. Existing transformation limits and the documented unbounded toggle remain unchanged.

21. **Avoid premature cleaning.** Continuity must not justify deleting islands, filling all small holes, thickening every slender branch, or reducing contours to generic polygons. Detailed vector preparation is a separate gated stage. Approved tiles 02, 04, and 29 are the future benchmark, not inputs to an experiment at this checkpoint.

## Knowledge Record and Feedback Proposal

22. **Future record structure.** Each concept should have a stable name, definition, source references and page/slide locations, project relevance, proposed geometric evidence, candidate operations, counterexamples, dimensional limitations, user review status, and revision history. Store the difference between source-backed observation, human annotation, measured value, and generated interpretation. This is a proposed schema, not an application data migration.

23. **Explanations must follow geometry.** A future explanation may say that two cavities were aligned to extend the shared void only if that operation and connection actually occurred. A proposed lobby reading can cite an arrival sequence; it cannot claim occupant satisfaction, compliance, structural stability, daylight performance, or model confidence without supporting analysis. Unknown should remain unknown.

24. **User feedback should be specific.** Prefer corrections such as 'preserve this narrow connection,' 'this reads as gathering rather than lobby,' or 'retain more intact mass' over an unexplained good/bad rating alone. The project should reveal which preferences influence subsequent generation and permit reversal. Broad definitions should not silently change because of one preferred result.

## Checkpoint A Review

25. **Recommended approval scope.** Approve the two-level descriptor system, the reference library as an initial expandable baseline, the listed spatial strategies as alternatives rather than templates, and connected principal voids with preserved incidental cavities. Keep experiential descriptors as interpretations supported by evidence rather than guaranteed scores.

26. **Unresolved issues for later checkpoints.** Vector segmentation fidelity; meaningful detail tolerance; how to identify the composition's internal void domain; scale calibration; distinctions between physically connected and visually related spaces; strategy diversity; and computation time. These require vector examples and tests. They are not reasons to claim that the architecture foundation already solves generation.

27. **Stop condition.** Stage 1 ends here for user review. Do not start the vector benchmark, trace images, alter approved drawings, rewrite the generator, or publish application changes until Checkpoint A receives explicit approval. Next authorized stage would be establishing the vector benchmark, ending at Checkpoint B before Potrace experiments.

## Source Files and Visual Notes

28. **Local source decks.** [Design 7 Presentation](/Users/ryanburgess/Downloads/Design%207%20Presentation.odp) and [FAU reference presentation](</Users/ryanburgess/Downloads/Florida_Atlantic_University_Critical_Mass_Presentation_Dangalan_Rice_Sanchez [Autosaved] 2.odp>). Slide references use presentation order. Static imagery and extracted text were reviewed in the preceding feedback phase; embedded videos were not reviewed. Local images above are review previews of user-provided slides, not new architectural evidence. External project links include the architects' visual references; their drawings have not been dimensionally measured or reverse-engineered.
