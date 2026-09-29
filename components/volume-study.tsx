"use client";
/* eslint-disable react-hooks/immutability -- Three.js scene graph objects are mutable by design. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Check, ChevronDown, ChevronRight, Eye, EyeOff, Maximize, RotateCcw, Save, Scissors,
  Sparkles, Trash2, X,
} from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import { CorrectionGeometry, type Correction } from "./correction-editor";
import {
  buildVolumeField, faceMask, facesForShape, hexSidePose, HEX_APOTHEM, sampleVolumeField,
  type VolumeAssignments, type VolumeFaceName, type VolumeRecipe, type VolumeRecord, type VolumeShape,
} from "../lib/volume-study";

type TileOption = { id: number; name: string; src: string; correction: Correction };

function TileThumbnail({ tile }: { tile: TileOption }) {
  return <span className="volume-tile-images">
    <img src={tile.src} alt="" loading="lazy" />
    <svg viewBox="0 0 100 100" aria-hidden="true"><CorrectionGeometry correction={tile.correction}/></svg>
  </span>;
}

function placeOnFace(object: THREE.Object3D, name: VolumeFaceName, offset: number, shape: VolumeShape) {
  if (shape === "hex-prism" && name.startsWith("side")) {
    const { angle } = hexSidePose(Number(name.slice(4)) - 1);
    object.position.set(Math.cos(angle) * (HEX_APOTHEM + offset), 0, Math.sin(angle) * (HEX_APOTHEM + offset));
    object.rotation.y = -Math.PI / 2 - angle;
    return;
  }
  switch (name) {
    case "front": object.position.z = -offset; break;
    case "back": object.position.z = offset; object.rotation.y = Math.PI; break;
    case "left": object.position.x = -offset; object.rotation.y = -Math.PI / 2; break;
    case "right": object.position.x = offset; object.rotation.y = Math.PI / 2; break;
    case "top": object.position.y = offset; object.rotation.x = -Math.PI / 2; break;
    case "bottom": object.position.y = -offset; object.rotation.x = Math.PI / 2; break;
  }
}

function hexPlaneGeometry() {
  const shape = new THREE.Shape();
  for (let index = 0; index < 6; index++) {
    const angle = Math.PI / 6 + index * Math.PI / 3;
    const x = Math.cos(angle), y = -Math.sin(angle);
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  const positions = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index++) uv.setXY(index, (positions.getX(index) + 1) / 2, (positions.getY(index) + 1) / 2);
  return geometry;
}

function faceGeometry(name: VolumeFaceName, shape: VolumeShape, grow = 0) {
  if (shape !== "hex-prism") return new THREE.PlaneGeometry(2 + grow, 2 + grow);
  if (name === "top" || name === "bottom") {
    const geometry = hexPlaneGeometry();
    geometry.scale(1 + grow / 2, 1 + grow / 2, 1);
    return geometry;
  }
  return new THREE.PlaneGeometry(1 + grow, 2 + grow);
}

function faceGuide(name: VolumeFaceName, correction: Correction, shape: VolumeShape, adjustments: [number, number][] = []) {
  const size = 112;
  const mask = faceMask(correction, size);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    if (!mask[i]) continue;
    const edge = x === 0 || x === size - 1 || y === 0 || y === size - 1 ||
      !mask[i - 1] || !mask[i + 1] || !mask[i - size] || !mask[i + size];
    image.data[i * 4] = 45;
    image.data[i * 4 + 1] = 216;
    image.data[i * 4 + 2] = 210;
    image.data[i * 4 + 3] = edge ? 230 : 75;
  }
  context.putImageData(image, 0, 0);
  context.fillStyle = "#ffb020";
  for (const [u, v] of adjustments) context.fillRect(Math.round(u * (size - 1)) - 1, Math.round(v * (size - 1)) - 1, 3, 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    faceGeometry(name, shape),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  placeOnFace(mesh, name, shape === "hex-prism" && name.startsWith("side") ? 0.012 : 1.012, shape);
  return mesh;
}

function faceHighlight(name: VolumeFaceName, shape: VolumeShape) {
  const group = new THREE.Group();
  const fill = new THREE.Mesh(
    faceGeometry(name, shape, 0.03),
    new THREE.MeshBasicMaterial({ color: "#ff2f9b", transparent: true, opacity: 0.16, depthTest: false, depthWrite: false, side: THREE.DoubleSide }),
  );
  const outlineSource = faceGeometry(name, shape, 0.03);
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(outlineSource),
    new THREE.LineBasicMaterial({ color: "#ff2f9b", depthTest: false, transparent: true, opacity: 0.95 }),
  );
  outlineSource.dispose();
  fill.renderOrder = 20;
  outline.renderOrder = 21;
  group.add(fill, outline);
  placeOnFace(group, name, shape === "hex-prism" && name.startsWith("side") ? 0.045 : 1.045, shape);
  return group;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.LineSegments)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshBasicMaterial) material.map?.dispose();
      material.dispose();
    }
  });
}

function cutFace(field: Float32Array, resolution: number, axis: "x" | "y" | "z", position: number) {
  const size = 192;
  const span = 2.18;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  const pixels = context.createImageData(size, size);
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const horizontal = ((col + 0.5) / size - 0.5) * span;
    const vertical = (0.5 - (row + 0.5) / size) * span;
    const x = axis === "x" ? position : horizontal;
    const y = axis === "y" ? position : vertical;
    const z = axis === "x" ? -horizontal : axis === "y" ? -vertical : position;
    const value = sampleVolumeField(field, resolution, x, y, z);
    const offset = (row * size + col) * 4;
    pixels.data[offset] = 238;
    pixels.data[offset + 1] = 188;
    pixels.data[offset + 2] = 122;
    pixels.data[offset + 3] = Math.max(0, Math.min(255, Math.round((0.5 + value * 6) * 255)));
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(span, span),
    new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.42, side: THREE.DoubleSide, depthWrite: true, polygonOffset: true, polygonOffsetFactor: -1 }),
  );
  if (axis === "x") { mesh.position.x = position + 0.003; mesh.rotation.y = Math.PI / 2; }
  if (axis === "y") { mesh.position.y = position + 0.003; mesh.rotation.x = -Math.PI / 2; }
  if (axis === "z") mesh.position.z = position + 0.003;
  mesh.renderOrder = 2;
  return mesh;
}

export function VolumeStudy({ tiles, records, onSave, onDelete, onClose }: {
  tiles: TileOption[];
  records: VolumeRecord[];
  onSave: (recipe: VolumeRecipe) => void;
  onDelete: (id: string) => boolean;
  onClose: () => void;
}) {
  const [shape, setShape] = useState<VolumeShape>("cube");
  const [selected, setSelected] = useState<Partial<Record<VolumeFaceName, number>>>(() => ({
    front: tiles[0]?.id,
    right: tiles[1]?.id ?? tiles[0]?.id,
  }));
  const [seed, setSeed] = useState(1);
  const [fitTolerance, setFitTolerance] = useState(24);
  const [recipe, setRecipe] = useState<VolumeRecipe | null>(null);
  const [activeRecord, setActiveRecord] = useState<string | null>(null);
  const [activeFace, setActiveFace] = useState<VolumeFaceName | null>(null);
  const [saved, setSaved] = useState(false);
  const [ghosted, setGhosted] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [clipEnabled, setClipEnabled] = useState(false);
  const [clipAxis, setClipAxis] = useState<"x" | "y" | "z">("x");
  const [clipPosition, setClipPosition] = useState(0);
  const [faceFit, setFaceFit] = useState<number | null>(null);
  const [error, setError] = useState("");
  const canvasHost = useRef<HTMLDivElement>(null);
  const faceList = useRef<HTMLDivElement>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const controls = useRef<OrbitControls | null>(null);
  const volume = useRef<MarchingCubes | null>(null);
  const volumeField = useRef<{ field: Float32Array; resolution: number } | null>(null);
  const cut = useRef<THREE.Mesh | null>(null);
  const guides = useRef<THREE.Group | null>(null);
  const highlightedFace = useRef<THREE.Group | null>(null);
  const frameBox = useRef<THREE.LineSegments | null>(null);
  const plane = useRef(new THREE.Plane(new THREE.Vector3(1, 0, 0), 0));
  const planeHelper = useRef<THREE.PlaneHelper | null>(null);
  const available = useMemo(() => new Map(tiles.map(tile => [tile.id, tile])), [tiles]);

  useEffect(() => {
    if (!activeFace) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !faceList.current?.contains(event.target)) setActiveFace(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveFace(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [activeFace]);

  useEffect(() => {
    const host = canvasHost.current;
    if (!host) return;
    let frame = 0;
    let resize: ResizeObserver | null = null;
    try {
      const nextScene = new THREE.Scene();
      nextScene.background = new THREE.Color("#090a0c");
      scene.current = nextScene;
      const nextCamera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
      nextCamera.position.set(3.35, 2.45, 3.55);
      camera.current = nextCamera;
      const nextRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      nextRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      nextRenderer.outputColorSpace = THREE.SRGBColorSpace;
      nextRenderer.localClippingEnabled = true;
      renderer.current = nextRenderer;
      host.appendChild(nextRenderer.domElement);
      const nextControls = new OrbitControls(nextCamera, nextRenderer.domElement);
      nextControls.enableDamping = true;
      nextControls.minDistance = 2.5;
      nextControls.maxDistance = 11;
      controls.current = nextControls;
      nextScene.add(new THREE.AmbientLight("#c8d8e2", 1.25));
      const light = new THREE.DirectionalLight("#ffffff", 2.5);
      light.position.set(3, 5, 4);
      nextScene.add(light);
      const fill = new THREE.DirectionalLight("#ffb020", 0.6);
      fill.position.set(-3, -1, -2);
      nextScene.add(fill);
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)),
        new THREE.LineBasicMaterial({ color: "#8f9299", transparent: true, opacity: 0.65 }),
      );
      nextScene.add(outline);
      frameBox.current = outline;
      const helper = new THREE.PlaneHelper(plane.current, 2.7, 0xff2f9b);
      helper.visible = false;
      nextScene.add(helper);
      planeHelper.current = helper;
      resize = new ResizeObserver(() => {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        nextCamera.aspect = width / height;
        nextCamera.updateProjectionMatrix();
        nextRenderer.setSize(width, height);
      });
      resize.observe(host);
      function animate() {
        frame = requestAnimationFrame(animate);
        nextControls.update();
        nextRenderer.render(nextScene, nextCamera);
      }
      animate();
    } catch {
      queueMicrotask(() => setError("This browser could not initialize the 3D workspace."));
    }
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      controls.current?.dispose();
      if (volume.current) disposeObject(volume.current);
      if (cut.current) disposeObject(cut.current);
      if (guides.current) disposeObject(guides.current);
      if (highlightedFace.current) disposeObject(highlightedFace.current);
      scene.current?.traverse(object => {
        if (object instanceof THREE.LineSegments) disposeObject(object);
      });
      renderer.current?.dispose();
      renderer.current?.domElement.remove();
      renderer.current = null;
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    const frame = frameBox.current;
    if (!frame) return;
    frame.geometry.dispose();
    const source = shape === "hex-prism"
      ? new THREE.CylinderGeometry(1, 1, 2, 6, 1, false, Math.PI / 3)
      : new THREE.BoxGeometry(2, 2, 2);
    frame.geometry = new THREE.EdgesGeometry(source);
    source.dispose();
  }, [shape]);

  useEffect(() => {
    if (highlightedFace.current) {
      scene.current?.remove(highlightedFace.current);
      disposeObject(highlightedFace.current);
      highlightedFace.current = null;
    }
    if (activeFace && scene.current) {
      const highlight = faceHighlight(activeFace, shape);
      scene.current.add(highlight);
      highlightedFace.current = highlight;
    }
  }, [activeFace, shape]);

  useEffect(() => {
    const currentScene = scene.current;
    if (!currentScene) return;
    if (volume.current) {
      currentScene.remove(volume.current);
      disposeObject(volume.current);
      volume.current = null;
    }
    if (cut.current) {
      currentScene.remove(cut.current);
      disposeObject(cut.current);
      cut.current = null;
    }
    volumeField.current = null;
    if (guides.current) {
      currentScene.remove(guides.current);
      disposeObject(guides.current);
      guides.current = null;
    }
    if (!recipe) return;
    try {
      const { field, resolution, faceFit: fit, adjustments } = buildVolumeField(recipe);
      const material = new THREE.MeshStandardMaterial({
        color: ghosted ? "#dce8ea" : "#f7f7f5",
        roughness: 0.8,
        metalness: 0.04,
        transparent: ghosted,
        opacity: ghosted ? 0.28 : 1,
        depthWrite: !ghosted,
        side: THREE.DoubleSide,
        clippingPlanes: clipEnabled ? [plane.current] : [],
      });
      const mesh = new MarchingCubes(resolution, material, false, false, 180000);
      mesh.isolation = 0;
      mesh.field.set(field);
      mesh.update();
      mesh.scale.setScalar(resolution / (resolution - 4));
      currentScene.add(mesh);
      volume.current = mesh;
      volumeField.current = { field, resolution };
      const group = new THREE.Group();
      for (const name of facesForShape(recipe.shape)) {
        const face = recipe.faces[name];
        if (face) group.add(faceGuide(name, face.correction, recipe.shape ?? "cube", adjustments[name]));
      }
      group.visible = showGuides;
      currentScene.add(group);
      guides.current = group;
      queueMicrotask(() => { setFaceFit(fit); setError(""); });
    } catch {
      queueMicrotask(() => {
        setError("Volume generation failed for this combination. Try another face or vector.");
        setFaceFit(null);
      });
    }
    // Rebuild only when the source recipe changes; display controls update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe]);

  useEffect(() => {
    const material = volume.current?.material;
    if (material instanceof THREE.MeshStandardMaterial) {
      const showGhost = ghosted && !clipEnabled;
      material.color.set(showGhost ? "#dce8ea" : "#f7f7f5");
      material.transparent = showGhost;
      material.opacity = showGhost ? 0.28 : 1;
      material.depthWrite = !showGhost;
      material.needsUpdate = true;
    }
  }, [ghosted, clipEnabled, recipe]);
  useEffect(() => { if (guides.current) guides.current.visible = showGuides; }, [showGuides, recipe]);
  useEffect(() => {
    plane.current.normal.set(clipAxis === "x" ? 1 : 0, clipAxis === "y" ? 1 : 0, clipAxis === "z" ? 1 : 0);
    plane.current.constant = -clipPosition;
    if (planeHelper.current) planeHelper.current.visible = clipEnabled;
    const material = volume.current?.material;
    if (material instanceof THREE.MeshStandardMaterial) {
      material.clippingPlanes = clipEnabled ? [plane.current] : [];
      material.needsUpdate = true;
    }
    if (cut.current) {
      scene.current?.remove(cut.current);
      disposeObject(cut.current);
      cut.current = null;
    }
    if (clipEnabled && scene.current && volumeField.current) {
      cut.current = cutFace(volumeField.current.field, volumeField.current.resolution, clipAxis, clipPosition);
      scene.current.add(cut.current);
    }
  }, [clipEnabled, clipAxis, clipPosition, recipe]);

  function createRecipe(nextSeed = seed) {
    const faces: VolumeAssignments = {};
    for (const name of facesForShape(shape)) {
      const tile = available.get(selected[name] ?? -1);
      if (tile) faces[name] = { tileId: tile.id, correction: structuredClone(tile.correction) };
    }
    if (!Object.keys(faces).length) {
      setError("Select at least one approved vector.");
      return;
    }
    setRecipe({ shape, faces, seed: nextSeed, fitTolerance });
    setActiveRecord(null);
    setSaved(false);
  }

  function openRecord(record: VolumeRecord) {
    const recordShape = record.shape ?? "cube";
    setShape(recordShape);
    setActiveFace(null);
    setRecipe({ shape: recordShape, faces: record.faces, seed: record.seed, fitTolerance: record.fitTolerance });
    setSeed(record.seed);
    setFitTolerance(record.fitTolerance);
    setSelected(Object.fromEntries(facesForShape(recordShape).map(name => [name, record.faces[name]?.tileId])));
    setActiveRecord(record.id);
    setSaved(true);
  }

  function resetView() {
    if (!camera.current || !controls.current) return;
    camera.current.position.set(3.35, 2.45, 3.55);
    controls.current.target.set(0, 0, 0);
    controls.current.update();
  }

  return <div className="volume-study" role="dialog" aria-modal="true" aria-label="3D object study">
    <header className="volume-header">
      <div className="study-title"><img src="/fausoa-logo.png" alt="FAU School of Architecture"/><strong>3D OBJECT STUDY</strong><span>FACE-CONSTRAINED VOLUMES</span></div>
      <button className="volume-icon" title="Close 3D object study" aria-label="Close 3D object study" onClick={onClose}><X size={20}/></button>
    </header>
    <div className="volume-layout">
      <aside className="volume-rail">
        <div className="volume-rail-heading"><Box size={16}/><strong>FACE ASSIGNMENT</strong><small>{Object.values(selected).filter(Boolean).length}/{facesForShape(shape).length}</small></div>
        <div className="volume-shape-control" role="group" aria-label="Object shape">
          <button className={shape === "cube" ? "active" : ""} onClick={() => { if (shape === "cube") return; setShape("cube"); setSelected({ front: tiles[0]?.id, right: tiles[1]?.id }); setRecipe(null); setActiveFace(null); setActiveRecord(null); setSaved(false); }}>CUBE</button>
          <button className={shape === "hex-prism" ? "active" : ""} onClick={() => { if (shape === "hex-prism") return; setShape("hex-prism"); setSelected({ side1: tiles[0]?.id, side3: tiles[1]?.id }); setRecipe(null); setActiveFace(null); setActiveRecord(null); setSaved(false); }}>HEX PRISM</button>
        </div>
        <div ref={faceList} className="volume-face-list">
          {facesForShape(shape).map(name => {
            const current = available.get(selected[name] ?? -1);
            const open = activeFace === name;
            return <div key={name} className={`volume-face-row ${open ? "open" : ""}`}>
              <span className="volume-face-name">{name.startsWith("side") ? `SIDE ${name.slice(4)}` : name.toUpperCase()}</span>
              <button type="button" className="volume-face-trigger" aria-label={`${name} face: ${current ? `Tile ${String(current.id).padStart(2, "0")}` : "empty"}`} aria-expanded={open} aria-controls={`volume-options-${name}`} onClick={() => setActiveFace(open ? null : name)}>
                {current ? <TileThumbnail tile={current}/> : <span className="volume-no-image"><Box size={18}/></span>}
                <span className="volume-selected-name">{current ? `TILE ${String(current.id).padStart(2, "0")}` : "EMPTY"}<small>{current?.name ?? "No vector"}</small></span>
                <ChevronDown size={15}/>
              </button>
              {open && <div id={`volume-options-${name}`} className="volume-face-menu" role="group" aria-label={`Choose vector for ${name} face`}>
                <button type="button" className={!current ? "active" : ""} onClick={() => { setSelected(previous => ({ ...previous, [name]: undefined })); setActiveFace(null); }}><span className="volume-no-image"><X size={16}/></span><span className="volume-option-name">EMPTY<small>No vector</small></span>{!current && <Check size={14}/>}</button>
                {tiles.map(tile => <button type="button" key={tile.id} className={current?.id === tile.id ? "active" : ""} onClick={() => { setSelected(previous => ({ ...previous, [name]: tile.id })); setActiveFace(null); }}><TileThumbnail tile={tile}/><span className="volume-option-name">TILE {String(tile.id).padStart(2, "0")}<small>{tile.name}</small></span>{current?.id === tile.id && <Check size={14}/>}</button>)}
              </div>}
            </div>;
          })}
        </div>
        <div className="volume-setting"><label htmlFor="volume-seed">VARIATION SEED</label><input id="volume-seed" type="number" min="0" max="9999" value={seed} onChange={event => setSeed(Number(event.target.value) || 0)}/></div>
        <div className="volume-setting"><label htmlFor="volume-fit">SEAM FLEXIBILITY <b>{fitTolerance}</b></label><input id="volume-fit" type="range" min="0" max="70" value={fitTolerance} onChange={event => setFitTolerance(Number(event.target.value))}/></div>
        <div className="volume-action-row"><button className="volume-primary" onClick={() => createRecipe()}><Sparkles size={15}/>GENERATE VOLUME</button><button className="volume-icon" title="Try another variation" aria-label="Try another variation" onClick={() => { const next = seed + 1; setSeed(next); createRecipe(next); }}><RotateCcw size={17}/></button></div>
        <div className="volume-library"><div className="volume-rail-heading"><strong>SAVED OBJECTS</strong><small>{records.length}</small></div>
          {records.length ? records.slice().reverse().map(record => <div key={record.id} className={`volume-record ${activeRecord === record.id ? "active" : ""}`}>
            <button onClick={() => openRecord(record)}><Box size={14}/><span>{record.name}<small>{record.shape === "hex-prism" ? "HEX" : "CUBE"} · {Object.keys(record.faces).length} faces · seed {record.seed}</small></span><ChevronRight size={14}/></button>
            <button className="volume-delete" title={`Delete ${record.name}`} aria-label={`Delete ${record.name}`} onClick={() => { if (window.confirm(`Permanently delete ${record.name}?`)) { if (!onDelete(record.id)) { setError("This object is used in a cube-builder assembly. Remove it there before deleting."); return; } if (activeRecord === record.id) { setActiveRecord(null); setSaved(false); } } }}><Trash2 size={14}/></button>
          </div>) : <p className="volume-empty">No saved objects yet.</p>}
        </div>
      </aside>
      <section className="volume-stage" aria-label="3D volume preview">
        <div ref={canvasHost} className="volume-canvas"/>
        {activeFace && <div className="volume-face-indicator"><span/> EDITING {activeFace.startsWith("side") ? `SIDE ${activeFace.slice(4)}` : activeFace.toUpperCase()} FACE</div>}
        {!recipe && !error && <div className="volume-stage-empty"><Box size={28}/><strong>READY FOR FACE ASSIGNMENT</strong><span>Select approved vectors and generate a volume.</span></div>}
        {error && <div className="volume-error" role="alert">{error}</div>}
        <div className="volume-stage-controls">
          <div className="volume-control-set"><button className={ghosted && !clipEnabled ? "active" : ""} disabled={clipEnabled} onClick={() => setGhosted(true)} title={clipEnabled ? "Clipping uses a solid view" : "Ghosted mesh"}><Eye size={16}/> GHOSTED</button><button className={!ghosted || clipEnabled ? "active" : ""} onClick={() => setGhosted(false)} title="Solid mesh"><Box size={16}/> SOLID</button></div>
          <button className={showGuides ? "active" : ""} onClick={() => setShowGuides(value => !value)} title="Show or hide source vectors">{showGuides ? <Eye size={16}/> : <EyeOff size={16}/>} FACES</button>
          <button onClick={resetView} title="Fit object in view"><Maximize size={16}/></button>
        </div>
        <div className="volume-stage-meta">{recipe ? `${Object.keys(recipe.faces).length} FACE CONSTRAINTS · ${faceFit ?? "…"}% FACE FIT · AMBER = ADJUSTED EDGE` : "ORBIT · PAN · ZOOM"}</div>
      </section>
      <aside className="volume-inspector">
        <div className="volume-rail-heading"><Scissors size={16}/><strong>INTERIOR VIEW</strong></div>
        <label className="volume-check"><input type="checkbox" checked={clipEnabled} onChange={event => setClipEnabled(event.target.checked)}/><span>Clipping plane</span></label>
        <div className="volume-axis" role="group" aria-label="Clipping plane axis">{(["x", "y", "z"] as const).map(axis => <button key={axis} className={clipAxis === axis ? "active" : ""} onClick={() => setClipAxis(axis)}>{axis.toUpperCase()}</button>)}</div>
        <div className="volume-setting"><label htmlFor="clip-position">PLANE POSITION <b>{clipPosition.toFixed(2)}</b></label><input id="clip-position" type="range" min="-0.96" max="0.96" step="0.01" value={clipPosition} disabled={!clipEnabled} onChange={event => setClipPosition(Number(event.target.value))}/></div>
        {clipEnabled && <div className="volume-cut-key"><i/> CUT MASS</div>}
        <div className="volume-inspector-rule"/>
        <div className="volume-rail-heading"><strong>GENERATED OBJECT</strong></div>
        {recipe ? <div className="volume-recipe">
          {facesForShape(recipe.shape).filter(name => recipe.faces[name]).map(name => <div key={name}><span>{name}</span><strong>TILE {String(recipe.faces[name]!.tileId).padStart(2, "0")}</strong></div>)}
          <div><span>Form</span><strong>{recipe.shape === "hex-prism" ? "Hex prism" : "Cube"}</strong></div>
          <div><span>Seed</span><strong>{recipe.seed}</strong></div>
          <div><span>Seam flexibility</span><strong>{recipe.fitTolerance}</strong></div>
        </div> : <p className="volume-empty">No generated object selected.</p>}
        <button className="volume-save" disabled={!recipe || saved} onClick={() => { if (recipe) { onSave(recipe); setSaved(true); } }}>{saved ? <Check size={16}/> : <Save size={16}/>} {saved ? "SAVED TO LIBRARY" : "SAVE AS NEW OBJECT"}</button>
        <p className="volume-note">Saved objects retain their source vectors and generation settings. Changes to face selections require generating a new preview.</p>
      </aside>
    </div>
  </div>;
}
