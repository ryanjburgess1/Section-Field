import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createGeometry } from "./geometry.js";
const require = createRequire(import.meta.url);
const paper = require("./package/dist/paper-core.js");
paper.setup(new paper.Size(800, 800));
const { make, split } = createGeometry(paper);
const ring = make(
  "M0 0H100V100H0Z M20 20H80V80H20Z M40 40H60V60H40Z M120 0H125V5H120Z",
);
const objects = split(ring);
assert.equal(objects.length, 3, "outer ring, nested island, detached island");
const inside = (items, x, y) =>
  items.some((s) => make(s.d).contains(new paper.Point(x, y)));
assert(inside(objects, 10, 10));
assert(!inside(objects, 30, 30));
assert(inside(objects, 50, 50));
assert(inside(objects, 122, 2));
const cut = new paper.Path.Rectangle({
  rectangle: [0, 45, 100, 10],
  insert: false,
});
const erased = ring.subtract(cut, { insert: false });
erased.reorient(false, true);
const pieces = split(erased);
assert(!inside(pieces, 10, 50));
assert(!inside(pieces, 50, 50));
assert(inside(pieces, 50, 42));
const repaired = erased.unite(cut, { insert: false });
repaired.reorient(false, true);
assert(inside(split(repaired), 10, 50));
assert(!inside(split(repaired), 30, 30));
const restored = JSON.parse(JSON.stringify(pieces));
assert.deepEqual(restored, pieces);
assert(!inside(restored, 10, 50));
const svg = readFileSync(
  new URL(
    "../vector-experiment/tile-29-720-connected-tones.svg",
    import.meta.url,
  ),
  "utf8",
);
const d = svg.match(/ d="([^"]+)"/)[1];
const source = make(d),
  parts = split(source).map((s) => make(s.d));
let checked = 0;
for (let y = 1.137; y < 720; y += 5)
  for (let x = 1.319; x < 561; x += 5) {
    const p = new paper.Point(x, y);
    const actual = parts.some((s) => s.contains(p)),
      expected = source.contains(p);
    if (actual !== expected) {
      const distance = Math.min(
        ...source.children.map((c) => c.getNearestLocation(p).distance),
      );
      assert(
        distance < 0.001,
        `tile geometry changed at ${x},${y} (${distance} from contour)`,
      );
    }
    checked++;
  }
console.log(
  `PASS: nested holes/islands, subtraction, union, JSON persistence, ${checked} tile sample points.`,
);
