"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Box, Check, Combine, Copy, Maximize, Move3D, Plus, Redo2, Save, Trash2, Undo2, X } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import { addAdjacent, directionsFor, emptyBuilderDraft, moveBlocks, placementOffset, shapeOf,
  type AssemblyRecord, type BuilderBlock, type BuilderDraft, type PlacementDirection } from "../lib/cube-builder";
import { buildVolumeField, sampleVolumeField, type VolumeRecord } from "../lib/volume-study";

type Field = { field: Float32Array; resolution: number };
const directionLabels: Record<PlacementDirection, string> = {
  east: "+X", west: "-X", north: "-Z", south: "+Z", up: "+Y", down: "-Y",
  side1: "01", side2: "02", side3: "03", side4: "04", side5: "05", side6: "06",
};

function disposeObject(object: THREE.Object3D) {
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.GridHelper)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}

function outlineGeometry(record: VolumeRecord) {
  const source = shapeOf(record) === "hex-prism"
    ? new THREE.CylinderGeometry(1, 1, 2, 6, 1, false, Math.PI / 3)
    : new THREE.BoxGeometry(2, 2, 2);
  const edges = new THREE.EdgesGeometry(source);
  source.dispose();
  return edges;
}

function makeMesh(record: VolumeRecord, data: Field) {
  const material = new THREE.MeshStandardMaterial({ color: "#e7e9e6", roughness: 0.83, metalness: 0.02, side: THREE.DoubleSide });
  const mesh = new MarchingCubes(data.resolution, material, false, false, 180000);
  mesh.isolation = 0;
  mesh.field.set(data.field);
  mesh.update();
  mesh.scale.setScalar(data.resolution / (data.resolution - 4));
  mesh.userData.volumeId = record.id;
  return mesh;
}

function fusedMesh(blocks: BuilderBlock[], records: Map<string, VolumeRecord>, fields: Map<string, Field>) {
  const valid = blocks.filter(block => records.has(block.volumeId) && fields.has(block.volumeId));
  if (valid.length < 2) return null;
  const extent = [0, 1, 2].map(axis => {
    const values = valid.map(block => block.position[axis]);
    return [Math.min(...values) - 1.1, Math.max(...values) + 1.1] as const;
  });
  const center = extent.map(([low, high]) => (low + high) / 2) as [number, number, number];
  const span = Math.max(...extent.map(([low, high]) => high - low));
  const resolution = Math.max(48, Math.min(88, Math.ceil(span * 20)));
  const field = new Float32Array(resolution ** 3).fill(-1);
  const step = span / (resolution - 4);
  const positions = Array.from({ length: resolution }, (_, index) => (index - resolution / 2) * step);
  for (let z = 2; z < resolution - 2; z++) for (let y = 2; y < resolution - 2; y++) for (let x = 2; x < resolution - 2; x++) {
    const world: [number, number, number] = [positions[x] + center[0], positions[y] + center[1], positions[z] + center[2]];
    let value = -1;
    for (const block of valid) {
      const local = world.map((coordinate, axis) => coordinate - block.position[axis]);
      if (local.some(coordinate => Math.abs(coordinate) > 1.08)) continue;
      const source = fields.get(block.volumeId)!;
      const sampled = sampleVolumeField(source.field, source.resolution,
        ...local.map(coordinate => Math.max(-0.94, Math.min(0.94, coordinate))) as [number, number, number]);
      const falloff = Math.max(...local.map(coordinate => Math.max(0, Math.abs(coordinate) - 0.94))) * 5;
      value = Math.max(value, sampled - falloff);
    }
    field[z * resolution * resolution + y * resolution + x] = value;
  }
  const material = new THREE.MeshStandardMaterial({ color: "#f0f0eb", roughness: 0.81, metalness: 0.02, side: THREE.DoubleSide });
  const mesh = new MarchingCubes(resolution, material, false, false, 380000);
  mesh.isolation = 0;
  mesh.field.set(field);
  mesh.update();
  mesh.position.set(...center);
  mesh.scale.setScalar(span / 2 * resolution / (resolution - 4));
  return mesh;
}

export function CubeBuilder({ records, assemblies, draft, nextNumber, onDraftChange, onSave, onDelete, onClose }: {
  records: VolumeRecord[];
  assemblies: AssemblyRecord[];
  draft: BuilderDraft;
  nextNumber: number;
  onDraftChange: (draft: BuilderDraft) => void;
  onSave: (record: AssemblyRecord) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [sourceId, setSourceId] = useState(records[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [direction, setDirection] = useState<PlacementDirection>("east");
  const [activeAssembly, setActiveAssembly] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const history = useRef<{ past: BuilderDraft[]; future: BuilderDraft[] }>({ past: [], future: [] });
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const controls = useRef<OrbitControls | null>(null);
  const meshes = useRef(new Map<string, MarchingCubes>());
  const fieldCache = useRef(new Map<string, Field>());
  const modelGroup = useRef<THREE.Group | null>(null);
  const selectionGroup = useRef<THREE.Group | null>(null);
  const union = useRef<MarchingCubes | null>(null);
  const recordMap = useMemo(() => new Map(records.map(record => [record.id, record])), [records]);
  const source = recordMap.get(sourceId) ?? records[0];
  const anchor = draft.blocks.find(block => block.id === selected[0]) ?? draft.blocks.at(-1);
  const anchorRecord = anchor && recordMap.get(anchor.volumeId);
  const availableDirections = anchorRecord ? directionsFor(shapeOf(anchorRecord)) : directionsFor("cube");
  const effectiveDirection = availableDirections.includes(direction) ? direction : availableDirections[0];

  function commit(next: BuilderDraft) {
    history.current.past.push(structuredClone(draft));
    history.current.future = [];
    setCanUndo(true); setCanRedo(false);
    onDraftChange(next);
    setMessage("");
  }
  function undo() {
    const previous = history.current.past.pop();
    if (!previous) return;
    history.current.future.push(structuredClone(draft));
    onDraftChange(previous);
    setCanUndo(history.current.past.length > 0); setCanRedo(true);
    setSelected([]);
  }
  function redo() {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(structuredClone(draft));
    onDraftChange(next);
    setCanUndo(true); setCanRedo(history.current.future.length > 0);
    setSelected([]);
  }
  function addBlock() {
    if (!source) { setMessage("Save an object in 3D Object Study first."); return; }
    const next = addAdjacent(draft.blocks, anchor?.id ?? null, source, effectiveDirection, recordMap, crypto.randomUUID());
    if (!next) { setMessage("That face is occupied or incompatible with this block shape."); return; }
    commit({ ...draft, blocks: next });
    setSelected([next.at(-1)!.id]);
  }
  function move(direction: PlacementDirection) {
    if (!selected.length || !anchorRecord) return;
    const offset = placementOffset(shapeOf(anchorRecord), shapeOf(anchorRecord), direction);
    if (!offset) return;
    const next = moveBlocks(draft.blocks, new Set(selected), offset, recordMap);
    if (!next) { setMessage("Move blocked: it would overlap another block."); return; }
    commit({ ...draft, blocks: next });
  }
  function fitView() {
    if (!camera.current || !controls.current) return;
    const positions = draft.blocks.map(block => block.position);
    const center = positions.length ? [0, 1, 2].map(axis => (Math.min(...positions.map(p => p[axis])) + Math.max(...positions.map(p => p[axis]))) / 2) : [0, 0, 0];
    const spread = Math.max(2, ...[0, 1, 2].map(axis => positions.length ? Math.max(...positions.map(p => p[axis])) - Math.min(...positions.map(p => p[axis])) + 2 : 2));
    controls.current.target.set(center[0], center[1], center[2]);
    camera.current.position.set(center[0] + spread * 1.8, center[1] + spread * 1.3, center[2] + spread * 1.8);
    controls.current.update();
  }

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let frame = 0;
    const nextScene = new THREE.Scene();
    nextScene.background = new THREE.Color("#090a0c");
    scene.current = nextScene;
    const nextCamera = new THREE.PerspectiveCamera(43, 1, 0.1, 200);
    nextCamera.position.set(8, 6, 8);
    camera.current = nextCamera;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.appendChild(renderer.domElement);
    const orbit = new OrbitControls(nextCamera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.minDistance = 2.5;
    orbit.maxDistance = 80;
    controls.current = orbit;
    nextScene.add(new THREE.AmbientLight("#c4d0d8", 1.5));
    const key = new THREE.DirectionalLight("#ffffff", 2.7);
    key.position.set(5, 8, 6); nextScene.add(key);
    const fill = new THREE.DirectionalLight("#ffb020", 0.45);
    fill.position.set(-6, 2, -5); nextScene.add(fill);
    const grid = new THREE.GridHelper(40, 20, "#3e4448", "#272b2e");
    grid.position.y = -1.05; nextScene.add(grid);
    const models = new THREE.Group(); nextScene.add(models); modelGroup.current = models;
    const outlines = new THREE.Group(); nextScene.add(outlines); selectionGroup.current = outlines;
    const resize = new ResizeObserver(() => {
      const width = Math.max(1, element.clientWidth), height = Math.max(1, element.clientHeight);
      nextCamera.aspect = width / height; nextCamera.updateProjectionMatrix(); renderer.setSize(width, height);
    });
    resize.observe(element);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: [number, number] | null = null;
    const onDown = (event: PointerEvent) => { down = [event.clientX, event.clientY]; };
    const onUp = (event: PointerEvent) => {
      if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) { down = null; return; }
      down = null;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(pointer, nextCamera);
      const hit = raycaster.intersectObjects([...meshes.current.values()], false)[0];
      const id = hit?.object.userData.blockId as string | undefined;
      setSelected(current => event.shiftKey ? id ? current.includes(id) ? current.filter(value => value !== id) : [...current, id] : current : id ? [id] : []);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    function animate() { frame = requestAnimationFrame(animate); orbit.update(); renderer.render(nextScene, nextCamera); }
    animate();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); orbit.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      if (union.current) disposeObject(union.current);
      disposeObject(models); disposeObject(outlines); disposeObject(grid);
      renderer.dispose(); renderer.domElement.remove(); scene.current = null;
      modelGroup.current = null; selectionGroup.current = null;
    };
  }, []);

  useEffect(() => {
    const group = modelGroup.current;
    if (!group) return;
    for (const child of [...group.children]) { group.remove(child); disposeObject(child); }
    meshes.current.clear();
    for (const block of draft.blocks) {
      const record = recordMap.get(block.volumeId);
      if (!record) continue;
      let field = fieldCache.current.get(record.id);
      if (!field) {
        const generated = buildVolumeField(record, 40);
        field = { field: generated.field, resolution: generated.resolution };
        fieldCache.current.set(record.id, field);
      }
      const mesh = makeMesh(record, field);
      mesh.position.set(...block.position);
      mesh.userData.blockId = block.id;
      group.add(mesh);
      meshes.current.set(block.id, mesh);
    }
  }, [draft.blocks, recordMap]);

  useEffect(() => {
    const currentScene = scene.current;
    if (!currentScene) return;
    if (union.current) { currentScene.remove(union.current); disposeObject(union.current); union.current = null; }
    if (draft.fused && draft.blocks.length > 1) {
      const mesh = fusedMesh(draft.blocks, recordMap, fieldCache.current);
      if (mesh) { currentScene.add(mesh); union.current = mesh; }
    }
    for (const mesh of meshes.current.values()) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.transparent = !!union.current;
      material.opacity = union.current ? 0 : 1;
      material.depthWrite = !union.current;
      material.needsUpdate = true;
    }
  }, [draft.blocks, draft.fused, recordMap]);

  useEffect(() => {
    const group = selectionGroup.current;
    if (!group) return;
    for (const child of [...group.children]) { group.remove(child); disposeObject(child); }
    for (const block of draft.blocks) {
      const record = recordMap.get(block.volumeId);
      if (!record) continue;
      const active = selected.includes(block.id);
      if (draft.fused && !active) continue;
      const outline = new THREE.LineSegments(outlineGeometry(record), new THREE.LineBasicMaterial({ color: active ? "#ff2f9b" : "#68727a", transparent: true, opacity: active ? 1 : 0.42, depthTest: !active }));
      outline.position.set(...block.position);
      outline.renderOrder = active ? 5 : 0;
      group.add(outline);
    }
  }, [draft.blocks, draft.fused, selected, recordMap]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const activeRecord = assemblies.find(record => record.id === activeAssembly);
  return <div className="volume-study cube-builder" role="dialog" aria-modal="true" aria-label="Cube builder">
    <header className="volume-header"><div className="study-title"><img src="/fausoa-logo.png" alt="FAU School of Architecture"/><strong>CUBE BUILDER</strong><span>3D ASSEMBLY WORKSPACE</span></div><button className="volume-icon" title="Close cube builder" aria-label="Close cube builder" onClick={onClose}><X size={20}/></button></header>
    <div className="volume-layout">
      <aside className="volume-rail">
        <div className="volume-rail-heading"><Box size={16}/><strong>SAVED OBJECTS</strong><small>{records.length}</small></div>
        {records.length ? <div className="builder-library">{records.map(record => <button key={record.id} className={source?.id === record.id ? "active" : ""} onClick={() => setSourceId(record.id)}><Box size={17}/><span>{record.name}<small>{shapeOf(record) === "hex-prism" ? "HEX PRISM" : "CUBE"} · {Object.keys(record.faces).length} VECTOR FACES</small></span>{source?.id === record.id && <Check size={15}/>}</button>)}</div> : <p className="volume-empty">Save a volume in 3D Object Study to start building.</p>}
        <div className="volume-library"><div className="volume-rail-heading"><strong>ASSEMBLIES</strong><small>{assemblies.length}</small></div>
          {assemblies.slice().reverse().map(record => <div className={`volume-record ${activeAssembly === record.id ? "active" : ""}`} key={record.id}><button onClick={() => { onDraftChange({ blocks: structuredClone(record.blocks), fused: record.fused }); setActiveAssembly(record.id); setSelected([]); history.current = { past: [], future: [] }; setCanUndo(false); setCanRedo(false); }}><Combine size={15}/><span>{record.name}<small>{record.blocks.length} blocks</small></span></button><button className="volume-delete" title={`Delete ${record.name}`} aria-label={`Delete ${record.name}`} onClick={() => { if (window.confirm(`Permanently delete ${record.name}?`)) { onDelete(record.id); if (activeAssembly === record.id) setActiveAssembly(null); } }}><Trash2 size={14}/></button></div>)}
          {!assemblies.length && <p className="volume-empty">No saved assemblies yet.</p>}
        </div>
      </aside>
      <section className="volume-stage builder-stage" aria-label="3D assembly viewport">
        <div ref={host} className="volume-canvas"/>
        {!draft.blocks.length && <div className="volume-stage-empty"><Move3D size={28}/><strong>READY TO BUILD</strong><span>Choose a saved object and place the first block.</span></div>}
        <div className="volume-stage-controls"><button onClick={fitView} title="Fit assembly in view" aria-label="Fit assembly in view"><Maximize size={16}/></button><button className={draft.fused ? "active" : ""} onClick={() => commit({ ...draft, fused: !draft.fused })} title="Generate a non-destructive fused mesh preview"><Combine size={16}/> FUSE PREVIEW</button><button onClick={undo} disabled={!canUndo} title="Undo" aria-label="Undo"><Undo2 size={16}/></button><button onClick={redo} disabled={!canRedo} title="Redo" aria-label="Redo"><Redo2 size={16}/></button></div>
        <div className="volume-stage-meta">CLICK TO SELECT · SHIFT-CLICK FOR MULTIPLE · ORBIT · PAN · ZOOM</div>
      </section>
      <aside className="volume-inspector builder-inspector">
        <div className="volume-rail-heading"><Plus size={16}/><strong>PLACE BLOCK</strong></div>
        <div className="builder-current"><span>Source</span><strong>{source?.name ?? "No saved object"}</strong><small>{source ? shapeOf(source) === "cube" ? "CUBE" : "HEX PRISM" : ""}</small></div>
        {draft.blocks.length > 0 && <><div className="builder-current"><span>Against</span><strong>{anchorRecord?.name ?? "Select a block"}</strong><small>{anchor ? `BLOCK ${draft.blocks.indexOf(anchor) + 1}` : ""}</small></div><div className="builder-directions" role="group" aria-label="Placement face">{availableDirections.map(value => {
          const compatible = !!(anchorRecord && source && placementOffset(shapeOf(anchorRecord), shapeOf(source), value));
          return <button key={value} disabled={!compatible} className={effectiveDirection === value ? "active" : ""} onClick={() => setDirection(value)} title={`Place on ${value} face`}>{directionLabels[value]}</button>;
        })}</div></>}
        <button className="volume-save" disabled={!source} onClick={addBlock}><Plus size={16}/>{draft.blocks.length ? "PLACE ADJACENT" : "PLACE FIRST BLOCK"}</button>
        {message && <p className="builder-message" role="status">{message}</p>}
        <div className="volume-inspector-rule"/>
        <div className="volume-rail-heading"><Move3D size={16}/><strong>EDIT SELECTION</strong><small>{selected.length} SELECTED</small></div>
        <div className="builder-block-list">{draft.blocks.map((block, index) => <label key={block.id} className={selected.includes(block.id) ? "active" : ""}><input type="checkbox" checked={selected.includes(block.id)} onChange={event => setSelected(current => event.target.checked ? [...current, block.id] : current.filter(id => id !== block.id))}/><span>BLOCK {String(index + 1).padStart(2, "0")}<small>{recordMap.get(block.volumeId)?.name ?? "Missing source"}</small></span></label>)}</div>
        {!!draft.blocks.length && <button className="builder-secondary" onClick={() => setSelected(draft.blocks.map(block => block.id))}><Copy size={14}/> SELECT ALL BLOCKS</button>}
        {selected.length > 0 && <>{anchorRecord && <div className="builder-move-grid" role="group" aria-label="Move selected blocks">{directionsFor(shapeOf(anchorRecord)).map(value => <button key={value} onClick={() => move(value)} title={`Move selected ${value}`}>{value === "up" ? <ArrowUp size={15}/> : value === "down" ? <ArrowDown size={15}/> : value === "east" ? <ArrowRight size={15}/> : value === "west" ? <ArrowLeft size={15}/> : null}{directionLabels[value]}</button>)}</div>}<button className="builder-secondary danger" onClick={() => { commit({ ...draft, blocks: draft.blocks.filter(block => !selected.includes(block.id)) }); setSelected([]); }}><Trash2 size={14}/> REMOVE SELECTED</button></>}
        <div className="volume-inspector-rule"/>
        <div className="volume-rail-heading"><strong>ASSEMBLY RECORD</strong></div>
        <button className="volume-save" disabled={!draft.blocks.length} onClick={() => {
          const now = Date.now();
          const record: AssemblyRecord = { ...structuredClone(draft), id: activeRecord?.id ?? crypto.randomUUID(), name: activeRecord?.name ?? `Assembly ${String(nextNumber).padStart(2, "0")}`, createdAt: activeRecord?.createdAt ?? now, updatedAt: now };
          onSave(record); setActiveAssembly(record.id); setMessage(`${record.name} saved.`);
        }}><Save size={16}/> {activeRecord ? "SAVE ASSEMBLY" : "SAVE NEW ASSEMBLY"}</button>
        <button className="builder-secondary" onClick={() => { commit(emptyBuilderDraft()); setActiveAssembly(null); setSelected([]); }}>NEW ASSEMBLY</button>
        <p className="volume-note">Fusion is a reversible mesh preview. The placed source blocks remain independent and selectable.</p>
      </aside>
    </div>
  </div>;
}
