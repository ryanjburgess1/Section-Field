export const GRID = 128;
export type Pose = { x: number; y: number; angle: number; scale: number; mirror: boolean };

export function massBounds(mask: Uint8Array, n = GRID) {
  let minX = n, minY = n, maxX = -1, maxY = -1, area = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) {
    const x = i % n, y = Math.floor(i / n);
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); area++;
  }
  return { minX, minY, maxX, maxY, area };
}

// A join must add visible geometry without covering a large part of either tile.
export function adjacentMasses(masks: Uint8Array[], n = GRID) {
  if (masks.length < 2) return false;
  const last = masks.at(-1)!;
  const prior = masks.slice(0, -1);
  const bounds = prior.map(m => massBounds(m, n));
  const next = massBounds(last, n);
  if (!next.area || next.minX < 2 || next.maxX > n - 3 || next.minY < 2 || next.maxY > n - 3) return false;
  let overlap = 0, near = 0;
  const priorMass = Uint8Array.from({ length: n * n }, (_, i) => prior.some(m => m[i]) ? 1 : 0);
  for (let i = 0; i < last.length; i++) if (last[i]) {
    if (priorMass[i]) overlap++;
    const x = i % n, y = Math.floor(i / n);
    let nearby = false;
    for (let dy = -2; dy <= 2 && !nearby; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < n && yy >= 0 && yy < n && priorMass[yy * n + xx]) { nearby = true; break; }
    }
    if (nearby) near++;
  }
  const minArea = Math.min(next.area, ...bounds.map(b => b.area));
  return overlap / Math.max(1, minArea) <= .12 && near >= 8;
}

export function evaluateJigsaw(masks: Uint8Array[], n = GRID) {
  if (!adjacentMasses(masks, n)) return null;
  const mass = Uint8Array.from({ length: n * n }, (_, i) => masks.some(m => m[i]) ? 1 : 0);
  const voids = masks.map(m => supportedVoid(mass, n).map((v, i) => v && !mass[i] ? 1 : 0));
  const open = voids[0];
  const local = masks.map(m => supportedVoid(m, n));
  const totals = local.map(v => v.reduce((a, b) => a + b, 0));
  const seen = new Uint8Array(n * n);
  let best: { cells: number[]; coverage: number; score: number; width: number } | null = null;
  for (let start = 0; start < open.length; start++) {
    if (!open[start] || seen[start]) continue;
    const cells = [start]; seen[start] = 1;
    const counts = local.map(() => 0);
    let minX = n, maxX = 0, minY = n, maxY = 0;
    for (let head = 0; head < cells.length; head++) {
      const i = cells[head], x = i % n, y = Math.floor(i / n);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      local.forEach((v, k) => counts[k] += v[i]);
      for (const j of [x ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y ? i - n : -1, y < n - 1 ? i + n : -1])
        if (j >= 0 && open[j] && !seen[j]) { seen[j] = 1; cells.push(j); }
    }
    const coverage = Math.min(...counts.map((c, k) => c / Math.max(1, totals[k])));
    const width = maxX - minX + 1, height = maxY - minY + 1;
    if (cells.length < 40 || coverage < .12 || width < n * .18 || height < n * .06) continue;
    const score = coverage * .55 + Math.min(1, cells.length / (n * n * .12)) * .25 + Math.min(1, width / (n * .7)) * .2;
    if (!best || score > best.score) best = { cells, coverage, score, width };
  }
  return best;
}

export function evaluateJoint(a: Uint8Array, b: Uint8Array, n = GRID) {
  const ba = massBounds(a, n), bb = massBounds(b, n);
  if (!ba.area || !bb.area || bb.minX < 2 || bb.maxX > n - 3 || bb.minY < 2 || bb.maxY > n - 3) return null;
  const mass = new Uint8Array(n * n);
  let overlap = 0;
  for (let i = 0; i < mass.length; i++) {
    mass[i] = a[i] || b[i] ? 1 : 0;
    if (a[i] && b[i]) overlap++;
  }
  const overlapRatio = overlap / Math.min(ba.area, bb.area);
  if (overlapRatio < .025 || overlapRatio > .28) return null;
  const neighbors = (i: number) => {
    const x = i % n, y = Math.floor(i / n);
    return [x ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y ? i - n : -1, y < n - 1 ? i + n : -1].filter(j => j >= 0);
  };

  // A real joint carries a substantial connected piece of each source mass.
  const massSeen = new Uint8Array(n * n);
  let massContinuity = 0;
  for (let start = 0; start < mass.length; start++) {
    if (!mass[start] || massSeen[start]) continue;
    const queue = [start]; massSeen[start] = 1;
    let countA = 0, countB = 0;
    for (let h = 0; h < queue.length; h++) {
      const i = queue[h]; countA += a[i]; countB += b[i];
      for (const j of neighbors(i)) if (mass[j] && !massSeen[j]) { massSeen[j] = 1; queue.push(j); }
    }
    massContinuity = Math.max(massContinuity, Math.min(countA / ba.area, countB / bb.area));
  }
  if (massContinuity < .14) return null;

  const open = supportedVoid(mass, n), localA = supportedVoid(a, n), localB = supportedVoid(b, n);
  const seen = new Uint8Array(n * n);
  const seam = (ba.maxX + bb.minX) / 2;
  let best: { cells: number[]; score: number; massContinuity: number; overlapRatio: number; hierarchy: number; span: number; platformScore: number } | null = null;
  for (let start = 0; start < open.length; start++) {
    if (!open[start] || seen[start]) continue;
    const cells = [start]; seen[start] = 1;
    let touchesA = 0, touchesB = 0, localVoidA = 0, localVoidB = 0, left = 0, right = 0, minX = n, maxX = 0;
    const distance = new Int16Array(n * n).fill(n * 2);
    for (let h = 0; h < cells.length; h++) {
      const i = cells[h], x = i % n;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      if (x < seam - 2) left++; else if (x > seam + 2) right++;
      localVoidA += localA[i]; localVoidB += localB[i];
      const adjacent = neighbors(i);
      if (adjacent.some(j => a[j])) touchesA++;
      if (adjacent.some(j => b[j])) touchesB++;
      for (const j of adjacent) if (open[j] && !seen[j] && !mass[j]) { seen[j] = 1; cells.push(j); }
    }
    if (cells.length < 65 || left < 20 || right < 20 || touchesA < 5 || touchesB < 5 ||
      localVoidA < 16 || localVoidB < 16 || maxX - minX < n * .2) continue;
    // Clearance distribution distinguishes a primary space from transitions.
    const frontier: number[] = [];
    for (const i of cells) if (neighbors(i).some(j => mass[j])) { distance[i] = 1; frontier.push(i); }
    for (let h = 0; h < frontier.length; h++) for (const j of neighbors(frontier[h])) {
      if (open[j] && distance[j] > distance[frontier[h]] + 1) { distance[j] = distance[frontier[h]] + 1; frontier.push(j); }
    }
    const widths = cells.map(i => distance[i]).sort((x, y) => x - y);
    const median = widths[Math.floor(widths.length * .5)], wide = widths[Math.floor(widths.length * .9)];
    if (wide < 3) continue;
    const hierarchy = Math.min(1, (wide - median) / Math.max(1, wide));
    const span = (maxX - minX) / n;
    const balancedTouch = Math.min(touchesA, touchesB) / Math.max(touchesA, touchesB);
    const platformRuns: { y: number; length: number }[][] = [[], []];
    const inVoid = new Uint8Array(n * n);
    for (const i of cells) inVoid[i] = 1;
    for (let source = 0; source < 2; source++) {
      const tileMass = source ? b : a;
      for (let y = 3; y < n - 3; y++) {
        let start = -1, last = -1, longest = 0;
        for (let x = 1; x < n - 1; x++) {
          let edge = false;
          for (let dy = -2; dy <= 2 && !edge; dy++) {
            const i = (y + dy) * n + x;
            edge = Boolean(inVoid[i] && (tileMass[i - n] || tileMass[i + n]));
          }
          if (edge) { if (start < 0) start = x; last = x; }
          else if (start >= 0 && x - last > 3) { longest = Math.max(longest, last - start + 1); start = -1; }
        }
        if (start >= 0) longest = Math.max(longest, last - start + 1);
        if (longest >= n * .07) platformRuns[source].push({ y, length: longest });
      }
      platformRuns[source].sort((x, y) => y.length - x.length);
    }
    const platformScore = Math.min(...platformRuns.map(runs =>
      Math.min(1, (runs[0]?.length || 0) / (n * .18))));
    const leftDepths: number[] = [], rightDepths: number[] = [];
    for (let x = minX; x <= maxX; x++) {
      let depth = 0;
      for (let y = 0; y < n; y++) depth += inVoid[y * n + x];
      if (depth >= 3) (x < seam ? leftDepths : rightDepths).push(depth);
    }
    const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    const leftDepth = average(leftDepths), rightDepth = average(rightDepths);
    const relief = Math.abs(leftDepth - rightDepth) / Math.max(1, leftDepth, rightDepth);
    const spatialHierarchy = Math.max(hierarchy, relief);
    const score = .28 * platformScore + .23 * massContinuity + .16 * balancedTouch +
      .24 * spatialHierarchy + .06 * Math.min(1, span / .6) + .03 * Math.min(1, cells.length / (n * n * .06));
    if (!best || score > best.score) best = { cells, score, massContinuity, overlapRatio, hierarchy: spatialHierarchy, span, platformScore };
  }
  return best;
}

// Opposed mass on a row or column supports a sectional void; exterior air alone does not.
export function supportedVoid(mass: Uint8Array, n = GRID) {
  const result = new Uint8Array(n * n);
  for (let axis = 0; axis < 2; axis++) for (let row = 0; row < n; row++) {
    const at = (col: number) => axis ? col * n + row : row * n + col;
    let first = -1, last = -1;
    for (let col = 0; col < n; col++) if (mass[at(col)]) { if (first < 0) first = col; last = col; }
    for (let col = first + 1; first >= 0 && col < last; col++) if (!mass[at(col)]) result[at(col)] = 1;
  }
  return result;
}

export function evaluateConnection(a: Uint8Array, b: Uint8Array, n = GRID) {
  const va = supportedVoid(a, n), vb = supportedVoid(b, n);
  const seen = new Uint8Array(n * n);
  let totalA = 0, totalB = 0, overlapMass = 0, areaA = 0, areaB = 0;
  for (let i = 0; i < a.length; i++) {
    totalA += va[i]; totalB += vb[i]; areaA += a[i]; areaB += b[i];
    overlapMass += a[i] && b[i] ? 1 : 0;
  }
  let best: { cells: number[]; coverage: number; shared: number } | null = null;
  const open = (i: number) => {
    const x = i % n, y = Math.floor(i / n);
    if (!x || !y || x === n - 1 || y === n - 1 || !(va[i] || vb[i])) return false;
    // Clearance at every point on the route, not just at the overlap patch.
    return [i, i - 1, i + 1, i - n, i + n].every(j => !a[j] && !b[j]);
  };
  for (let start = 0; start < a.length; start++) {
    if (seen[start] || !open(start)) continue;
    const cells = [start]; seen[start] = 1;
    let ca = 0, cb = 0, shared = 0, wideShared = false;
    for (let head = 0; head < cells.length; head++) {
      const i = cells[head], x = i % n, y = Math.floor(i / n);
      ca += va[i]; cb += vb[i];
      if (va[i] && vb[i]) {
        shared++;
        if (x < n - 1 && y < n - 1 && [i + 1, i + n, i + n + 1].every(j => open(j) && va[j] && vb[j])) wideShared = true;
      }
      for (const j of [x > 0 ? i - 1 : -1, x < n - 1 ? i + 1 : -1, y > 0 ? i - n : -1, y < n - 1 ? i + n : -1]) {
        if (j >= 0 && !seen[j] && open(j)) { seen[j] = 1; cells.push(j); }
      }
    }
    const coverage = Math.min(ca / Math.max(1, totalA), cb / Math.max(1, totalB));
    if (wideShared && shared >= 8 && coverage >= 0.35 && (!best || coverage > best.coverage)) best = { cells, coverage, shared };
  }
  // Reject near-total superposition; it does not meaningfully extend the section.
  if (overlapMass / Math.max(1, Math.min(areaA, areaB)) > 0.65) return null;
  return best;
}

export function poseTransform(p: Pose) {
  return `translate(${p.x} ${p.y}) rotate(${p.angle}) scale(${p.mirror ? -p.scale : p.scale} ${p.scale}) translate(-50 -50)`;
}

export function evaluateAssembly(masks: Uint8Array[], n = GRID) {
  const voids = masks.map(m => supportedVoid(m, n));
  const mass = Uint8Array.from({ length: n * n }, (_, i) => masks.some(m => m[i]) ? 1 : 0);
  const open = Uint8Array.from(mass, (v, i) => !v && voids.some(m => m[i]) ? 1 : 0);
  const totals = voids.map(v => v.reduce((a, b) => a + b, 0));
  const seen = new Uint8Array(n * n);
  const neighbors = (i: number) => [i % n ? i - 1 : -1, i % n < n - 1 ? i + 1 : -1, i >= n ? i - n : -1, i < n * (n - 1) ? i + n : -1].filter(j => j >= 0);
  let best: { cells: number[]; coverage: number } | null = null;
  for (let start = 0; start < open.length; start++) {
    if (!open[start] || seen[start]) continue;
    const cells = [start]; seen[start] = 1;
    const counts = masks.map(() => 0);
    for (let head = 0; head < cells.length; head++) {
      const i = cells[head]; voids.forEach((v, k) => counts[k] += v[i]);
      for (const j of neighbors(i)) if (open[j] && !seen[j]) { seen[j] = 1; cells.push(j); }
    }
    const coverage = Math.min(...counts.map((c, k) => c / Math.max(1, totals[k])));
    if (coverage >= 0.35 && (!best || coverage > best.coverage)) best = { cells, coverage };
  }
  if (!best) return null;
  // Distance from mass estimates local width without deleting narrow passages.
  const distance = new Int16Array(n * n).fill(n * 2), queue: number[] = [];
  mass.forEach((v, i) => { if (v) { distance[i] = 0; queue.push(i); } });
  for (let h = 0; h < queue.length; h++) for (const j of neighbors(queue[h])) {
    if (distance[j] > distance[queue[h]] + 1) { distance[j] = distance[queue[h]] + 1; queue.push(j); }
  }
  const widths = best.cells.map(i => distance[i]).sort((a,b) => a-b);
  const upper = widths[Math.floor(widths.length * 0.7)] || 1;
  const lower = Math.max(1, Math.floor(upper * 0.4));
  const primary: number[] = [], secondary: number[] = [], transition: number[] = [];
  for (const i of best.cells) (distance[i] <= lower ? transition : distance[i] >= upper ? primary : secondary).push(i);
  const clarity = best.cells.length / Math.max(1, open.reduce((a,b) => a+b,0));
  const hierarchy = (widths[Math.floor(widths.length * 0.9)] - widths[Math.floor(widths.length * 0.1)]) / Math.max(1, widths[Math.floor(widths.length * 0.9)]);
  // A one-cell passage is retained, but its geometric continuity needs review.
  const uncertain = best.cells.some(i => distance[i] === 1 && neighbors(i).filter(j => open[j]).length <= 2);
  const horizontalLevels: { y: number; x1: number; x2: number }[] = [];
  for (let y = 2; y < n - 2; y++) {
    let start = -1, longest = 0;
    for (let x = 0; x <= n; x++) {
      const solid = x < n && mass[y*n+x] && mass[(y-1)*n+x];
      if (solid && start < 0) start = x;
      if ((!solid || x === n) && start >= 0) {
        if (x-start > longest) { longest=x-start; horizontalLevels.push({ y, x1:start, x2:x }); }
        start=-1;
      }
    }
  }
  const candidates = horizontalLevels.filter(level => level.x2-level.x1 >= n*.16 &&
    best.cells.some(i => Math.floor(i/n) >= level.y-5 && Math.floor(i/n) <= level.y+5 && i%n >= level.x1 && i%n <= level.x2));
  const filteredLevels: typeof candidates = [];
  for (const level of candidates) {
    const previous = filteredLevels.at(-1);
    if (previous && level.y - previous.y <= 6 && level.x1 <= previous.x2 + 3 && level.x2 >= previous.x1 - 3) {
      previous.y = Math.round((previous.y + level.y) / 2);
      previous.x1 = Math.round((previous.x1 + level.x1) / 2);
      previous.x2 = Math.round((previous.x2 + level.x2) / 2);
    } else filteredLevels.push({ ...level });
  }
  return { ...best, primary, secondary, transition, horizontalLevels: filteredLevels, clarity, hierarchy, uncertain, score: clarity * 0.55 + hierarchy * 0.45 };
}
