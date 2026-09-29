export function createGeometry(paper) {
  const paths = (p) => p.children || [p];
  function make(d) {
    const p = new paper.CompoundPath({ pathData: d, insert: false });
    p.fillRule = "evenodd";
    p.reorient(false, true);
    return p;
  }
  // Keep each outer contour with its holes; nested islands remain separate objects.
  function split(item) {
    const all = paths(item);
    const outer = all.filter((p) => p.clockwise);
    const buckets = outer.map((p) => [p]);
    for (const hole of all.filter((p) => !p.clockwise)) {
      const candidates = outer
        .map((p, i) => ({ p, i }))
        .filter(
          ({ p }) =>
            p.bounds.contains(hole.bounds) && p.contains(hole.interiorPoint),
        )
        .sort((a, b) => Math.abs(a.p.area) - Math.abs(b.p.area));
      if (candidates.length) buckets[candidates[0].i].push(hole);
    }
    return buckets.map((parts) => ({
      d: parts.map((p) => p.pathData).join(" "),
    }));
  }
  return { make, paths, split };
}
