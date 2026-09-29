"use client";

import { useRef, useState } from "react";
import { Check, GitBranchPlus } from "lucide-react";
import { CorrectionGeometry, type Correction } from "./correction-editor";
import { OrientationControls } from "./orientation-controls";
import { poseTransform, type Pose } from "../lib/connection-study";
import { jointTags, jointVariations, type JointStudy } from "../lib/joint-studies";
import { orientationFor, orientationName, orientationTransform, type StudyOrientation } from "../lib/study-orientation";

type Tile = { id: number; correction: Correction };

export function JointImage({ study, tiles }: { study: { label: string; tileIds: readonly number[]; poses: readonly Pose[]; flipY: boolean; orientation?: StudyOrientation }; tiles: Tile[] }) {
  return <svg viewBox="0 0 100 100" role="img" aria-label={`${study.label} section geometry`}>
    <g transform={orientationTransform(study)}>
      {study.tileIds.map((id, index) => {
        const tile = tiles.find(item => item.id === id);
        return tile && <g key={id} transform={poseTransform(study.poses[index])}><CorrectionGeometry correction={tile.correction}/></g>;
      })}
    </g>
  </svg>;
}

export function JointReview({
  tiles, studies, onChange, validity,
}: {
  tiles: Tile[];
  studies: JointStudy[];
  onChange: (studies: JointStudy[]) => void;
  validity: (study: JointStudy) => boolean;
}) {
  const [selectedId, setSelectedId] = useState("connection-01-study-02");
  const [anchorId, setAnchorId] = useState("connection-01-study-02");
  const inspectorRef = useRef<HTMLDivElement>(null);
  const selected = studies.find(study => study.id === selectedId) ?? studies[0];
  const references = studies.filter(study => study.origin !== "search" && (!study.parentId || study.id === "connection-01-study-15-flipped"));
  const variants = studies.filter(study => study.parentId === anchorId);
  const anchor = studies.find(study => study.id === anchorId);

  function updateStudy(patch: Partial<JointStudy>) {
    onChange(studies.map(study => study.id === selected.id ? { ...study, ...patch, confirmedAt: undefined } : study));
  }
  function explore(study: JointStudy) {
    const existing = new Set(studies.map(item => item.id));
    const additions = jointVariations(study).filter(item => !existing.has(item.id)).map(item => ({ ...item, geometryPass: validity(item) }));
    if (additions.length) onChange([...studies, ...additions]);
    setAnchorId(study.id);
    setSelectedId(additions[0]?.id ?? study.id);
  }
  function card(study: JointStudy) {
    return <button key={study.id} className={`joint-card ${selected.id === study.id ? "selected" : ""}`} onClick={() => {
      setSelectedId(study.id);
      if (study.id.includes("study-15")) setAnchorId("connection-01-study-15-flipped");
      else if (study.id.includes("study-02")) setAnchorId("connection-01-study-02");
      requestAnimationFrame(() => inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }} aria-label={`Inspect ${study.label}`}>
      <JointImage study={study} tiles={tiles}/>
      <span className="joint-card-caption"><strong>{study.label}</strong><span className={`joint-rating ${study.rating ?? "unrated"}`}>{study.rating ?? "Unrated"}</span></span>
      <span className="joint-card-meta">Tiles {study.tileIds.join(" + ")} · {orientationName(study)}{(study.geometryPass ?? validity(study)) === false ? " · Connection lost" : ""}</span>
    </button>;
  }

  return <div className="joint-review">
    <div className="joint-review-heading"><div><span className="joint-kicker">REVIEWED REFERENCES</span><h2>Two-tile joints</h2></div><span>Seed connection-01 · approved vectors</span></div>
    <div className="joint-grid reference-grid">{references.map(card)}</div>
    <div className="joint-variation-heading">
      <div><span className="joint-kicker">CONTROLLED VARIATIONS</span><h2>{anchor?.label ?? "Study 02"}</h2></div>
      <div className="joint-anchor-switch">
        {studies.filter(study => ["connection-01-study-02", "connection-01-study-15-flipped"].includes(study.id)).map(study =>
          <button key={study.id} className={anchorId === study.id ? "active" : ""} onClick={() => { setAnchorId(study.id); setSelectedId(study.id); }}>{study.label}</button>
        )}
        {anchor && <button className="joint-explore" onClick={() => explore(anchor)}><GitBranchPlus size={15}/> Generate variations</button>}
      </div>
    </div>
    {variants.length ? <div className="joint-grid variation-grid">{variants.map(card)}</div> :
      <p className="joint-empty">Generate nearby changes in overlap, elevation, angle, and scale.</p>}
    {selected && <div className="joint-inspector" ref={inspectorRef}>
      <div className="joint-large"><JointImage study={selected} tiles={tiles}/></div>
      <div className="joint-inspector-content">
        <span className="joint-kicker">SELECTED STUDY</span><h2>{selected.label}</h2>
        <p>Tiles {selected.tileIds.join(" + ")} · Seed {selected.sourceSeed} · Source study {String(selected.sourceNumber).padStart(2, "0")}</p>
        <OrientationControls study={selected} onChange={orientation => updateStudy({ orientation })}/>
        <div className="joint-rating-controls" role="group" aria-label="Rate selected joint">
          {(["strong", "promising", "weak"] as const).map(rating =>
            <button key={rating} className={selected.rating === rating ? "active" : ""} onClick={() => updateStudy({ rating: selected.rating === rating ? null : rating })}>{selected.rating === rating && <Check size={14}/>} {rating}</button>
          )}
        </div>
        <div className="joint-tag-controls">{jointTags.map(tag =>
          <button key={tag} className={selected.tags.includes(tag) ? "active" : ""} onClick={() => updateStudy({ tags: selected.tags.includes(tag) ? selected.tags.filter(item => item !== tag) : [...selected.tags, tag] })}>{tag}</button>
        )}</div>
        <label className="joint-note-label">Review notes<textarea value={selected.note} onChange={event => updateStudy({ note: event.target.value })} rows={3}/></label>
        <div className="joint-recipe"><p>Whole section · {orientationName(selected)} · matrix [{orientationFor(selected).join(", ")}]</p>{selected.poses.map((pose, index) => <p key={index}>Tile {selected.tileIds[index]} · X {pose.x.toFixed(2)} · Y {pose.y.toFixed(2)} · {pose.angle.toFixed(0)}° · {Math.round(pose.scale * 100)}% · {pose.mirror ? "mirrored" : "unmirrored"}</p>)}</div>
      </div>
    </div>}
  </div>;
}
