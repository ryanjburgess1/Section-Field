import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createGeometry } from "./geometry.js";
import { createCleanup } from "./cleanup.js";
const paper = createRequire(import.meta.url)("./package/dist/paper-core.js");
paper.setup(new paper.Size(800, 800));
const { make, split } = createGeometry(paper);
const cleanup = createCleanup(paper);
const input = split(make("M0 0H100V100H0Z M20 20H22V22H20Z M120 0H122V2H120Z"));
const snapshot = JSON.stringify(input);
const result = cleanup(input, { fragmentArea: 5, holeArea: 5 });
assert.equal(result.removed.length, 1);
assert.equal(result.filled.length, 1);
assert(make(result.shapes[0].d).contains(new paper.Point(21, 21)));
assert.equal(JSON.stringify(input), snapshot, "source remains untouched");
assert.deepEqual(cleanup(input, { fragmentArea: 5, holeArea: 5, protectedIndices: [0, 1] }).shapes, input);
const nested = split(make("M0 0H100V100H0Z M20 20H40V40H20Z M25 25H30V30H25Z"));
assert.equal(cleanup(nested, { holeArea: 500 }).filled.length, 0, "nested island preserved");
const connector = [{ d: "M0 0H20V9H80V0H100V20H80V11H20V20H0Z" }];
assert.equal(cleanup(connector, { fragmentArea: 100 }).removed.length, 0, "thin connected branch retained");
for (const tile of ["01", "29"]) {
  const svg = readFileSync(new URL(`../vector-experiment/tile-${tile}-720-connected-tones.svg`, import.meta.url), "utf8");
  const source = split(make(svg.match(/ d="([^"]+)"/)[1]));
  const cleaned = cleanup(source, { fragmentArea: 80, holeArea: 40 });
  const originalContours = new Set(source.flatMap((s) => make(s.d).children.map((p) => p.pathData)));
  for (const s of cleaned.shapes)
    for (const p of make(s.d).children)
      assert(originalContours.has(p.pathData), "retained contours unchanged");
  console.log(`Tile ${tile}: ${cleaned.removed.length} fragments, ${cleaned.filled.length} holes; retained curves unchanged`);
}
console.log("PASS: cleanup, protection, nested islands, branches, source preservation");
