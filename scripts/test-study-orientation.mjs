import assert from "node:assert/strict";
import { changeOrientation, orientationFor, orientationName, orientationTransform } from "../lib/study-orientation.ts";

const original = { flipY: false };
const right = { ...original, orientation: changeOrientation(original, "rotate-right") };
assert.deepEqual(right.orientation, [0, 1, -1, 0]);
assert.equal(orientationName(right), "Rotated 90° clockwise");
assert.equal(orientationTransform(right), "matrix(0 1 -1 0 100 0)");

let orientation = orientationFor(original);
for (let i = 0; i < 4; i++) orientation = changeOrientation({ ...original, orientation }, "rotate-right");
assert.deepEqual(orientation, [1, 0, 0, 1]);

const horizontal = { ...original, orientation: changeOrientation(right, "flip-horizontal") };
assert.deepEqual(horizontal.orientation, [0, 1, 1, 0]);
assert.deepEqual(changeOrientation(horizontal, "flip-horizontal"), right.orientation);
assert.deepEqual(changeOrientation({ flipY: true }, "reset"), [1, 0, 0, 1]);
assert.equal(orientationName({ flipY: true }), "Flipped vertically");
console.log("PASS: whole-study rotation, screen-axis flip, reset, and legacy reflection");
