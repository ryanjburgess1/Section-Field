import type { Pose } from "./connection-study";
import type { JointRating } from "./joint-studies";
import type { StudyOrientation } from "./study-orientation";

export type ExtensionStudy = {
  id: string;
  sourceJointId: string;
  seed: string;
  tileIds: [number, number, number];
  poses: [Pose, Pose, Pose];
  flipY: boolean;
  orientation?: StudyOrientation;
  direction: "left" | "right";
  rating: JointRating;
  tags: string[];
  note: string;
  confirmedAt?: number;
};
