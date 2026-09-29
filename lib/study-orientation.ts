export type StudyOrientation = [number, number, number, number];
export type OrientableStudy = { flipY: boolean; orientation?: StudyOrientation };
export type OrientationAction = "rotate-left" | "rotate-right" | "flip-horizontal" | "flip-vertical" | "reset";

const identity: StudyOrientation = [1, 0, 0, 1];
const operations: Record<Exclude<OrientationAction, "reset">, StudyOrientation> = {
  "rotate-left": [0, -1, 1, 0],
  "rotate-right": [0, 1, -1, 0],
  "flip-horizontal": [-1, 0, 0, 1],
  "flip-vertical": [1, 0, 0, -1],
};

export function orientationFor(study: OrientableStudy): StudyOrientation {
  return study.orientation ?? (study.flipY ? [1, 0, 0, -1] : [...identity]);
}

export function changeOrientation(study: OrientableStudy, action: OrientationAction): StudyOrientation {
  if (action === "reset") return [...identity];
  const [a, b, c, d] = operations[action];
  const [e, f, g, h] = orientationFor(study);
  return [a * e + c * f, b * e + d * f, a * g + c * h, b * g + d * h].map(value => value || 0) as StudyOrientation;
}

export function orientationTransform(study: OrientableStudy) {
  const [a, b, c, d] = orientationFor(study);
  return `matrix(${a} ${b} ${c} ${d} ${50 - 50 * (a + c)} ${50 - 50 * (b + d)})`;
}

export function orientationName(study: OrientableStudy) {
  const names: Record<string, string> = {
    "1,0,0,1": "Original orientation",
    "0,1,-1,0": "Rotated 90° clockwise",
    "-1,0,0,-1": "Rotated 180°",
    "0,-1,1,0": "Rotated 90° counterclockwise",
    "-1,0,0,1": "Flipped horizontally",
    "1,0,0,-1": "Flipped vertically",
    "0,1,1,0": "Diagonal reflection",
    "0,-1,-1,0": "Opposite diagonal reflection",
  };
  return names[orientationFor(study).join(",")] ?? "Custom orientation";
}
