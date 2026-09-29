import { GRID, type Pose } from "./connection-study";

export type MaskTile = {
  id: number;
  correction: { width: number; height: number; shapes: { d: string }[] };
};

export function tileMask(tile: MaskTile, pose: Pose) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = GRID;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.scale(GRID / 100, GRID / 100);
  context.translate(pose.x, pose.y);
  context.rotate(pose.angle * Math.PI / 180);
  context.scale(pose.mirror ? -pose.scale : pose.scale, pose.scale);
  context.translate(-50, -50);
  const geometry = tile.correction;
  const scale = 100 / Math.max(geometry.width, geometry.height);
  context.translate((100 - geometry.width * scale) / 2, (100 - geometry.height * scale) / 2);
  context.scale(scale, scale);
  for (const shape of geometry.shapes) context.fill(new Path2D(shape.d), "evenodd");
  const pixels = context.getImageData(0, 0, GRID, GRID).data;
  return Uint8Array.from({ length: GRID * GRID }, (_, index) => pixels[index * 4 + 3] >= 128 ? 1 : 0);
}
