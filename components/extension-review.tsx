"use client";

import { useRef, useState } from "react";
import { GitBranchPlus, Check, Save } from "lucide-react";
import type { Correction } from "./correction-editor";
import { JointImage } from "./joint-review";
import { OrientationControls } from "./orientation-controls";
import { GRID, evaluateJoint, massBounds, type Pose } from "../lib/connection-study";
import { tileMask } from "../lib/tile-mask";
import { jointTags, type JointStudy } from "../lib/joint-studies";
import type { ExtensionStudy } from "../lib/extension-studies";
import { orientationFor, orientationName } from "../lib/study-orientation";

type Tile = { id: number; correction: Correction };

function randomFor(seed: string) {
  let state = 2166136261;
  for (const ch of seed) state = Math.imul(state ^ ch.charCodeAt(0), 16777619);
  return () => { state = Math.imul(1664525, state) + 1013904223 | 0; return (state >>> 0) / 4294967296; };
}
function seedId(seed: string) {
  let value = 2166136261;
  for (const ch of seed) value = Math.imul(value ^ ch.charCodeAt(0), 16777619);
  return (value >>> 0).toString(16);
}

export function ExtensionReview({ tiles, joints, studies, onChange, onConfirm }: {
  tiles: Tile[];
  joints: JointStudy[];
  studies: ExtensionStudy[];
  onChange: (studies: ExtensionStudy[]) => void;
  onConfirm: (studies: ExtensionStudy[]) => Promise<"site" | "local" | "failed">;
}) {
  const eligible = joints.filter(joint =>
    (joint.rating === "strong" || joint.rating === "promising") &&
    (joint.origin !== "search" || joint.confirmedAt) &&
    joint.tileIds.every(id => tiles.some(tile => tile.id === id)));
  const [anchorId, setAnchorId] = useState(eligible[0]?.id ?? "");
  const [seed, setSeed] = useState("extension-01");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const inspectorRef = useRef<HTMLDivElement>(null);
  const anchor = eligible.find(joint => joint.id === anchorId) ?? eligible[0];
  const visible = studies.filter(study => study.sourceJointId === anchor?.id);
  const selected = visible.find(study => study.id === selectedId) ?? visible[0];
  const rated = visible.filter(study => study.rating);
  const pending = rated.filter(study => !study.confirmedAt);

  async function generate() {
    if (!anchor) return;
    setBusy(true); setMessage("");
    try {
      const pair = anchor.tileIds.map(id => tiles.find(tile => tile.id === id));
      if (!pair[0] || !pair[1]) throw Error("Source vectors unavailable");
      const found: { study: ExtensionStudy; score: number }[] = [];
      for (const direction of ["right", "left"] as const) {
        const originalMasks = anchor.poses.map((pose, index) => tileMask(pair[index]!, pose));
        const originalUnion = Uint8Array.from({ length: GRID * GRID }, (_, i) => originalMasks[0][i] || originalMasks[1][i] ? 1 : 0);
        const originalBounds = massBounds(originalUnion);
        const shiftPixels = direction === "right" ? 4 - originalBounds.minX : GRID - 5 - originalBounds.maxX;
        const poses = anchor.poses.map(pose => ({ ...pose, x: pose.x + shiftPixels * 100 / GRID })) as [Pose, Pose];
        const baseMasks = poses.map((pose, index) => tileMask(pair[index]!, pose));
        const baseJoint = evaluateJoint(baseMasks[0], baseMasks[1]);
        if (!baseJoint) continue;
        const baseVoid = new Set(baseJoint.cells);
        const baseMass = Uint8Array.from({ length: GRID * GRID }, (_, i) => baseMasks[0][i] || baseMasks[1][i] ? 1 : 0);
        const bounds = massBounds(baseMass);
        for (const tile of tiles.filter(item => !anchor.tileIds.includes(item.id))) {
          const random = randomFor(`${seed}:${anchor.id}:${tile.id}:${direction}`);
          let best: { study: ExtensionStudy; score: number } | null = null;
          for (let attempt = 0; attempt < 60; attempt++) {
            const pose: Pose = {
              x: 50,
              y: 50 + (random() - .5) * 24,
              angle: [0, 90, 180, 270][Math.floor(random() * 4)],
              scale: .29 + random() * .1,
              mirror: random() > .5,
            };
            const preliminary = massBounds(tileMask(tile, pose));
            const overlapPixels = 3 + random() * 11;
            const shift = direction === "right"
              ? bounds.maxX - preliminary.minX - overlapPixels
              : bounds.minX - preliminary.maxX + overlapPixels;
            pose.x += shift * 100 / GRID;
            const third = tileMask(tile, pose);
            const joined = direction === "right" ? evaluateJoint(baseMass, third) : evaluateJoint(third, baseMass);
            if (!joined) continue;
            const shared = joined.cells.filter(i => baseVoid.has(i)).length;
            const preserved = shared / Math.max(1, baseVoid.size);
            const added = joined.cells.length - shared;
            const spanGain = joined.span - baseJoint.span;
            if (preserved < .55 || added < 28 || spanGain < .035) continue;
            const score = joined.score * .55 + preserved * .3 + Math.min(1, spanGain / .2) * .15;
            const study: ExtensionStudy = {
              id: `extension-${anchor.id}-${seedId(seed)}-${tile.id}-${direction}`,
              sourceJointId: anchor.id,
              seed,
              tileIds: [...anchor.tileIds, tile.id],
              poses: [...poses, pose],
              flipY: anchor.flipY,
              orientation: anchor.orientation,
              direction,
              rating: null,
              tags: [],
              note: "",
            };
            if (!best || score > best.score) best = { study, score };
          }
          if (best) found.push(best);
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
      found.sort((a, b) => b.score - a.score);
      const existing = new Set(studies.map(study => study.id));
      const additions = found.map(item => item.study).filter(study => !existing.has(study.id));
      if (additions.length) onChange([...studies, ...additions]);
      setSelectedId(additions[0]?.id ?? found[0]?.study.id ?? null);
      setMessage(found.length ? `${found.length} three-tile studies` : "No extensions preserved the source joint. Try another seed.");
    } catch {
      setMessage("Extension search failed. Saved studies remain available.");
    } finally {
      setBusy(false);
    }
  }

  function updateStudy(patch: Partial<ExtensionStudy>) {
    if (!selected) return;
    setConfirmationMessage("");
    onChange(studies.map(study => study.id === selected.id ? { ...study, ...patch, confirmedAt: undefined } : study));
  }

  async function confirmReviews() {
    if (!pending.length) return;
    setConfirming(true);
    setConfirmationMessage("Saving confirmed reviews…");
    const now = Date.now();
    const pendingIds = new Set(pending.map(study => study.id));
    const next = studies.map(study => pendingIds.has(study.id) ? { ...study, confirmedAt: now } : study);
    try {
      const saved = await onConfirm(next);
      setConfirmationMessage(saved === "site"
        ? `${pending.length} reviews confirmed and saved to the site`
        : saved === "local"
          ? `${pending.length} reviews confirmed locally · site sync pending`
          : "Save failed. Keep this page open and try again.");
    } catch {
      setConfirmationMessage("Save failed. Keep this page open and try again.");
    } finally {
      setConfirming(false);
    }
  }

  return <div className="joint-review extension-review">
    <div className="joint-review-heading"><div><span className="joint-kicker">THREE-TILE EXTENSION</span><h2>Build from a reviewed joint</h2></div></div>
    <div className="connection-controls">
      <label>Source joint <select value={anchor?.id ?? ""} onChange={event => { setAnchorId(event.target.value); setSelectedId(null); setConfirmationMessage(""); }}>{eligible.map(joint => <option key={joint.id} value={joint.id}>{joint.label} · {joint.rating}</option>)}</select></label>
      <label>Seed <input value={seed} disabled={busy} onChange={event => setSeed(event.target.value)}/></label>
      <button disabled={busy || confirming || !anchor || tiles.length < 3} onClick={generate}><GitBranchPlus size={16}/>{busy ? "Building" : "Generate extensions"}</button>
      <span>{tiles.length} approved vectors available</span>
      <span role="status">{busy ? "Testing third-tile connections…" : message}</span>
    </div>
    {anchor && <div className="extension-source"><span className="joint-kicker">SOURCE JOINT</span><JointImage study={anchor} tiles={tiles}/><strong>{anchor.label} · tiles {anchor.tileIds.join(" + ")}</strong></div>}
    <div className="joint-variation-heading"><div><span className="joint-kicker">GENERATED STUDIES</span><h2>{visible.length} arrangements</h2></div><div className="extension-confirm"><span>{rated.length} rated · {rated.length - pending.length} confirmed</span><button disabled={busy || confirming || !pending.length} onClick={confirmReviews}><Save size={15}/>{confirming ? "Saving…" : `Save & confirm reviews${pending.length ? ` (${pending.length})` : ""}`}</button></div></div>
    {confirmationMessage && <p className="extension-confirm-status" role="status">{confirmationMessage}</p>}
    {visible.length ? <div className="joint-grid variation-grid">{visible.map(study =>
      <button key={study.id} className={`joint-card ${selected?.id === study.id ? "selected" : ""}`} onClick={() => { setSelectedId(study.id); requestAnimationFrame(() => inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} aria-label={`Inspect extension with tile ${study.tileIds[2]}`}>
        <JointImage study={{ ...study, label: `Tile ${study.tileIds[2]} extension` }} tiles={tiles}/>
        <span className="joint-card-caption"><strong>Tile {String(study.tileIds[2]).padStart(2, "0")} · {study.direction}</strong><span className={`joint-rating ${study.rating ?? "unrated"}`}>{study.rating ?? "Unrated"}</span></span>
        <span className="joint-card-meta">Tiles {study.tileIds.join(" + ")} · {orientationName(study)} · seed {study.seed}{study.confirmedAt ? " · Confirmed" : study.rating ? " · Awaiting confirmation" : ""}</span>
      </button>
    )}</div> : <p className="joint-empty">No three-tile studies saved for this source joint.</p>}
    {selected && <div className="joint-inspector" ref={inspectorRef}>
      <div className="extension-comparison">
        <div><span className="joint-kicker">SOURCE</span><JointImage study={anchor} tiles={tiles}/></div>
        <div><span className="joint-kicker">EXTENDED SECTION</span><JointImage study={{ ...selected, label: "Three-tile extension" }} tiles={tiles}/></div>
      </div>
      <div className="joint-inspector-content">
        <span className="joint-kicker">SELECTED STUDY</span><h2>Tile {String(selected.tileIds[2]).padStart(2, "0")} · {selected.direction}</h2>
        <p>Source {anchor.label} · seed {selected.seed} · tiles {selected.tileIds.join(" + ")}</p>
        <OrientationControls study={selected} disabled={confirming} onChange={orientation => updateStudy({ orientation })}/>
        <div className="joint-rating-controls" role="group" aria-label="Rate selected extension">{(["strong", "promising", "weak"] as const).map(rating =>
          <button key={rating} disabled={confirming} className={selected.rating === rating ? "active" : ""} onClick={() => updateStudy({ rating: selected.rating === rating ? null : rating })}>{selected.rating === rating && <Check size={14}/>} {rating}</button>
        )}</div>
        <div className="joint-tag-controls">{jointTags.map(tag =>
          <button key={tag} disabled={confirming} className={selected.tags.includes(tag) ? "active" : ""} onClick={() => updateStudy({ tags: selected.tags.includes(tag) ? selected.tags.filter(item => item !== tag) : [...selected.tags, tag] })}>{tag}</button>
        )}</div>
        <label className="joint-note-label">Review notes<textarea value={selected.note} disabled={confirming} onChange={event => updateStudy({ note: event.target.value })} rows={3}/></label>
        <div className="joint-recipe"><p>Whole section · {orientationName(selected)} · matrix [{orientationFor(selected).join(", ")}]</p>{selected.poses.map((pose, index) => <p key={index}>Tile {selected.tileIds[index]} · X {pose.x.toFixed(2)} · Y {pose.y.toFixed(2)} · {pose.angle.toFixed(0)}° · {Math.round(pose.scale * 100)}% · {pose.mirror ? "mirrored" : "unmirrored"}</p>)}</div>
      </div>
    </div>}
  </div>;
}
