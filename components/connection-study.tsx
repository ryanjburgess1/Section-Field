"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Correction } from "./correction-editor";
import { evaluateJoint } from "../lib/connection-study";
import { tileMask } from "../lib/tile-mask";
import { JointReview } from "./joint-review";
import { TwoTileSearch } from "./two-tile-search";
import { ExtensionReview } from "./extension-review";
import type { JointStudy } from "../lib/joint-studies";
import type { ExtensionStudy } from "../lib/extension-studies";

type Tile = { id: number; correction: Correction };
type SaveResult = "site" | "local" | "failed";

export function ConnectionStudy({ tiles, studies, onStudiesChange, onConfirmJoints, extensions, onExtensionsChange, onConfirmExtensions, onClose }: {
  tiles: Tile[];
  studies: JointStudy[];
  onStudiesChange: (studies: JointStudy[]) => void;
  onConfirmJoints: (studies: JointStudy[]) => Promise<SaveResult>;
  extensions: ExtensionStudy[];
  onExtensionsChange: (studies: ExtensionStudy[]) => void;
  onConfirmExtensions: (studies: ExtensionStudy[]) => Promise<SaveResult>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"review" | "extend" | "search">("search");

  function validJoint(study: JointStudy) {
    const pair = study.tileIds.map(id => tiles.find(tile => tile.id === id));
    if (!pair[0] || !pair[1]) return false;
    return Boolean(evaluateJoint(tileMask(pair[0], study.poses[0]), tileMask(pair[1], study.poses[1])));
  }

  return <div className="connection-study" role="dialog" aria-modal="true" aria-label="Connection study">
    <header><div className="study-title"><img src="/fausoa-logo.png" alt="FAU School of Architecture"/><strong>CONNECTION STUDY</strong></div><button title="Close connection study" aria-label="Close connection study" onClick={onClose}><X size={20}/></button></header>
    <div className="connection-view-switch" role="tablist" aria-label="Connection study view">
      <button role="tab" aria-selected={mode === "search"} className={mode === "search" ? "active" : ""} onClick={() => setMode("search")}>Two-tile search</button>
      <button role="tab" aria-selected={mode === "review"} className={mode === "review" ? "active" : ""} onClick={() => setMode("review")}>Reviewed references</button>
      <button role="tab" aria-selected={mode === "extend"} className={mode === "extend" ? "active" : ""} onClick={() => setMode("extend")}>Three-tile extension</button>
    </div>
    {mode === "search" ? <TwoTileSearch tiles={tiles} studies={studies} onChange={onStudiesChange} onConfirm={onConfirmJoints}/> :
      mode === "review" ? <JointReview tiles={tiles} studies={studies} onChange={onStudiesChange} validity={validJoint}/> :
        <ExtensionReview tiles={tiles} joints={studies} studies={extensions} onChange={onExtensionsChange} onConfirm={onConfirmExtensions}/>}
  </div>;
}
