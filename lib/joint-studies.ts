import type { Pose } from "./connection-study";
import type { StudyOrientation } from "./study-orientation";

export type JointRating = "strong" | "promising" | "weak" | null;
export type JointStudy = {
  id: string;
  label: string;
  sourceSeed: string;
  sourceNumber: number;
  tileIds: [number, number];
  poses: [Pose, Pose];
  flipY: boolean;
  orientation?: StudyOrientation;
  parentId?: string;
  rating: JointRating;
  tags: string[];
  note: string;
  geometryPass?: boolean;
  origin?: "search";
  batchId?: string;
  poolTileIds?: number[];
  confirmedAt?: number;
};

export const jointTags = [
  "Horizontal platforms",
  "Connected spaces",
  "Terracing",
  "Compression / relief",
  "Usable space",
  "Unclear organization",
];

const second: [Pose, Pose] = [
  { x: 28, y: 50, angle: 180, scale: .43, mirror: false },
  { x: 51.38216229752288, y: 62.094282476231456, angle: 180, scale: .36723867167718705, mirror: false },
];
const fifteenth: [Pose, Pose] = [
  { x: 28, y: 50, angle: 90, scale: .43, mirror: false },
  { x: 48.43038341059582, y: 57.798456974327564, angle: 0, scale: .4138195346156135, mirror: true },
];

export function initialJointStudies(): JointStudy[] {
  return [
    {
      id: "connection-01-study-02",
      label: "Study 02",
      sourceSeed: "connection-01",
      sourceNumber: 2,
      tileIds: [2, 4],
      poses: second,
      flipY: false,
      rating: "strong",
      tags: ["Horizontal platforms", "Connected spaces"],
      note: "Clear horizontal platforms and connected spaces.",
    },
    {
      id: "connection-01-study-15",
      label: "Study 15 · Original",
      sourceSeed: "connection-01",
      sourceNumber: 15,
      tileIds: [25, 29],
      poses: fifteenth,
      flipY: false,
      rating: "weak",
      tags: [],
      note: "The long plane is overhead in this orientation.",
    },
    {
      id: "connection-01-study-15-flipped",
      label: "Study 15 · Flipped",
      sourceSeed: "connection-01",
      sourceNumber: 15,
      tileIds: [25, 29],
      poses: fifteenth,
      flipY: true,
      parentId: "connection-01-study-15",
      rating: null,
      tags: [],
      note: "",
    },
  ];
}

const adjustments: { id: string; label: string; change: (pose: Pose, flipped: boolean) => Pose }[] = [
  { id: "closer", label: "Closer overlap", change: p => ({ ...p, x: p.x - 3 }) },
  { id: "farther", label: "Less overlap", change: p => ({ ...p, x: p.x + 3 }) },
  { id: "raised", label: "Raise second tile", change: (p, flipped) => ({ ...p, y: p.y + (flipped ? 4 : -4) }) },
  { id: "lowered", label: "Lower second tile", change: (p, flipped) => ({ ...p, y: p.y + (flipped ? -4 : 4) }) },
  { id: "turn-plus", label: "Turn second tile +8°", change: (p, flipped) => ({ ...p, angle: p.angle + (flipped ? -8 : 8) }) },
  { id: "turn-minus", label: "Turn second tile -8°", change: (p, flipped) => ({ ...p, angle: p.angle + (flipped ? 8 : -8) }) },
  { id: "larger", label: "Enlarge second tile", change: p => ({ ...p, scale: p.scale * 1.06 }) },
  { id: "smaller", label: "Reduce second tile", change: p => ({ ...p, scale: p.scale * .94 }) },
];

export function jointVariations(anchor: JointStudy): JointStudy[] {
  return adjustments.map(adjustment => ({
    ...anchor,
    id: `${anchor.id}-${adjustment.id}`,
    label: adjustment.label,
    poses: [anchor.poses[0], adjustment.change(anchor.poses[1], anchor.flipY)],
    parentId: anchor.id,
    rating: null,
    tags: [],
    note: "",
  }));
}
