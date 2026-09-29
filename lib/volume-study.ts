import type { Correction } from "../components/correction-editor";

export const cubeFaces = ["front", "back", "left", "right", "top", "bottom"] as const;
export const prismFaces = ["side1", "side2", "side3", "side4", "side5", "side6", "top", "bottom"] as const;
export const volumeFaces = [...cubeFaces, ...prismFaces.filter(face => face.startsWith("side"))] as const;
export type VolumeShape = "cube" | "hex-prism";
export type VolumeFaceName = (typeof volumeFaces)[number];
export function facesForShape(shape: VolumeShape = "cube"): readonly VolumeFaceName[] {
  return shape === "hex-prism" ? prismFaces : cubeFaces;
}
export const HEX_APOTHEM = Math.sqrt(3) / 2;
export function hexSidePose(index: number) {
  const angle = index * Math.PI / 3;
  return { angle, x: Math.cos(angle) * HEX_APOTHEM, z: Math.sin(angle) * HEX_APOTHEM };
}
export type VolumeFace = { tileId: number; correction: Correction };
export type VolumeAssignments = Partial<Record<VolumeFaceName, VolumeFace>>;
export type VolumeRecipe = {
  shape?: VolumeShape;
  faces: VolumeAssignments;
  seed: number;
  fitTolerance: number;
};
export type VolumeRecord = VolumeRecipe & {
  id: string;
  name: string;
  createdAt: number;
  generatorVersion: 1;
};

const MASK_SIZE = 112;

export function faceMask(correction: Correction, size = MASK_SIZE) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is unavailable");
  const scale = size / Math.max(correction.width, correction.height);
  ctx.translate((size - correction.width * scale) / 2, (size - correction.height * scale) / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#fff";
  for (const shape of correction.shapes) ctx.fill(new Path2D(shape.d), "evenodd");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const rgba = ctx.getImageData(0, 0, size, size).data;
  const binary = new Uint8Array(size * size);
  for (let i = 0; i < binary.length; i++) binary[i] = rgba[i * 4 + 3] > 127 ? 1 : 0;
  return binary;
}

function signedMask(binary: Uint8Array, size: number) {
  const field = new Float32Array(binary.length);
  for (let i = 0; i < field.length; i++) field[i] = binary[i] ? 32 : -32;
  // A short chamfer transform makes the generated surface smoother without
  // simplifying or changing the approved 2D source geometry.
  for (let pass = 0; pass < 2; pass++) {
    const forward = pass === 0;
    for (let yi = 0; yi < size; yi++) {
      const y = forward ? yi : size - 1 - yi;
      for (let xi = 0; xi < size; xi++) {
        const x = forward ? xi : size - 1 - xi;
        const i = y * size + x;
        const sign = binary[i] ? 1 : -1;
        let distance = Math.abs(field[i]);
        for (const [dx, dy, step] of [[-1, 0, 1], [0, -1, 1], [-1, -1, 1.414], [1, -1, 1.414]]) {
          const nx = x + (forward ? dx : -dx);
          const ny = y + (forward ? dy : -dy);
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
          const ni = ny * size + nx;
          if (binary[ni] !== binary[i]) distance = Math.min(distance, step / 2);
          else distance = Math.min(distance, Math.abs(field[ni]) + step);
        }
        field[i] = sign * distance;
      }
    }
  }
  return field;
}

function coordinates(face: VolumeFaceName, x: number, y: number, z: number, shape: VolumeShape) {
  if (shape === "hex-prism" && face.startsWith("side")) {
    const { angle } = hexSidePose(Number(face.slice(4)) - 1);
    const worldX = x * 2 - 1, worldZ = z * 2 - 1;
    const normal = worldX * Math.cos(angle) + worldZ * Math.sin(angle);
    const tangent = -worldX * Math.sin(angle) + worldZ * Math.cos(angle);
    return [0.5 + tangent, 1 - y, (HEX_APOTHEM - normal) / (2 * HEX_APOTHEM)] as const;
  }
  switch (face) {
    case "front": return [x, 1 - y, z] as const;
    case "back": return [1 - x, 1 - y, 1 - z] as const;
    case "left": return [z, 1 - y, x] as const;
    case "right": return [1 - z, 1 - y, 1 - x] as const;
    case "top": return [x, z, 1 - y] as const;
    case "bottom": return [x, 1 - z, y] as const;
  }
  throw new Error(`Unsupported volume face: ${face}`);
}

export function buildVolumeField(recipe: VolumeRecipe, resolution = 46) {
  const masks = facesForShape(recipe.shape).flatMap(name => {
    const assignment = recipe.faces[name];
    if (!assignment) return [];
    return [{ name, mask: faceMask(assignment.correction) }];
  });
  return buildVolumeFieldFromMasks(masks, recipe.seed, recipe.fitTolerance, resolution, recipe.shape ?? "cube");
}

export function buildVolumeFieldFromMasks(
  masks: { name: VolumeFaceName; mask: Uint8Array }[],
  seed: number,
  fitTolerance: number,
  resolution = 46,
  shape: VolumeShape = "cube",
) {
  const active = masks.map(({ name, mask }) => ({ name, distance: signedMask(mask, MASK_SIZE) }));
  const n = resolution;
  const field = new Float32Array(n * n * n);
  const adjustments: Partial<Record<VolumeFaceName, [number, number][]>> = {};
  if (!active.length) return { field, resolution: n, faceFit: 0, adjustments };
  const initial = new Float32Array(field.length);
  const fixed = new Uint8Array(field.length);
  const index = (x: number, y: number, z: number) => z * n * n + y * n + x;
  const tolerance = Math.max(0, Math.min(100, fitTolerance));
  const seamBand = 0.012 + tolerance * 0.0007;
  let compared = 0;
  let changed = 0;

  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = index(x, y, z);
    if (x <= 1 || y <= 1 || z <= 1 || x >= n - 2 || y >= n - 2 || z >= n - 2) {
      field[i] = initial[i] = -1;
      fixed[i] = 1;
      continue;
    }
    const p = [x, y, z].map(value => (value - 2) / (n - 5));
    let clearance = Infinity;
    if (shape === "hex-prism") {
      const worldX = p[0] * 2 - 1, worldZ = p[2] * 2 - 1;
      for (let side = 0; side < 6; side++) {
        const angle = side * Math.PI / 3;
        clearance = Math.min(clearance, HEX_APOTHEM - worldX * Math.cos(angle) - worldZ * Math.sin(angle));
      }
      if (clearance < 0) {
        field[i] = initial[i] = -1;
        fixed[i] = 1;
        continue;
      }
    }
    let weighted = 0;
    let weights = 0;
    let ownerSum = 0;
    const owners: { name: VolumeFaceName; u: number; v: number; signed: number }[] = [];
    for (const face of active) {
      const [u, v, depth] = coordinates(face.name, p[0], p[1], p[2], shape);
      const mx = Math.max(0, Math.min(MASK_SIZE - 1, Math.round(u * (MASK_SIZE - 1))));
      const my = Math.max(0, Math.min(MASK_SIZE - 1, Math.round(v * (MASK_SIZE - 1))));
      const signed = Math.max(-1, Math.min(1, face.distance[my * MASK_SIZE + mx] / 2.4));
      const weight = 1 / Math.pow(0.055 + depth, 2);
      weighted += signed * weight;
      weights += weight;
      if (depth < (shape === "hex-prism" && face.name.startsWith("side") ? 0.035 : 0.0001)) {
        ownerSum += signed;
        owners.push({ name: face.name, u, v, signed });
      }
    }
    let value = weighted / weights;
    if (owners.length) {
      const own = ownerSum / owners.length;
      const adjacent = active.filter(face => coordinates(face.name, p[0], p[1], p[2], shape)[2] < seamBand);
      const seam = adjacent.length > owners.length;
      value = seam ? value * (tolerance / 100) * 0.42 + own * (1 - (tolerance / 100) * 0.42) : own;
      fixed[i] = 1;
      for (const owner of owners) {
        compared++;
        if ((value > 0) !== (owner.signed > 0)) {
          changed++;
          (adjustments[owner.name] ??= []).push([owner.u, owner.v]);
        }
      }
    } else {
      const nearest = Math.min(...active.map(face => coordinates(face.name, p[0], p[1], p[2], shape)[2]));
      const interior = Math.min(1, nearest * 4);
      const wave = Math.sin(p[0] * 9.7 + seed * 1.31) *
        Math.cos(p[1] * 8.3 - seed * 0.89) *
        Math.sin(p[2] * 7.1 + seed * 0.43);
      value += wave * interior * 0.22;
    }
    if (shape === "hex-prism") value = Math.min(value, clearance * 3);
    field[i] = initial[i] = value;
  }

  const next = new Float32Array(field);
  for (let pass = 0; pass < 18; pass++) {
    for (let z = 2; z < n - 2; z++) for (let y = 2; y < n - 2; y++) for (let x = 2; x < n - 2; x++) {
      const i = index(x, y, z);
      if (fixed[i]) continue;
      const nearby = (field[i - 1] + field[i + 1] + field[i - n] + field[i + n] + field[i - n * n] + field[i + n * n]) / 6;
      next[i] = nearby * 0.69 + initial[i] * 0.31;
    }
    field.set(next);
  }
  return { field, resolution: n, faceFit: compared ? Math.round((1 - changed / compared) * 100) : 0, adjustments };
}

export function sampleVolumeField(field: Float32Array, resolution: number, x: number, y: number, z: number) {
  const n = resolution;
  const toGrid = (world: number) => Math.max(0, Math.min(n - 1.001, (world * (n - 4) + n) / 2));
  const gx = toGrid(x), gy = toGrid(y), gz = toGrid(z);
  const x0 = Math.floor(gx), y0 = Math.floor(gy), z0 = Math.floor(gz);
  const dx = gx - x0, dy = gy - y0, dz = gz - z0;
  const at = (ix: number, iy: number, iz: number) => field[iz * n * n + iy * n + ix];
  const lower =
    (at(x0, y0, z0) * (1 - dx) + at(x0 + 1, y0, z0) * dx) * (1 - dy) +
    (at(x0, y0 + 1, z0) * (1 - dx) + at(x0 + 1, y0 + 1, z0) * dx) * dy;
  const upper =
    (at(x0, y0, z0 + 1) * (1 - dx) + at(x0 + 1, y0, z0 + 1) * dx) * (1 - dy) +
    (at(x0, y0 + 1, z0 + 1) * (1 - dx) + at(x0 + 1, y0 + 1, z0 + 1) * dx) * dy;
  return lower * (1 - dz) + upper * dz;
}
