import { HEX_APOTHEM, hexSidePose, type VolumeRecord, type VolumeShape } from "./volume-study";

export type BuilderBlock = { id: string; volumeId: string; position: [number, number, number] };
export type BuilderDraft = { blocks: BuilderBlock[]; fused: boolean };
export type AssemblyRecord = BuilderDraft & { id: string; name: string; createdAt: number; updatedAt: number };
export type PlacementDirection = "up" | "down" | "east" | "west" | "north" | "south" |
  "side1" | "side2" | "side3" | "side4" | "side5" | "side6";

export const emptyBuilderDraft = (): BuilderDraft => ({ blocks: [], fused: false });
export const shapeOf = (record: VolumeRecord): VolumeShape => record.shape ?? "cube";

export function directionsFor(shape: VolumeShape): PlacementDirection[] {
  return shape === "hex-prism"
    ? ["side1", "side2", "side3", "side4", "side5", "side6", "up", "down"]
    : ["east", "west", "north", "south", "up", "down"];
}

function directionNormal(direction: PlacementDirection): [number, number] | null {
  if (direction === "east") return [1, 0];
  if (direction === "west") return [-1, 0];
  if (direction === "north") return [0, -1];
  if (direction === "south") return [0, 1];
  if (direction.startsWith("side")) {
    const { angle } = hexSidePose(Number(direction.slice(4)) - 1);
    return [Math.cos(angle), Math.sin(angle)];
  }
  return null;
}

function hasFace(shape: VolumeShape, normal: [number, number]) {
  const choices = shape === "cube" ? [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2] :
    Array.from({ length: 6 }, (_, index) => index * Math.PI / 3);
  return choices.some(angle => Math.cos(angle) * normal[0] + Math.sin(angle) * normal[1] > 0.999);
}

function radius(shape: VolumeShape) { return shape === "cube" ? 1 : HEX_APOTHEM; }

export function placementOffset(anchor: VolumeShape, incoming: VolumeShape, direction: PlacementDirection): [number, number, number] | null {
  if (direction === "up") return [0, 2, 0];
  if (direction === "down") return [0, -2, 0];
  const normal = directionNormal(direction);
  if (!normal || !hasFace(incoming, [-normal[0], -normal[1]])) return null;
  const distance = radius(anchor) + radius(incoming);
  return [normal[0] * distance, 0, normal[1] * distance];
}

function footprint(shape: VolumeShape, position: [number, number, number]): [number, number][] {
  if (shape === "cube") return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => [x + position[0], z + position[2]]);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 6 + index * Math.PI / 3;
    return [position[0] + Math.cos(angle), position[2] + Math.sin(angle)];
  });
}

function overlaps2D(a: [number, number][], b: [number, number][]) {
  for (const polygon of [a, b]) for (let index = 0; index < polygon.length; index++) {
    const start = polygon[index], end = polygon[(index + 1) % polygon.length];
    const axis: [number, number] = [end[1] - start[1], start[0] - end[0]];
    const project = (points: [number, number][]) => points.map(point => point[0] * axis[0] + point[1] * axis[1]);
    const pa = project(a), pb = project(b);
    if (Math.max(...pa) <= Math.min(...pb) + 1e-4 || Math.max(...pb) <= Math.min(...pa) + 1e-4) return false;
  }
  return true;
}

export function blocksOverlap(a: BuilderBlock, b: BuilderBlock, records: Map<string, VolumeRecord>) {
  const first = records.get(a.volumeId), second = records.get(b.volumeId);
  if (!first || !second) return false;
  if (Math.abs(a.position[1] - b.position[1]) >= 2 - 1e-4) return false;
  return overlaps2D(footprint(shapeOf(first), a.position), footprint(shapeOf(second), b.position));
}

export function addAdjacent(blocks: BuilderBlock[], anchorId: string | null, record: VolumeRecord,
  direction: PlacementDirection, records: Map<string, VolumeRecord>, id: string): BuilderBlock[] | null {
  if (!blocks.length) return [{ id, volumeId: record.id, position: [0, 0, 0] }];
  const anchor = blocks.find(block => block.id === anchorId);
  const anchorRecord = anchor && records.get(anchor.volumeId);
  if (!anchor || !anchorRecord) return null;
  const offset = placementOffset(shapeOf(anchorRecord), shapeOf(record), direction);
  if (!offset) return null;
  const position = anchor.position.map((value, index) => Math.round((value + offset[index]) * 10000) / 10000) as [number, number, number];
  const added = { id, volumeId: record.id, position };
  if (blocks.some(block => blocksOverlap(block, added, records))) return null;
  return [...blocks, added];
}

export function moveBlocks(blocks: BuilderBlock[], selected: Set<string>, offset: [number, number, number],
  records: Map<string, VolumeRecord>): BuilderBlock[] | null {
  const next = blocks.map(block => selected.has(block.id)
    ? { ...block, position: block.position.map((value, index) => Math.round((value + offset[index]) * 10000) / 10000) as [number, number, number] }
    : block);
  for (let i = 0; i < next.length; i++) for (let j = i + 1; j < next.length; j++) {
    if (selected.has(next[i].id) === selected.has(next[j].id)) continue;
    if (blocksOverlap(next[i], next[j], records)) return null;
  }
  return next;
}
