"use client";

import { useEffect, useRef } from "react";

export type Correction = {
  width: number;
  height: number;
  shapes: { d: string }[];
  draft: number[][];
  draftMode: "add" | "subtract";
};

export function CorrectionEditor({
  tile,
  proposal,
  onChange,
}: {
  tile: { id: number; name: string; src: string; correction?: Correction };
  proposal?: Correction;
  onChange: (patch: {
    correction: Correction;
    approved: boolean;
    status: "corrected";
  }) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ tile, proposal, onChange });
  useEffect(() => {
    latest.current = { tile, proposal, onChange };
  }, [tile, proposal, onChange]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow
      )
        return;
      const current = latest.current;
      if (event.data?.type === "correction-ready") {
        frame.current?.contentWindow?.postMessage(
          {
            type: "correction-init",
            tile: {
              id: current.tile.id,
              name: current.tile.name,
              src: current.tile.src,
            },
            proposal: current.proposal,
            correction: current.tile.correction,
          },
          location.origin,
        );
      }
      if (
        event.data?.type === "correction-change" &&
        event.data.tileId === current.tile.id
      ) {
        const c = event.data.correction as Correction;
        if (
          !c ||
          !Number.isFinite(c.width) ||
          !Number.isFinite(c.height) ||
          c.width <= 0 ||
          c.height <= 0 ||
          !Array.isArray(c.shapes) ||
          !c.shapes.every((s) => typeof s.d === "string") ||
          !Array.isArray(c.draft) ||
          !c.draft.every(
            (p) =>
              Array.isArray(p) && p.length === 2 && p.every(Number.isFinite),
          ) ||
          !["add", "subtract"].includes(c.draftMode)
        )
          return;
        current.onChange({
          correction: c,
          approved: false,
          status: "corrected",
        });
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  if (!proposal) return <div role="status">Loading tile proposal...</div>;
  return (
    <iframe
      ref={frame}
      className="correction-frame"
      title={`Correction editor for ${tile.name}`}
      src="/correction-editor/index.html?embedded=1"
      onLoad={() =>
        frame.current?.contentWindow?.postMessage(
          {
            type: "correction-init",
            tile: { id: tile.id, name: tile.name, src: tile.src },
            proposal,
            correction: tile.correction,
          },
          location.origin,
        )
      }
    />
  );
}

export function CorrectionGeometry({
  correction,
  fill = "white",
}: {
  correction: Correction;
  fill?: string;
}) {
  const scale = 100 / Math.max(correction.width, correction.height);
  return (
    <g
      transform={`translate(${(100 - correction.width * scale) / 2} ${(100 - correction.height * scale) / 2}) scale(${scale})`}
    >
      {correction.shapes.map((shape, i) => (
        <path key={i} d={shape.d} fill={fill} fillRule="evenodd" />
      ))}
    </g>
  );
}
