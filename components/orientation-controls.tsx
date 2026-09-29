"use client";

import { FlipHorizontal2, FlipVertical2, RefreshCcw, RotateCcw, RotateCw } from "lucide-react";
import { changeOrientation, orientationFor, orientationName, type OrientableStudy, type OrientationAction, type StudyOrientation } from "../lib/study-orientation";

export function OrientationControls({ study, onChange, disabled = false }: {
  study: OrientableStudy;
  onChange: (orientation: StudyOrientation) => void;
  disabled?: boolean;
}) {
  const actions: { action: OrientationAction; label: string; icon: typeof RotateCw }[] = [
    { action: "rotate-left", label: "Rotate section 90° counterclockwise", icon: RotateCcw },
    { action: "rotate-right", label: "Rotate section 90° clockwise", icon: RotateCw },
    { action: "flip-horizontal", label: "Flip whole section horizontally", icon: FlipVertical2 },
    { action: "flip-vertical", label: "Flip whole section vertically", icon: FlipHorizontal2 },
    { action: "reset", label: "Reset section orientation", icon: RefreshCcw },
  ];
  const original = orientationFor(study).join(",") === "1,0,0,1";

  return <div className="study-orientation">
    <div><span className="joint-kicker">WHOLE SECTION ORIENTATION</span><span>{orientationName(study)}</span></div>
    <div className="study-orientation-tools" role="group" aria-label="Whole section orientation">
      {actions.map(({ action, label, icon: Icon }) => <button key={action} type="button" aria-label={label} title={label} disabled={disabled || (action === "reset" && original)} onClick={() => onChange(changeOrientation(study, action))}><Icon size={17}/></button>)}
    </div>
  </div>;
}
