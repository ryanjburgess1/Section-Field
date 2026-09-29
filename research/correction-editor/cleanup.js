import { createGeometry } from "./geometry.js";

// No contour fitting: retained boundaries keep their original curve data.
export function createCleanup(paper) {
  const { make, split, paths } = createGeometry(paper);
  return function cleanup(shapes, { fragmentArea = 0, holeArea = 0, protectedIndices = [] } = {}) {
    const protectedSet = new Set(protectedIndices);
    const removed = [], filled = [], result = [];
    shapes.forEach((shape, index) => {
      if (protectedSet.has(index)) { result.push({ ...shape }); return; }
      for (const component of split(make(shape.d))) {
        const item = make(component.d);
        if (fragmentArea > 0 && Math.abs(item.area) < fragmentArea) {
          removed.push(component.d);
          continue;
        }
        const retained = paths(item).filter((path) => {
          if (!path.clockwise && holeArea > 0 && Math.abs(path.area) < holeArea) {
            // Leave holes containing other objects intact, including protected islands.
            const containsIsland = shapes.some((other, i) => i !== index &&
              paths(make(other.d)).some((p) => p.clockwise && path.bounds.contains(p.bounds) && path.contains(p.interiorPoint)));
            if (!containsIsland) { filled.push(path.pathData); return false; }
          }
          return true;
        });
        result.push({ d: retained.map((p) => p.pathData).join(" ") });
      }
    });
    return { shapes: result, removed, filled };
  };
}
