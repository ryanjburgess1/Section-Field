"use client";

import { useRef, useState } from "react";
import { Check, Play, Save } from "lucide-react";
import type { Correction } from "./correction-editor";
import { JointImage } from "./joint-review";
import { OrientationControls } from "./orientation-controls";
import { GRID, evaluateJoint, massBounds, type Pose } from "../lib/connection-study";
import { tileMask } from "../lib/tile-mask";
import { jointTags, type JointStudy } from "../lib/joint-studies";
import { orientationFor, orientationName } from "../lib/study-orientation";

type Tile = { id: number; correction: Correction };
type SaveResult = "site" | "local" | "failed";

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return (result >>> 0).toString(16);
}

function randomFor(seed: string) {
  let state = 2166136261;
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  return () => {
    state = Math.imul(1664525, state) + 1013904223 | 0;
    return (state >>> 0) / 4294967296;
  };
}

export function TwoTileSearch({ tiles, studies, onChange, onConfirm }: {
  tiles: Tile[];
  studies: JointStudy[];
  onChange: (studies: JointStudy[]) => void;
  onConfirm: (studies: JointStudy[]) => Promise<SaveResult>;
}) {
  const [seed, setSeed] = useState("joint-02");
  const [poolIds, setPoolIds] = useState<number[] | null>(null);
  const [activeBatchId, setActiveBatchId] = useState(() => studies.findLast(study => study.origin === "search")?.batchId ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const inspectorRef = useRef<HTMLDivElement>(null);
  const pool = tiles.filter(tile => poolIds === null || poolIds.includes(tile.id));
  const batches = [...new Map(studies.filter(study => study.origin === "search" && study.batchId)
    .map(study => [study.batchId!, study])).values()].reverse();
  const batchId = batches.some(study => study.batchId === activeBatchId) ? activeBatchId : batches[0]?.batchId ?? "";
  const visible = studies.filter(study => study.origin === "search" && study.batchId === batchId);
  const selected = visible.find(study => study.id === selectedId) ?? visible[0];
  const rated = visible.filter(study => study.rating);
  const pending = rated.filter(study => !study.confirmedAt);

  function toggleTile(id: number) {
    const selected = new Set(poolIds ?? tiles.map(tile => tile.id));
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    setPoolIds([...selected]);
  }

  async function generate() {
    if (pool.length < 2) return;
    setBusy(true);
    setProgress("");
    setSaveMessage("");
    const ids = pool.map(tile => tile.id).sort((a, b) => a - b);
    const nextBatchId = `joint-search-${hash(`${seed}:${ids.join(",")}`)}`;
    try {
      const found: { tileIds: [number, number]; poses: [Pose, Pose]; score: number }[] = [];
      const pairCount = pool.length * (pool.length - 1) / 2;
      let pairNumber = 0;
      for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
        const pair = [pool[i], pool[j]];
        let best: (typeof found)[number] | null = null;
        for (const [firstTile, secondTile] of [pair, [...pair].reverse()]) {
          const random = randomFor(`${seed}:${firstTile.id}:${secondTile.id}`);
          for (let attempt = 0; attempt < 18; attempt++) {
            const first: Pose = {
              x: 28, y: 50, angle: [0, 90, 180, 270][Math.floor(random() * 4)],
              scale: .39 + random() * .06, mirror: random() > .5,
            };
            const firstMask = tileMask(firstTile, first);
            const firstBounds = massBounds(firstMask);
            const second: Pose = {
              x: 50, y: 50 + (random() - .5) * 28,
              angle: [0, 90, 180, 270][Math.floor(random() * 4)],
              scale: .34 + random() * .12, mirror: random() > .5,
            };
            const preliminary = massBounds(tileMask(secondTile, second));
            second.x += (firstBounds.maxX - preliminary.minX - 4 - random() * 11) * 100 / GRID;
            const analysis = evaluateJoint(firstMask, tileMask(secondTile, second));
            if (!analysis) continue;
            const score = analysis.score + .08 * analysis.platformScore + .08 * analysis.hierarchy;
            if (!best || score > best.score) best = {
              tileIds: [firstTile.id, secondTile.id], poses: [first, second], score,
            };
          }
        }
        if (best) found.push(best);
        pairNumber++;
        setProgress(`Testing pair ${pairNumber}/${pairCount}`);
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }

      const chosen: typeof found = [];
      const usage = new Map<number, number>();
      const remaining = [...found];
      while (remaining.length && chosen.length < 16) {
        remaining.sort((a, b) => {
          const adjusted = (item: typeof a) => item.score - .065 * item.tileIds.reduce((sum, id) => sum + (usage.get(id) ?? 0), 0);
          return adjusted(b) - adjusted(a);
        });
        const index = remaining.findIndex(item => item.tileIds.every(id => (usage.get(id) ?? 0) < 4));
        if (index < 0) break;
        const [item] = remaining.splice(index, 1);
        chosen.push(item);
        item.tileIds.forEach(id => usage.set(id, (usage.get(id) ?? 0) + 1));
      }
      const generated: JointStudy[] = chosen.map((item, index) => ({
        id: `${nextBatchId}-${[...item.tileIds].sort((a, b) => a - b).join("-")}`,
        label: `Pair ${String(index + 1).padStart(2, "0")}`,
        sourceSeed: seed,
        sourceNumber: index + 1,
        tileIds: item.tileIds,
        poses: item.poses,
        flipY: false,
        rating: null,
        tags: [],
        note: "",
        geometryPass: true,
        origin: "search",
        batchId: nextBatchId,
        poolTileIds: ids,
      }));
      const existing = new Set(studies.map(study => study.id));
      const additions = generated.filter(study => !existing.has(study.id));
      if (additions.length) onChange([...studies, ...additions]);
      setActiveBatchId(nextBatchId);
      setSelectedId(additions[0]?.id ?? generated[0]?.id ?? null);
      setProgress(generated.length ? `${generated.length} distinct pairs saved for review` : "No pairs passed. Try another seed or tile pool.");
    } catch {
      setProgress("Search failed. Existing reviews were not changed.");
    } finally {
      setBusy(false);
    }
  }

  function updateStudy(patch: Partial<JointStudy>) {
    if (!selected) return;
    setSaveMessage("");
    onChange(studies.map(study => study.id === selected.id ? { ...study, ...patch, confirmedAt: undefined } : study));
  }

  function inspectStudy(id: string) {
    setSelectedId(id);
    requestAnimationFrame(() => inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function confirmReviews() {
    if (!pending.length) return;
    setConfirming(true);
    setSaveMessage("Saving confirmed reviews…");
    const now = Date.now();
    const pendingIds = new Set(pending.map(study => study.id));
    const next = studies.map(study => pendingIds.has(study.id) ? { ...study, confirmedAt: now } : study);
    try {
      const result = await onConfirm(next);
      setSaveMessage(result === "site"
        ? `${pending.length} reviews confirmed and saved to the site`
        : result === "local"
          ? `${pending.length} reviews confirmed locally · site sync pending`
          : "Save failed. Keep this page open and try again.");
    } catch {
      setSaveMessage("Save failed. Keep this page open and try again.");
    } finally {
      setConfirming(false);
    }
  }

  return <div className="joint-review two-tile-search">
    <div className="joint-review-heading"><div><span className="joint-kicker">TWO-TILE SEARCH</span><h2>New connection studies</h2></div><span>{tiles.length} approved vectors available</span></div>
    <div className="connection-controls">
      <label>Seed <input value={seed} disabled={busy} onChange={event => setSeed(event.target.value)}/></label>
      <button disabled={busy || confirming || pool.length < 2} onClick={generate}><Play size={16}/>{busy ? "Searching" : "Generate pairs"}</button>
      <span role="status">{progress}</span>
    </div>
    <details className="joint-pool"><summary>Tile pool · {pool.length} selected</summary>
      <div className="joint-pool-controls"><button onClick={() => setPoolIds(null)}>Select all approved</button></div>
      <div className="joint-pool-grid">{tiles.map(tile => <label key={tile.id}><input type="checkbox" checked={poolIds === null || poolIds.includes(tile.id)} disabled={busy} onChange={() => toggleTile(tile.id)}/>Tile {String(tile.id).padStart(2, "0")}</label>)}</div>
    </details>
    {batches.length > 0 && <div className="joint-batch-select"><label>Saved batch <select value={batchId} onChange={event => { setActiveBatchId(event.target.value); setSelectedId(null); setSaveMessage(""); }}>
      {batches.map(batch => <option key={batch.batchId} value={batch.batchId}>{batch.sourceSeed} · {batch.poolTileIds?.length ?? "?"} vectors · {studies.filter(study => study.batchId === batch.batchId).length} pairs</option>)}
    </select></label></div>}
    <div className="joint-variation-heading"><div><span className="joint-kicker">SAVED STUDIES</span><h2>{visible.length} arrangements</h2></div>
      <div className="extension-confirm"><span>{rated.length} rated · {rated.length - pending.length} confirmed</span><button disabled={busy || confirming || !pending.length} onClick={confirmReviews}><Save size={15}/>{confirming ? "Saving…" : `Save & confirm reviews${pending.length ? ` (${pending.length})` : ""}`}</button></div>
    </div>
    {saveMessage && <p className="extension-confirm-status" role="status">{saveMessage}</p>}
    {visible.length ? <div className="joint-grid variation-grid">{visible.map(study => <button key={study.id} className={`joint-card ${selected?.id === study.id ? "selected" : ""}`} onClick={() => inspectStudy(study.id)} aria-label={`Inspect ${study.label}`}>
      <JointImage study={study} tiles={tiles}/>
      <span className="joint-card-caption"><strong>{study.label}</strong><span className={`joint-rating ${study.rating ?? "unrated"}`}>{study.rating ?? "Unrated"}</span></span>
      <span className="joint-card-meta">Tiles {study.tileIds.join(" + ")} · {orientationName(study)}{study.confirmedAt ? " · Confirmed" : study.rating ? " · Awaiting confirmation" : ""}</span>
    </button>)}</div> : <p className="joint-empty">Generate a batch to compare two-tile connections.</p>}
    {selected && <div className="joint-inspector" ref={inspectorRef}><div className="joint-large"><JointImage study={selected} tiles={tiles}/></div>
      <div className="joint-inspector-content"><span className="joint-kicker">SELECTED PAIR</span><h2>{selected.label}</h2>
        <p>Tiles {selected.tileIds.join(" + ")} · seed {selected.sourceSeed}</p>
        <OrientationControls study={selected} disabled={confirming} onChange={orientation => updateStudy({ orientation })}/>
        <div className="joint-rating-controls" role="group" aria-label="Rate selected pair">{(["strong", "promising", "weak"] as const).map(rating => <button key={rating} disabled={confirming} className={selected.rating === rating ? "active" : ""} onClick={() => updateStudy({ rating: selected.rating === rating ? null : rating })}>{selected.rating === rating && <Check size={14}/>} {rating}</button>)}</div>
        <div className="joint-tag-controls">{jointTags.map(tag => <button key={tag} disabled={confirming} className={selected.tags.includes(tag) ? "active" : ""} onClick={() => updateStudy({ tags: selected.tags.includes(tag) ? selected.tags.filter(item => item !== tag) : [...selected.tags, tag] })}>{tag}</button>)}</div>
        <label className="joint-note-label">Review notes<textarea value={selected.note} disabled={confirming} onChange={event => updateStudy({ note: event.target.value })} rows={3}/></label>
        <div className="joint-recipe"><p>Whole section · {orientationName(selected)} · matrix [{orientationFor(selected).join(", ")}]</p>{selected.poses.map((pose, index) => <p key={index}>Tile {selected.tileIds[index]} · X {pose.x.toFixed(2)} · Y {pose.y.toFixed(2)} · {pose.angle.toFixed(0)}° · {Math.round(pose.scale * 100)}% · {pose.mirror ? "mirrored" : "unmirrored"}</p>)}</div>
      </div>
    </div>}
  </div>;
}
