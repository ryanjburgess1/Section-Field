import "./editor.css";
import { createGeometry } from "./geometry.js";
import { createCleanup } from "./cleanup.js";
const paper = window.paper;
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MousePointer2,
  Scan,
  PenTool,
  Eraser,
  Hand,
  Undo2,
  Redo2,
  Trash2,
  Plus,
  Minus,
  Maximize,
  Download,
  HelpCircle,
  Check,
  X,
  RotateCcw,
} from "lucide-react";

const icon = (C) => renderToStaticMarkup(React.createElement(C));
const btn = (id, title, C) =>
  `<button id="${id}" title="${title}" aria-label="${title}">${icon(C)}</button>`;
document.querySelector("#app").innerHTML =
  `<header><strong><span class="pink">29</span> / VECTOR CORRECTION</strong><span>ISOLATED STUDY · IMG_5232</span><div>${btn("help", "Tool guide", HelpCircle)}${btn("export", "Export corrected SVG", Download)}</div></header><main><div class="toolbar" role="toolbar" aria-label="Vector tools">${btn("select", "Select / edit anchors (V)", MousePointer2)}${btn("marquee", "Marquee: select whole objects (M)", Scan)}${btn("add", "Pen: add mass (P)", PenTool)}${btn("subtract", "Pen: subtract void (D)", Minus)}${btn("erase", "Vector eraser (E)", Eraser)}${btn("pan", "Pan (H), or hold Shift", Hand)}<span class="divider"></span>${btn("undo", "Undo (Command+Z)", Undo2)}${btn("redo", "Redo (Command+Shift+Z)", Redo2)}${btn("delete", "Delete selection", Trash2)}<label class="setting" id="brush-setting" hidden>Size <input id="brush" aria-label="Eraser diameter in image units" type="range" min="2" max="100" value="24"><output id="brush-value">24</output></label><div id="draft-actions">${btn("finish", "Close path and apply", Check)}${btn("cancel", "Cancel unfinished path", X)}</div><span class="spacer"></span>${btn("out", "Zoom out around image center", Minus)}<output id="zoom">100%</output>${btn("in", "Zoom in around image center", Plus)}${btn("fit", "Fit to screen", Maximize)}</div><div class="toolbar"><label class="setting"><input id="raster" type="checkbox" checked>Raster</label><label class="setting"><input id="vector" type="checkbox" checked>Vector</label><label class="setting"><input id="anchors-toggle" type="checkbox" checked>Anchors</label><label class="setting">Opacity <input id="opacity" aria-label="Vector opacity" type="range" min="0" max="100" value="65"></label><span class="spacer"></span><span id="save" class="cyan">Loading</span>${btn("reset", "Reset draft to proposal", RotateCcw)}</div><div class="stage"><svg id="workspace" xmlns="http://www.w3.org/2000/svg" tabindex="0" aria-label="Tile 29 vector editing workspace"><g id="world"><image id="reference" href="../vector-experiment/tile-29-720-raster.png"/><g id="mass"></g><g id="selection"></g><g id="anchors"></g><g id="preview"></g></g></svg><div id="busy"></div><aside class="help" hidden><h3>Correction tools</h3><p>Select: click mass, then drag its + anchors or curve handles. Double-click an edge to add an anchor.</p><p>Marquee: drag to enclose whole objects. Shift-click toggles an individual object.</p><p>Pen: click corners; click the first point or the checkmark to close and apply. Open paths remain saved drafts.</p><p>Eraser: drag to subtract mass. One stroke = one undo.</p><p>Hold Shift to pan. Scroll / pinch to zoom at the cursor. Fit restores the view.</p><p>Command+Z / Command+Shift+Z: undo / redo. Escape cancels. Delete removes selected objects or the active anchor.</p><p>Drafts save in this browser only. Export retains white mass and transparent void.</p></aside></div><footer class="status"><span id="message">Preparing proposal</span><span id="counts"></span></footer></main>`;
const $ = (id) => document.getElementById(id),
  NS = "http://www.w3.org/2000/svg";
paper.setup(new paper.Size(800, 800));
const key = "tile29-correction-prototype-v1";
const embedded = new URLSearchParams(location.search).has("embedded");
let embeddedTile = null;
let historyDB;
function openHistory() {
  if (!historyDB)
    historyDB = new Promise((resolve, reject) => {
      const r = indexedDB.open("section-correction-history", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("tiles");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  return historyDB;
}
async function saveHistory() {
  const state = {
    snapshot: snapshot(),
    history: history.slice(-8),
    future: future.slice(-8),
  };
  try {
    const db = await openHistory();
    const tx = db.transaction("tiles", "readwrite");
    tx.objectStore("tiles").put(state, embeddedTile.id);
  } catch {}
}
async function recoverHistory() {
  try {
    const db = await openHistory();
    const state = await new Promise((resolve, reject) => {
      const r = db
        .transaction("tiles")
        .objectStore("tiles")
        .get(embeddedTile.id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    if (state?.snapshot === snapshot()) {
      history = state.history;
      future = state.future;
    }
  } catch {}
}
let shapes = [],
  selected = new Set(),
  activeAnchor = null,
  tool = "select",
  draft = [],
  draftMode = "add",
  history = [],
  future = [],
  original = [],
  width = 561,
  height = 720;
let scale = 1,
  tx = 0,
  ty = 0,
  gesture = null,
  cursor = null,
  ready = false;
const point = (x, y) => new paper.Point(x, y);
const { make, paths, split } = createGeometry(paper);
const cleanGeometry = createCleanup(paper);
let cleanupPreview = null;
const cleanupButton = document.createElement("button");
cleanupButton.textContent = "Cleanup study";
cleanupButton.title = "Preview fragment and hole cleanup";
document.querySelectorAll(".toolbar")[1].append(cleanupButton);
const cleanupPanel = document.createElement("aside");
cleanupPanel.className = "cleanup-panel";
cleanupPanel.hidden = true;
cleanupPanel.innerHTML = `<strong>SECTION-READY CLEANUP</strong>
<label>Fragment area <span class="percentage-input"><input id="fragment-area" aria-label="Fragment area percent of tile" type="number" min="0" max="1" step="any" value="0.02"><span>%</span></span></label>
<label>Hole area <span class="percentage-input"><input id="hole-area" aria-label="Hole area percent of tile" type="number" min="0" max="1" step="any" value="0.01"><span>%</span></span></label>
<label><input id="protect-selection" type="checkbox" checked>Protect selected objects</label>
<label><input id="cleanup-compare" type="checkbox">Show original</label>
<output id="cleanup-summary"></output>
<div><button id="cleanup-preview">Preview</button><button id="cleanup-apply" disabled>Apply &amp; Save</button><button id="cleanup-close">Close</button></div>`;
document.querySelector(".stage").append(cleanupPanel);
cleanupButton.onclick = () => {
  cleanupPanel.hidden = !cleanupPanel.hidden;
  render();
};
$("cleanup-close").onclick = () => { cleanupPanel.hidden = true; cleanupPreview = null; render(); };
$("cleanup-preview").onclick = () => {
  const fragment = Number($("fragment-area").value), hole = Number($("hole-area").value);
  if (![fragment, hole].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) {
    $("cleanup-summary").textContent = "Use values between 0 and 1%.";
    return;
  }
  cleanupPreview = { ...cleanGeometry(shapes, {
    fragmentArea: width * height * fragment / 100,
    holeArea: width * height * hole / 100,
    protectedIndices: $("protect-selection").checked ? [...selected] : [],
  }), source: JSON.stringify(shapes) };
  $("cleanup-summary").textContent = `${cleanupPreview.removed.length} fragments removed (magenta) · ${cleanupPreview.filled.length} holes filled (cyan) · contours unchanged`;
  $("cleanup-apply").disabled = false;
  render();
};
$("cleanup-compare").onchange = render;
for (const id of ["fragment-area", "hole-area", "protect-selection"]) $(id).addEventListener("input", () => {
  cleanupPreview = null;
  $("cleanup-apply").disabled = true;
  $("cleanup-summary").textContent = "Settings changed. Preview again.";
  render();
});
$("cleanup-apply").onclick = () => {
  if (!cleanupPreview || cleanupPreview.source !== JSON.stringify(shapes)) return;
  const before = snapshot();
  shapes = structuredClone(cleanupPreview.shapes);
  selected.clear();
  activeAnchor = null;
  cleanupPreview = null;
  $("cleanup-apply").disabled = true;
  $("cleanup-compare").checked = false;
  cleanupPanel.hidden = true;
  commit(before);
  $("message").textContent = "Cleanup applied · Undo restores previous geometry";
};
const snapshot = () => JSON.stringify({ shapes, draft, draftMode });
function save() {
  if (embedded) {
    saveHistory();
    if (embeddedTile)
      parent.postMessage(
        {
          type: "correction-change",
          tileId: embeddedTile.id,
          correction: { width, height, shapes, draft, draftMode },
        },
        location.origin,
      );
    $("save").textContent = "Project draft updated";
    return;
  }
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        shapes,
        draft,
        draftMode,
        history: history.slice(-8),
        future: future.slice(-8),
      }),
    );
    $("save").textContent = "Draft saved locally";
  } catch {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, shapes, draft, draftMode }),
      );
      $("save").textContent = "Draft saved; history stays in this tab";
    } catch {
      $("save").textContent = "Save failed — export SVG";
    }
  }
}
function commit(before) {
  if (before !== snapshot()) {
    history.push(before);
    history = history.slice(-40);
    future = [];
  }
  save();
  render();
}
function restore(s) {
  const data = JSON.parse(s);
  shapes = data.shapes;
  draft = data.draft || [];
  draftMode = data.draftMode || "add";
  selected.clear();
  activeAnchor = null;
  save();
  render();
}
function undo() {
  if (!history.length) return;
  future.push(snapshot());
  restore(history.pop());
}
function redo() {
  if (!future.length) return;
  history.push(snapshot());
  restore(future.pop());
}
function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent.append(n);
  return n;
}
function render() {
  if (cleanupPreview && cleanupPreview.source !== JSON.stringify(shapes)) {
    cleanupPreview = null;
    $("cleanup-apply").disabled = true;
    $("cleanup-summary").textContent = "Geometry changed. Preview again.";
  }
  $("world").setAttribute(
    "transform",
    `translate(${tx} ${ty}) scale(${scale})`,
  );
  $("reference").setAttribute("width", width);
  $("reference").setAttribute("height", height);
  $("reference").style.display = $("raster").checked ? "" : "none";
  $("mass").replaceChildren();
  $("selection").replaceChildren();
  $("anchors").replaceChildren();
  $("mass").style.display = $("vector").checked ? "" : "none";
  $("mass").setAttribute("opacity", $("opacity").value / 100);
  const showCleanup = cleanupPreview && !$("cleanup-compare").checked;
  (showCleanup ? cleanupPreview.shapes : shapes).forEach((s, i) => {
    el("path", { d: s.d, fill: "white", "fill-rule": "evenodd" }, $("mass"));
    if (!showCleanup && selected.has(i)) {
      el(
        "path",
        { d: s.d, fill: "none", stroke: "#ff269e", "stroke-width": 1 / scale },
        $("selection"),
      );
      if ($("anchors-toggle").checked && tool === "select")
        paths(make(s.d)).forEach((p, pi) =>
          p.segments.forEach((seg, si) => {
            const { x, y } = seg.point,
              r = 2.5 / scale;
            el(
              "path",
              {
                d: `M${x - r},${y}h${2 * r}M${x},${y - r}v${2 * r}`,
                stroke: "#6bd6d4",
                "stroke-width": 1 / scale,
              },
              $("anchors"),
            );
            if (
              activeAnchor?.i === i &&
              activeAnchor.pi === pi &&
              activeAnchor.si === si
            )
              for (const h of ["handleIn", "handleOut"])
                if (seg[h].length) {
                  const end = seg.point.add(seg[h]);
                  el(
                    "path",
                    {
                      d: `M${x},${y}L${end.x},${end.y}`,
                      stroke: "#888",
                      "stroke-width": 1 / scale,
                    },
                    $("anchors"),
                  );
                  el(
                    "circle",
                    { cx: end.x, cy: end.y, r: 3 / scale, fill: "#ff269e" },
                    $("anchors"),
                  );
                }
          }),
        );
    }
  });
  if (showCleanup) {
    for (const [list, color] of [[cleanupPreview.removed, "#ff269e"], [cleanupPreview.filled, "#6bd6d4"]])
      list.forEach((d) => el("path", { d, fill: "none", stroke: color, "stroke-width": 1 / scale, "stroke-dasharray": `${2 / scale} ${3 / scale}` }, $("selection")));
  }
  $("zoom").textContent = Math.round(scale * 100) + "%";
  $("undo").disabled = !history.length;
  $("redo").disabled = !future.length;
  $("delete").disabled = !selected.size;
  $("counts").textContent =
    showCleanup ? `${cleanupPreview.shapes.length} objects · cleanup preview` : `${shapes.length} objects · ${selected.size} selected`;
  $("draft-actions").classList.toggle("visible", !!draft.length);
  $("finish").disabled = draft.length < 3;
  preview();
}
function preview() {
  const g = $("preview");
  g.replaceChildren();
  if (draft.length) {
    const pts = [...draft];
    if (cursor && ["add", "subtract"].includes(tool))
      pts.push([cursor.x, cursor.y]);
    el(
      "path",
      {
        d: pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" "),
        fill: "none",
        stroke: tool === "subtract" ? "#ff269e" : "#6bd6d4",
        "stroke-width": 1 / scale,
      },
      g,
    );
    for (const [x, y] of draft)
      el(
        "path",
        {
          d: `M${x - 2.5 / scale},${y}h${5 / scale}M${x},${y - 2.5 / scale}v${5 / scale}`,
          stroke: "#6bd6d4",
          "stroke-width": 1 / scale,
        },
        g,
      );
  }
  if (tool === "erase" && cursor)
    el(
      "circle",
      {
        cx: cursor.x,
        cy: cursor.y,
        r: +$("brush").value / 2,
        fill: "#ff269e22",
        stroke: "#ff269e",
        "stroke-width": 1 / scale,
      },
      g,
    );
  if (gesture?.type === "marquee") {
    const r = new paper.Rectangle(gesture.start, cursor);
    el(
      "rect",
      {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        fill: "#6bd6d415",
        stroke: "#6bd6d4",
        "stroke-width": 1 / scale,
        "stroke-dasharray": `${4 / scale} ${4 / scale}`,
      },
      g,
    );
  }
  if (gesture?.type === "erase" && gesture.cutter)
    el("path", { d: gesture.cutter.pathData, fill: "#ff269e66" }, g);
}
function fit() {
  const r = $("workspace").getBoundingClientRect();
  scale = Math.min((r.width - 64) / width, (r.height - 40) / height);
  tx = (r.width - width * scale) / 2;
  ty = (r.height - height * scale) / 2;
  render();
}
function zoom(factor, screen) {
  const old = scale;
  scale = Math.max(0.1, Math.min(12, scale * factor));
  tx = screen.x - ((screen.x - tx) * scale) / old;
  ty = screen.y - ((screen.y - ty) * scale) / old;
  render();
}
const screen = (e) => {
  const r = $("workspace").getBoundingClientRect();
  return point(e.clientX - r.left, e.clientY - r.top);
};
const world = (e) => {
  const p = screen(e);
  return point((p.x - tx) / scale, (p.y - ty) / scale);
};
function setTool(t) {
  if (gesture) return;
  tool = t;
  activeAnchor = null;
  for (const name of ["select", "marquee", "add", "subtract", "erase", "pan"])
    $(name).classList.toggle("active", name === t);
  $("workspace").dataset.tool = t;
  $("brush-setting").style.visibility = t === "erase" ? "visible" : "hidden";
  $("message").textContent = {
    select: "Select mass to edit its anchors",
    marquee: "Enclose whole objects to select",
    add: "Outline missing mass",
    subtract: "Outline space to remove",
    erase: "Drag to erase vector mass",
    pan: "Drag to move the view",
  }[t];
  render();
}
function hit(p) {
  for (let i = shapes.length - 1; i >= 0; i--)
    if (make(shapes[i].d).contains(p)) return i;
  return -1;
}
function anchorHit(p) {
  for (const i of selected) {
    const ps = paths(make(shapes[i].d));
    for (let pi = 0; pi < ps.length; pi++)
      for (let si = 0; si < ps[pi].segments.length; si++) {
        const s = ps[pi].segments[si];
        if (
          activeAnchor?.i === i &&
          activeAnchor.pi === pi &&
          activeAnchor.si === si
        )
          for (const h of ["handleIn", "handleOut"])
            if (s[h].length && s.point.add(s[h]).getDistance(p) < 7 / scale)
              return { i, pi, si, handle: h };
        if (s.point.getDistance(p) < 6 / scale) return { i, pi, si };
      }
  }
  return null;
}
function boolean(cutter, operation) {
  if (operation === "subtract") {
    const next = [];
    for (const s of shapes) {
      const p = make(s.d);
      if (!p.bounds.intersects(cutter.bounds)) {
        next.push(s);
        continue;
      }
      const result = p.subtract(cutter, { insert: false });
      result.reorient(false, true);
      next.push(...split(result));
    }
    shapes = next;
  } else {
    let merged = cutter;
    const untouched = [];
    for (const s of shapes) {
      const p = make(s.d);
      if (p.bounds.intersects(merged.bounds))
        merged = merged.unite(p, { insert: false });
      else untouched.push(s);
    }
    merged.reorient(false, true);
    shapes = [...untouched, ...split(merged)];
  }
  selected.clear();
  activeAnchor = null;
}
function finish() {
  if (draft.length < 3) return;
  const before = snapshot();
  try {
    const p = new paper.Path({ segments: draft, closed: true, insert: false });
    boolean(p, draftMode);
    draft = [];
    commit(before);
  } catch (e) {
    restore(before);
    $("message").textContent = "Operation failed; original geometry retained";
    console.error(e);
  }
}
function erasePart(a, b) {
  const r = +$("brush").value / 2;
  let c = new paper.Path.Circle({ center: b, radius: r, insert: false });
  if (a && a.getDistance(b) > 0) {
    const normal = b.subtract(a).normalize(r).rotate(90);
    const bridge = new paper.Path({
      segments: [
        a.add(normal),
        b.add(normal),
        b.subtract(normal),
        a.subtract(normal),
      ],
      closed: true,
      insert: false,
    });
    c = c
      .unite(bridge, { insert: false })
      .unite(new paper.Path.Circle({ center: a, radius: r, insert: false }), {
        insert: false,
      });
  }
  gesture.cutter = gesture.cutter
    ? gesture.cutter.unite(c, { insert: false })
    : c;
  gesture.last = b;
}
$("workspace").addEventListener("pointerdown", (e) => {
  if (!ready || e.button !== 0) return;
  if (cleanupPreview && !$("cleanup-compare").checked && !e.shiftKey && tool !== "pan") return;
  $("workspace").focus();
  cursor = world(e);
  const s = screen(e);
  if (e.shiftKey || tool === "pan") {
    gesture = {
      type: "pan",
      s,
      tx,
      ty,
      toggle: e.shiftKey && tool === "select" ? hit(cursor) : -1,
    };
  } else if (tool === "select") {
    const a = $("anchors-toggle").checked ? anchorHit(cursor) : null;
    if (a) {
      activeAnchor = a;
      gesture = { type: "anchor", ...a, before: snapshot() };
    } else {
      const i = hit(cursor);
      selected.clear();
      activeAnchor = null;
      if (i >= 0) selected.add(i);
    }
    render();
  } else if (tool === "marquee") {
    gesture = { type: "marquee", start: cursor };
    selected.clear();
  } else if (tool === "erase") {
    gesture = { type: "erase", before: snapshot() };
    erasePart(null, cursor);
  } else {
    if (draft.length && draftMode !== tool) {
      $("message").textContent = "Finish or cancel the existing pen path first";
      return;
    }
    if (
      draft.length >= 3 &&
      point(...draft[0]).getDistance(cursor) < 8 / scale
    ) {
      finish();
      return;
    }
    const before = snapshot();
    if (!draft.length) draftMode = tool;
    draft.push([cursor.x, cursor.y]);
    commit(before);
  }
  $("workspace").setPointerCapture(e.pointerId);
  preview();
});
$("workspace").addEventListener("pointermove", (e) => {
  cursor = world(e);
  if (gesture?.type === "pan") {
    const s = screen(e);
    tx = gesture.tx + s.x - gesture.s.x;
    ty = gesture.ty + s.y - gesture.s.y;
    render();
  } else if (gesture?.type === "anchor") {
    const p = make(shapes[gesture.i].d),
      seg = paths(p)[gesture.pi].segments[gesture.si];
    if (gesture.handle) seg[gesture.handle] = cursor.subtract(seg.point);
    else seg.point = cursor;
    shapes[gesture.i] = { d: p.pathData };
    render();
  } else if (gesture?.type === "erase") {
    erasePart(gesture.last, cursor);
    preview();
  } else preview();
});
function pointerEnd(e) {
  if (!gesture) return;
  const g = gesture;
  try {
    if (g.type === "pan" && g.toggle >= 0 && screen(e).getDistance(g.s) < 4) {
      selected.has(g.toggle)
        ? selected.delete(g.toggle)
        : selected.add(g.toggle);
    }
    if (g.type === "erase") boolean(g.cutter, "subtract");
    if (g.type === "marquee") {
      const r = new paper.Rectangle(g.start, world(e));
      shapes.forEach((s, i) => {
        if (r.contains(make(s.d).bounds)) selected.add(i);
      });
    }
    gesture = null;
    if (g.before) commit(g.before);
    else render();
  } catch (err) {
    gesture = null;
    if (g.before) restore(g.before);
    $("message").textContent = "Edit failed; geometry restored";
    console.error(err);
  }
}
$("workspace").addEventListener("pointerup", pointerEnd);
$("workspace").addEventListener("pointercancel", () => {
  const g = gesture;
  gesture = null;
  if (g?.before) restore(g.before);
  else render();
});
$("workspace").addEventListener("pointerleave", () => {
  if (!gesture) {
    cursor = null;
    preview();
  }
});
$("workspace").addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.002)), screen(e));
  },
  { passive: false },
);
$("workspace").addEventListener("dblclick", (e) => {
  if (cleanupPreview && !$("cleanup-compare").checked) return;
  if (tool !== "select") return;
  const p = world(e);
  for (const i of selected) {
    const shape = make(shapes[i].d);
    for (const path of paths(shape)) {
      const loc = path.getNearestLocation(p);
      if (loc && loc.point.getDistance(p) < 8 / scale) {
        const before = snapshot();
        path.divideAt(loc);
        shapes[i] = { d: shape.pathData };
        activeAnchor = null;
        commit(before);
        return;
      }
    }
  }
});
function remove() {
  if (!selected.size) return;
  const before = snapshot();
  if (activeAnchor) {
    const { i, pi, si } = activeAnchor,
      p = make(shapes[i].d),
      path = paths(p)[pi];
    if (path.segments.length <= 3) {
      $("message").textContent =
        "Keep at least three anchors; select the object to delete it";
      return;
    }
    path.removeSegment(si);
    shapes[i] = { d: p.pathData };
    activeAnchor = null;
  } else {
    shapes = shapes.filter((_, i) => !selected.has(i));
    selected.clear();
  }
  commit(before);
}
for (const name of ["select", "marquee", "add", "subtract", "erase", "pan"])
  $(name).onclick = () => setTool(name);
$("undo").onclick = undo;
$("redo").onclick = redo;
$("delete").onclick = remove;
$("finish").onclick = finish;
$("cancel").onclick = () => {
  const before = snapshot();
  draft = [];
  commit(before);
};
$("fit").onclick = fit;
for (const [id, f] of [
  ["in", 1.25],
  ["out", 0.8],
])
  $(id).onclick = () =>
    zoom(f, point(tx + (width * scale) / 2, ty + (height * scale) / 2));
for (const id of ["raster", "vector", "anchors-toggle", "opacity"])
  $(id).oninput = render;
$("brush").oninput = () => {
  $("brush-value").textContent = $("brush").value;
  preview();
};
$("help").onclick = () => {
  const help = document.querySelector(".help");
  help.hidden = !help.hidden;
};
$("reset").onclick = () => {
  const dialog = document.createElement("dialog");
  dialog.setAttribute("aria-label", "Reset draft");
  dialog.innerHTML =
    '<h3>Reset draft to proposal?</h3><p>Your current edits can be recovered with Undo.</p><div><button class="action" id="keep-draft">Cancel</button><button class="action" id="confirm-reset">Reset draft</button></div>';
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.querySelector("#keep-draft").onclick = () => dialog.close();
  dialog.querySelector("#confirm-reset").onclick = () => {
    const before = snapshot();
    shapes = structuredClone(original);
    draft = [];
    selected.clear();
    activeAnchor = null;
    commit(before);
    dialog.close();
  };
  dialog.showModal();
};
$("export").onclick = () => {
  const svg = `<svg xmlns="${NS}" viewBox="0 0 ${width} ${height}">${shapes.map((s) => `<path fill="white" fill-rule="evenodd" d="${s.d}"/>`).join("")}</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${embeddedTile?.name || "tile-29"}-corrected.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
document.addEventListener("keydown", (e) => {
  if (document.querySelector("dialog[open]")) return;
  if (cleanupPreview && !$("cleanup-compare").checked) {
    if (e.key === "Escape") $("cleanup-close").click();
    if (["Delete", "Backspace", "Enter"].includes(e.key) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z")) e.preventDefault();
    return;
  }
  if (
    e.target.matches(
      'textarea, input:not([type="range"]):not([type="checkbox"])',
    )
  )
    return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (!gesture) (e.shiftKey ? redo : undo)();
    return;
  }
  if (e.key === "Escape") {
    if (gesture) {
      const g = gesture;
      gesture = null;
      if (g.before) restore(g.before);
    } else if (draft.length) $("cancel").click();
    else {
      selected.clear();
      activeAnchor = null;
      render();
    }
    return;
  }
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    remove();
  }
  if (e.key === "Enter" && draft.length) finish();
  const map = {
    v: "select",
    m: "marquee",
    p: "add",
    d: "subtract",
    e: "erase",
    h: "pan",
  };
  if (!e.metaKey && !e.ctrlKey && map[e.key]) setTool(map[e.key]);
});
new ResizeObserver(() => {
  if (ready) render();
}).observe(document.querySelector(".stage"));
async function init() {
  try {
    if (embedded) {
      document.body.classList.add("embedded");
      const payload = await new Promise((resolve) => {
        const receive = (event) => {
          if (
            event.origin !== location.origin ||
            event.source !== parent ||
            event.data?.type !== "correction-init"
          )
            return;
          window.removeEventListener("message", receive);
          resolve(event.data);
        };
        window.addEventListener("message", receive);
        parent.postMessage({ type: "correction-ready" }, location.origin);
      });
      embeddedTile = payload.tile;
      document.title = `${payload.tile.name} · Vector Correction`;
      const controls = document.querySelectorAll(".toolbar")[1];
      controls.append($("help"), $("export"));
      document.querySelector(".help p:last-child").textContent =
        "Edits update your project draft. Export retains white mass and transparent void.";
      const proposal = payload.proposal;
      if (!proposal) throw Error("No proposal available for this tile");
      width = proposal.width;
      height = proposal.height;
      original = proposal.shapes.flatMap((s) => split(make(s.d)));
      const current = payload.correction;
      shapes = current
        ? structuredClone(current.shapes)
        : structuredClone(original);
      draft = current?.draft || [];
      draftMode = current?.draftMode || "add";
      await recoverHistory();
      $("reference").setAttribute("href", payload.tile.src);
      $("workspace").setAttribute(
        "aria-label",
        `Vector editing workspace for ${payload.tile.name}`,
      );
      ready = true;
      setTool(draft.length ? draftMode : "select");
      fit();
      $("save").textContent = "Project draft";
      return;
    }
    const response = await fetch(
      "../vector-experiment/tile-29-720-connected-tones.svg",
    );
    if (!response.ok) throw Error("Proposal could not load");
    const doc = new DOMParser().parseFromString(
      await response.text(),
      "image/svg+xml",
    );
    const vb = doc.documentElement
      .getAttribute("viewBox")
      .split(/\s+/)
      .map(Number);
    width = vb[2];
    height = vb[3];
    original = split(make(doc.querySelector("path").getAttribute("d")));
    shapes = structuredClone(original);
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved?.version === 1 && Array.isArray(saved.shapes)) {
        saved.shapes.forEach((s) => make(s.d));
        shapes = saved.shapes;
        draft = saved.draft || [];
        draftMode = saved.draftMode || "add";
        history = saved.history || [];
        future = saved.future || [];
      }
    } catch {
      $("message").textContent = "Unreadable draft; loaded original proposal";
    }
    ready = true;
    setTool(draft.length ? draftMode : "select");
    fit();
    save();
  } catch (e) {
    $("message").textContent = e.message;
    console.error(e);
  }
}
init();
// Read-only diagnostics for the isolated prototype's browser tests.
window.editorDiagnostics = () => ({
  ready,
  shapes: structuredClone(shapes),
  draft: structuredClone(draft),
  history: history.length,
  future: future.length,
  scale,
  tx,
  ty,
  width,
  height,
});
