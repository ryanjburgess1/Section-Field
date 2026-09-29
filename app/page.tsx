"use client";

import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import {
  CorrectionEditor,
  CorrectionGeometry,
  type Correction,
} from "@/components/correction-editor";
import { readDraft, writeDraft, acknowledgeDraft } from "@/lib/project-draft";
import { createProjectBundle, readProjectBundle } from "@/lib/project-bundle";
import { ConnectionStudy } from "@/components/connection-study";
import type { VolumeRecipe, VolumeRecord } from "@/lib/volume-study";
import { emptyBuilderDraft, type AssemblyRecord, type BuilderDraft } from "@/lib/cube-builder";
import { initialJointStudies, jointVariations, type JointStudy } from "@/lib/joint-studies";
import type { ExtensionStudy } from "@/lib/extension-studies";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  Maximize2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const VolumeStudy = lazy(() => import("@/components/volume-study").then(module => ({ default: module.VolumeStudy })));
const CubeBuilder = lazy(() => import("@/components/cube-builder").then(module => ({ default: module.CubeBuilder })));

type Category = "lobby" | "gathering" | "office";
type Scores = {
  branching: number;
  porosity: number;
  complexity: number;
  density: number;
};
type VectorStatus =
  "inferred" | "ambiguous" | "corrected" | "confirmed" | "preserved";
type VectorTool = "select" | "mass" | "void" | "line" | "rectangle" | "pan";
type VectorPoint = { x: number; y: number };
type VectorPrimitive = {
  id: string;
  kind: "mass" | "void" | "line";
  points: VectorPoint[];
  closed: boolean;
};
type Operation =
  | "union"
  | "subtract"
  | "priority"
  | "intersection"
  | "overlap"
  | "bridge"
  | "void";
type Tile = {
  correction?: Correction;
  id: number;
  name: string;
  src: string;
  scores: Scores;
  status: VectorStatus;
  approved: boolean;
  confidence: number;
  note: string;
  vectorThreshold?: number;
  vectorShapes?: VectorPrimitive[];
  vectorDraft?: { tool: VectorTool; points: VectorPoint[] };
  vectorViewport?: { zoom: number; x: number; y: number };
  openingCount?: number;
  criteriaReviewed?: Partial<Record<keyof Scores, boolean>>;
};
type VectorTrace = {
  solid: string;
  uncertaintyLow: string;
  uncertaintyHigh: string;
  branches: string;
  solidRatio: number;
};
type VectorLibrary = {
  proposals?: Record<string, Correction>;
  grid: number;
  thresholds: number[];
  tiles: Record<string, Record<string, VectorTrace>>;
};
type Transform = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  mirror: boolean;
  crop: number;
};
type Step = {
  id: string;
  tileId: number;
  operation: Operation | "base";
  transform: Transform;
  review: boolean;
};
type AnnotationShape = "rectangle" | "brush" | "polyline";
type AnalysisRegion = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  categories: Category[];
  author: "program" | "human";
  confidence: number;
  shape?: AnnotationShape;
};
type Milestone = {
  version: number;
  name: string;
  savedAt: number;
  snapshot: string;
};
type SectionRecord = {
  id: string;
  number: number;
  name: string;
  categories: Category[];
  version: number;
  seed: string;
  unbounded: boolean;
  createdAt: number;
  steps: Step[];
  regions: AnalysisRegion[];
  criteria: Record<Category, Record<string, number>>;
  draft: boolean;
  milestones?: Milestone[];
};
type Settings = {
  categories: Category[];
  maxTiles: number;
  sectionCount: number;
  repetition: boolean;
  maxRepeats: number;
  seed: string;
  unbounded: boolean;
  allowUnreviewed: boolean;
};
type ProjectState = {
  tiles: Tile[];
  sections: SectionRecord[];
  jointStudies: JointStudy[];
  extensionStudies: ExtensionStudy[];
  volumes: VolumeRecord[];
  nextVolumeNumber: number;
  assemblies: AssemblyRecord[];
  assemblyDraft: BuilderDraft;
  nextAssemblyNumber: number;
  nextNumber: number;
  settings: Settings;
  learned: Record<Category, Partial<Scores>>;
};

const scoreNames: (keyof Scores)[] = [
  "branching",
  "porosity",
  "complexity",
  "density",
];
const criterionLabels: Record<keyof Scores, string> = {
  branching: "Branching",
  porosity: "Porosity",
  complexity: "Complexity",
  density: "Spatial density",
};
const criterionDefinitions: Record<keyof Scores, string> = {
  branching:
    "Physical connective pieces between massings. More connectors and junctions score higher.",
  porosity:
    "Number of distinct spaces within the tile. Several tiny openings score higher than one large opening; area does not affect this value.",
  complexity: "Variety of shapes, boundaries, and spatial relationships.",
  density:
    "How compressed or open the spaces feel. High values mean tight, compressed spaces.",
};
const criterionEnds: Record<keyof Scores, [string, string]> = {
  branching: ["Few connectors", "Many connectors"],
  porosity: ["Few spaces", "Many spaces"],
  complexity: ["Simple / repetitive", "Varied / intricate"],
  density: ["Open", "Compressed"],
};
function porosityScore(count: number) {
  return (100 * count) / (count + 5);
}
const categories: Category[] = ["lobby", "gathering", "office"];
const operations: Operation[] = [
  "union",
  "subtract",
  "priority",
  "intersection",
  "overlap",
  "bridge",
  "void",
];
const colors: Record<Category, string> = {
  lobby: "#ff2f9b",
  gathering: "#21d4cf",
  office: "#ffb020",
};
const initialScores = (): Scores => ({
  branching: 50,
  porosity: 50,
  complexity: 50,
  density: 50,
});
const initialTiles: Tile[] = Array.from({ length: 48 }, (_, i) => ({
  id: i + 1,
  name: `IMG_${5204 + i}`,
  src: `/assets/IMG_${5204 + i}.png`,
  scores: initialScores(),
  criteriaReviewed: {},
  status: i % 9 === 0 ? "ambiguous" : "inferred",
  approved: false,
  confidence: 62 + ((i * 7) % 33),
  note: "Tone, material, and depth cues require review.",
  vectorThreshold: 95,
}));
const initialSettings: Settings = {
  categories: ["office"],
  maxTiles: 8,
  sectionCount: 3,
  repetition: false,
  maxRepeats: 2,
  seed: "section-field-01",
  unbounded: false,
  allowUnreviewed: true,
};
const defaultProject: ProjectState = {
  tiles: initialTiles,
  sections: [],
  jointStudies: initialJointStudies(),
  extensionStudies: [],
  volumes: [],
  nextVolumeNumber: 1,
  assemblies: [],
  assemblyDraft: emptyBuilderDraft(),
  nextAssemblyNumber: 1,
  nextNumber: 1,
  settings: initialSettings,
  learned: { lobby: {}, gathering: {}, office: {} },
};

function hashSeed(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++)
    h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: string) {
  let a = hashSeed(seed);
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function categoryScore(tile: Tile, selected: Category[]) {
  const s = Object.fromEntries(
    scoreNames.map((key) => [
      key,
      key === "porosity"
        ? tile.openingCount === undefined
          ? 50
          : porosityScore(tile.openingCount)
        : tile.criteriaReviewed?.[key]
          ? tile.scores[key]
          : 50,
    ]),
  ) as Scores;
  return (
    selected.reduce(
      (sum, c) =>
        c === "lobby"
          ? sum +
            s.porosity * 0.08 +
            s.branching * 0.26 +
            (100 - s.density) * 0.5 +
            s.complexity * 0.16
          : c === "gathering"
            ? sum +
              s.branching * 0.38 +
              (100 - Math.abs(52 - s.density)) * 0.3 +
              s.porosity * 0.2 +
              s.complexity * 0.12
            : sum +
              s.density * 0.32 +
              s.complexity * 0.25 +
              (100 - s.porosity) * 0.25 +
              (100 - Math.abs(45 - s.branching)) * 0.18,
      0,
    ) / selected.length
  );
}
function traceFor(tile: Tile, vectors: VectorLibrary | null) {
  const choices = vectors?.thresholds ?? [];
  const requested = tile.vectorThreshold ?? 95;
  const threshold = choices.length
    ? choices.reduce((best, value) =>
        Math.abs(value - requested) < Math.abs(best - requested) ? value : best,
      )
    : requested;
  return vectors?.tiles[tile.name]?.[String(threshold)] ?? null;
}
function correctionFor(tile: Tile, vectors: VectorLibrary | null) {
  return tile.correction ?? vectors?.proposals?.[tile.name];
}
function hasVector(tile: Tile, vectors: VectorLibrary | null) {
  return !!correctionFor(tile, vectors)?.shapes.length;
}
function upgradeProject(project: ProjectState): ProjectState {
  const jointStudies = project.jointStudies ?? initialJointStudies();
  const flipped = jointStudies.find(study => study.id === "connection-01-study-15-flipped");
  const corrected = new Map(flipped ? jointVariations(flipped).map(study => [study.id, study] as const) : []);
  return {
    ...project,
    jointStudies: jointStudies.map(study => {
      const expected = corrected.get(study.id);
      const pose = study.poses[1], nextPose = expected?.poses[1];
      const outdated = nextPose && (pose.x !== nextPose.x || pose.y !== nextPose.y ||
        pose.angle !== nextPose.angle || pose.scale !== nextPose.scale || pose.mirror !== nextPose.mirror);
      return outdated && expected && !study.rating && !study.note && !study.tags.length
        ? { ...study, poses: expected.poses, geometryPass: undefined }
        : study;
    }),
    extensionStudies: project.extensionStudies ?? [],
    volumes: project.volumes ?? [],
    nextVolumeNumber: project.nextVolumeNumber ?? (project.volumes?.length ?? 0) + 1,
    assemblies: project.assemblies ?? [],
    assemblyDraft: project.assemblyDraft ?? emptyBuilderDraft(),
    nextAssemblyNumber: project.nextAssemblyNumber ?? (project.assemblies?.length ?? 0) + 1,
    tiles: project.tiles.map((tile) =>
      tile.correction
        ? tile
        : {
            ...tile,
            approved: false,
            status: "inferred",
            vectorShapes: undefined,
            vectorDraft: undefined,
          },
    ),
  };
}
function primitivePath(shape: VectorPrimitive) {
  if (!shape.points.length) return "";
  return `${shape.points
    .map(
      (point, index) =>
        `${index ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ")}${shape.closed ? " Z" : ""}`;
}

function ManualVectorGeometry({
  shapes,
  id,
  fill = "#fff",
  editor = false,
}: {
  shapes: VectorPrimitive[];
  id: string;
  fill?: string;
  editor?: boolean;
}) {
  const masses = shapes.filter((shape) => shape.kind === "mass");
  const voids = shapes.filter((shape) => shape.kind === "void");
  const lines = shapes.filter((shape) => shape.kind === "line");
  return (
    <>
      <defs>
        <mask
          id={id}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="100"
          height="100"
          style={{ maskType: "luminance" }}
        >
          <rect width="100" height="100" fill="black" />
          {masses.map((shape) => (
            <path key={shape.id} d={primitivePath(shape)} fill="white" />
          ))}
          {voids.map((shape) => (
            <path key={shape.id} d={primitivePath(shape)} fill="black" />
          ))}
        </mask>
      </defs>
      <rect width="100" height="100" fill={fill} mask={`url(#${id})`} />
      {lines.map((shape) => (
        <path
          key={shape.id}
          d={primitivePath(shape)}
          fill="none"
          stroke={fill}
          strokeWidth={editor ? 1 : 1.1}
          vectorEffect={editor ? "non-scaling-stroke" : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
}
function categoriesLabel(list: Category[]) {
  return list.map((x) => x[0].toUpperCase() + x.slice(1)).join(" + ");
}

function VectorMotif({
  tile,
  vectors,
  className = "",
  uncertainty = true,
}: {
  tile: Tile;
  vectors: VectorLibrary | null;
  className?: string;
  uncertainty?: boolean;
}) {
  const maskId = useId().replaceAll(":", "");
  const trace = traceFor(tile, vectors);
  const statusColor =
    tile.status === "confirmed"
      ? "#fff"
      : tile.status === "ambiguous"
        ? "#8f7cff"
        : tile.status === "corrected"
          ? "#21d4cf"
          : "#ff2f9b";
  const hasManualVector = Array.isArray(tile.vectorShapes);
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-label={`Vector motif for ${tile.name}`}
    >
      {correctionFor(tile, vectors) ? (
        <CorrectionGeometry correction={correctionFor(tile, vectors)!} />
      ) : hasManualVector ? (
        <ManualVectorGeometry
          shapes={tile.vectorShapes ?? []}
          id={`motif-${maskId}`}
        />
      ) : trace ? (
        uncertainty ? (
          <path
            d={trace.solid}
            fill="none"
            stroke={statusColor}
            strokeWidth=".7"
            strokeDasharray="1.2 1.8"
            opacity=".8"
          />
        ) : null
      ) : (
        <text x="50" y="52" textAnchor="middle" fill="#777" fontSize="5">
          TRACING
        </text>
      )}
    </svg>
  );
}

export default function Home() {
  const [project, setProject] = useState<ProjectState>(defaultProject);
  const [vectors, setVectors] = useState<VectorLibrary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("Loading project…");
  const [stage, setStage] = useState<1 | 2>(1);
  const [selectedTileId, setSelectedTileId] = useState(1);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<"raster" | "svg" | "overlay">(
    "overlay",
  );
  const [uncertainty, setUncertainty] = useState(true);
  const [spaceAnalysis, setSpaceAnalysis] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [connectionStudy, setConnectionStudy] = useState(false);
  const [volumeStudy, setVolumeStudy] = useState(false);
  const [cubeBuilder, setCubeBuilder] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [bundleBusy, setBundleBusy] = useState(false);
  const [bundleStatus, setBundleStatus] = useState("");
  const importInput = useRef<HTMLInputElement | null>(null);
  const [presentation, setPresentation] = useState(false);
  const [unboundedPrompt, setUnboundedPrompt] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const currentRevision = useRef("");
  const explicitlySaving = useRef<ProjectState | null>(null);
  const selectedTile =
    project.tiles.find((t) => t.id === selectedTileId) ?? project.tiles[0];
  const selectedSection =
    project.sections.find((s) => s.id === selectedSectionId) ??
    project.sections[0] ??
    null;
  const usableTiles=project.tiles.filter(t=>hasVector(t,vectors)&&(t.approved||((project.settings.allowUnreviewed??true)&&t.status!=="ambiguous")));

  useEffect(() => {
    Promise.all([
      fetch("/vectors/tile-vectors.json").then((r) => r.json()),
      fetch("/vectors/correction-proposals.json").then((r) => r.json()),
    ])
      .then(([data, proposals]) =>
        setVectors({
          ...(data as VectorLibrary),
          proposals: proposals as Record<string, Correction>,
        }),
      )
      .catch(() => setVectors(null));
    Promise.all([
      fetch("/api/state")
        .then((r) => {
          if (!r.ok) throw Error();
          return r.json();
        })
        .catch(() => ({ unavailable: true })),
      readDraft().catch(() => undefined),
    ])
      .then(([value, local]) => {
        const data = value as { payload?: ProjectState; unavailable?: boolean };
        const recovered = local?.dirty
          ? local.payload
          : (data.payload ?? local?.payload);
        if (recovered) setProject(upgradeProject(recovered as ProjectState));
        setLoaded(true);
        setSaveState(
          data.unavailable
            ? "Local preview · cloud save on publish"
            : "Project loaded",
        );
      })
      .catch(() => {
        setLoaded(true);
        setSaveState("Offline draft");
      });
  }, []);
  useEffect(() => {
    if (!loaded) return;
    if (explicitlySaving.current === project) {
      explicitlySaving.current = null;
      return;
    }
    const revision = crypto.randomUUID();
    currentRevision.current = revision;
    let localSaved = false;
    const localWrite = writeDraft(project, revision)
      .then(() => {
        localSaved = true;
      })
      .catch(() => {});
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("Saving draft…");
    saveTimer.current = setTimeout(() => {
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(async () => {
          await localWrite;
          return fetch("/api/state", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(project),
          })
            .then(async (r) => {
              if (!r.ok) throw new Error();
              await acknowledgeDraft(revision).catch(() => {});
              if (currentRevision.current === revision)
                setSaveState("Draft saved");
            })
            .catch(() => {
              if (currentRevision.current === revision)
                setSaveState(
                  localSaved
                    ? "Saved locally · cloud save pending"
                    : "Save failed · keep this page open",
                );
            });
        });
    }, 900);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [project, loaded]);

  async function saveConfirmedProject(snapshot: ProjectState): Promise<"site" | "local" | "failed"> {
    const previous = project;
    const revision = crypto.randomUUID();
    if (saveTimer.current) clearTimeout(saveTimer.current);
    explicitlySaving.current = snapshot;
    currentRevision.current = revision;
    setProject(snapshot);
    setSaveState("Saving confirmed reviews…");
    const save = saveQueue.current.catch(() => {}).then(async () => {
      let localSaved = false;
      try {
        await writeDraft(snapshot, revision);
        localSaved = true;
      } catch { /* The site save may still succeed. */ }
      try {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(snapshot),
        });
        if (!response.ok) throw Error("Site save failed");
        await acknowledgeDraft(revision).catch(() => {});
        if (currentRevision.current === revision) setSaveState("Confirmed reviews saved");
        return "site" as const;
      } catch {
        if (currentRevision.current === revision)
          setSaveState(localSaved ? "Confirmed locally · site sync pending" : "Save failed · keep this page open");
        if (!localSaved)
          setProject(current => current === snapshot
            ? previous
            : current);
        return localSaved ? "local" as const : "failed" as const;
      }
    });
    saveQueue.current = save.then(() => {});
    return save;
  }

  async function exportProject() {
    setProjectMenuOpen(false);
    setBundleBusy(true);
    setBundleStatus("Preparing project bundle…");
    try {
      const blob = await createProjectBundle(project, (done, total) =>
        setBundleStatus(`Packaging source assets ${done}/${total}…`),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Section-Field-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setBundleStatus("Project bundle downloaded");
    } catch (error) {
      setBundleStatus(error instanceof Error ? error.message : "Export failed");
    } finally {
      setBundleBusy(false);
    }
  }

  async function importProject(file: File) {
    setProjectMenuOpen(false);
    setBundleBusy(true);
    setBundleStatus("Checking project bundle…");
    try {
      const imported = upgradeProject(await readProjectBundle(file) as ProjectState);
      const approved = imported.tiles.filter((tile) => tile.approved).length;
      const confirmed = window.confirm(
        `Import ${file.name}?\n\nThis will replace your current project with ${approved} approved tiles, ` +
        `${imported.sections.length} sections, ${imported.volumes.length} 3D objects, and ` +
        `${imported.assemblies.length} cube assemblies. Export your current project first if you need a backup.`,
      );
      if (!confirmed) {
        setBundleStatus("Import canceled");
        return;
      }
      setBundleStatus("Saving imported project…");
      const result = await saveConfirmedProject(imported);
      if (result === "failed") throw new Error("Could not save the imported project.");
      setSelectedTileId(1);
      setSelectedSectionId(null);
      setStage(1);
      setBundleStatus(result === "site" ? "Project imported and saved online" : "Imported locally · site sync pending");
    } catch (error) {
      setBundleStatus(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBundleBusy(false);
      if (importInput.current) importInput.current.value = "";
    }
  }

  function confirmJointReviews(jointStudies: JointStudy[]) {
    return saveConfirmedProject({ ...project, jointStudies });
  }

  function confirmExtensionReviews(extensionStudies: ExtensionStudy[]) {
    return saveConfirmedProject({ ...project, extensionStudies });
  }

  function saveVolume(recipe: VolumeRecipe) {
    setProject(current => {
      const number = current.nextVolumeNumber;
      const record: VolumeRecord = {
        ...structuredClone(recipe),
        id: crypto.randomUUID(),
        name: `Object ${String(number).padStart(2, "0")}`,
        createdAt: Date.now(),
        generatorVersion: 1,
      };
      return { ...current, volumes: [...current.volumes, record], nextVolumeNumber: number + 1 };
    });
  }

  function deleteVolume(id: string) {
    const inUse = project.assemblyDraft.blocks.some(block => block.volumeId === id) ||
      project.assemblies.some(assembly => assembly.blocks.some(block => block.volumeId === id));
    if (inUse) return false;
    setProject(current => ({ ...current, volumes: current.volumes.filter(record => record.id !== id) }));
    return true;
  }

  function saveAssembly(record: AssemblyRecord) {
    setProject(current => {
      const exists = current.assemblies.some(saved => saved.id === record.id);
      return {
        ...current,
        assemblies: exists ? current.assemblies.map(saved => saved.id === record.id ? record : saved) : [...current.assemblies, record],
        nextAssemblyNumber: current.nextAssemblyNumber + (exists ? 0 : 1),
      };
    });
  }
  useEffect(() => {
    const mc = (
      document as Document & {
        modelContext?: { registerTool: (x: unknown) => void };
      }
    ).modelContext;
    if (!mc?.registerTool) return;
    try {
      Promise.resolve(
        mc.registerTool({
          name: "read_section_archive",
          title: "Read section archive",
          description: "List saved generated sections and their categories.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: () =>
            project.sections.map((s) => ({
              id: s.id,
              name: s.name,
              categories: s.categories,
              version: s.version,
            })),
        }),
      ).catch(() => {});
    } catch {}
  }, [project.sections]);

  const updateTile = (patch: Partial<Tile>) =>
    setProject((p) => ({
      ...p,
      tiles: p.tiles.map((t) =>
        t.id === selectedTile.id ? { ...t, ...patch } : t,
      ),
    }));
  const updateSection = (patch: Partial<SectionRecord>) => {
    if (!selectedSection) return;
    setProject((p) => ({
      ...p,
      sections: p.sections.map((s) =>
        s.id === selectedSection.id ? { ...s, ...patch, draft: true } : s,
      ),
    }));
  };
  const updateSettings = (patch: Partial<Settings>) =>
    setProject((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  function toggleCategory(c: Category) {
    const current = project.settings.categories;
    const next = current.includes(c)
      ? current.filter((x) => x !== c)
      : [...current, c];
    if (next.length) updateSettings({ categories: next });
  }
  function toggleUnbounded() {
    if (project.settings.unbounded) updateSettings({ unbounded: false });
    else setUnboundedPrompt(true);
  }

  function buildSection(number: number, seed: string): SectionRecord {
    const random = rng(seed);
    const settings = project.settings;
    const available = project.tiles.filter(
      (t) =>
        hasVector(t, vectors) &&
        (t.approved ||
          ((settings.allowUnreviewed ?? true) && t.status !== "ambiguous")),
    );
    const count = Math.max(
      1,
      Math.min(settings.maxTiles, Math.ceil(1 + random() * settings.maxTiles)),
    );
    const ranked = [...available].sort(
      (a, b) =>
        categoryScore(b, settings.categories) +
        random() * 28 -
        categoryScore(a, settings.categories),
    );
    const pool = settings.repetition
      ? Array.from({ length: settings.maxRepeats }, () => ranked).flat()
      : ranked;
    const chosen = pool.slice(0, count);
    const steps: Step[] = chosen.map((tile, i) => ({
      id: `${number}-${i}-${Math.floor(random() * 99999)}`,
      tileId: tile.id,
      operation:
        i === 0 ? "base" : operations[Math.floor(random() * operations.length)],
      review: i > 0 && random() > 0.62,
      transform: {
        x: 20 + random() * 56,
        y: 18 + random() * 62,
        rotation: Math.round(random() * 359),
        scale: settings.unbounded
          ? Math.round(10 + random() * 390)
          : Math.round(25 + random() * 175),
        mirror: random() > 0.6,
        crop: Math.round(random() * (settings.unbounded ? 78 : 50)),
      },
    }));
    const regions: AnalysisRegion[] = settings.categories.map((c, i) => ({
      id: `${number}-r-${i}`,
      x: 12 + i * 20 + random() * 12,
      y: 18 + random() * 40,
      w: 28 + random() * 22,
      h: 18 + random() * 28,
      categories:
        i === 0 && settings.categories.length > 1
          ? settings.categories.slice(0, 2)
          : [c],
      author: "program",
      confidence: Math.round(64 + random() * 31),
    }));
    const criteria = Object.fromEntries(
      categories.map((c) => [
        c,
        c === "lobby"
          ? { arrival: 72, verticalConnection: 68, orientation: 74 }
          : c === "gathering"
            ? { convergence: 78, collectiveVisibility: 70, encounter: 82 }
            : { repetition: 76, enclosure: 69, adaptability: 73 },
      ]),
    ) as unknown as SectionRecord["criteria"];
    return {
      id: `section-${number}-${hashSeed(seed)}`,
      number,
      name: `Section ${String(number).padStart(2, "0")}`,
      categories: [...settings.categories],
      version: 1,
      seed,
      unbounded: settings.unbounded,
      createdAt: Date.now(),
      steps,
      regions,
      criteria,
      draft: true,
      milestones: [],
    };
  }
  function generateSections() {
    if(!usableTiles.length)return;
    const made = Array.from({ length: project.settings.sectionCount }, (_, i) =>
      buildSection(
        project.nextNumber + i,
        `${project.settings.seed}-${project.nextNumber + i}`,
      ),
    );
    setProject((p) => ({
      ...p,
      sections: [...p.sections, ...made],
      nextNumber: p.nextNumber + made.length,
    }));
    setSelectedSectionId(made[0].id);
    setStage(2);
    setActiveStep(0);
  }
  function duplicateSection() {
    if (!selectedSection) return;
    const n = project.nextNumber;
    const copy: SectionRecord = {
      ...structuredClone(selectedSection),
      id: `section-${n}-${Date.now()}`,
      number: n,
      name: `Section ${String(n).padStart(2, "0")}`,
      version: 1,
      createdAt: Date.now(),
      draft: true,
      milestones: [],
    };
    setProject((p) => ({
      ...p,
      sections: [...p.sections, copy],
      nextNumber: n + 1,
    }));
    setSelectedSectionId(copy.id);
  }
  function regenerate() {
    if (!selectedSection) return;
    const seed =
      window.prompt("Seed for regenerated section", selectedSection.seed) ??
      selectedSection.seed;
    const n = project.nextNumber;
    const next = buildSection(n, seed);
    setProject((p) => ({
      ...p,
      sections: [...p.sections, next],
      nextNumber: n + 1,
    }));
    setSelectedSectionId(next.id);
  }
  function saveVersion() {
    if (!selectedSection) return;
    const name =
      window.prompt("Name this version", selectedSection.name) ||
      selectedSection.name;
    const nextVersion = selectedSection.version + 1;
    const snapshot = JSON.stringify({
      steps: selectedSection.steps,
      regions: selectedSection.regions,
      criteria: selectedSection.criteria,
      seed: selectedSection.seed,
      unbounded: selectedSection.unbounded,
    });
    setProject((p) => ({
      ...p,
      sections: p.sections.map((s) =>
        s.id === selectedSection.id
          ? {
              ...s,
              name,
              version: nextVersion,
              draft: false,
              milestones: [
                ...(s.milestones ?? []),
                { version: nextVersion, name, savedAt: Date.now(), snapshot },
              ],
            }
          : s,
      ),
    }));
  }
  function deleteSection() {
    if (
      !selectedSection ||
      !window.confirm(
        `Permanently delete ${selectedSection.name} and all of its versions? This cannot be undone.`,
      )
    )
      return;
    const remaining = project.sections.filter(
      (s) => s.id !== selectedSection.id,
    );
    setProject((p) => ({ ...p, sections: remaining }));
    setSelectedSectionId(remaining[0]?.id ?? null);
    if (!remaining.length) setStage(1);
  }
  function addHumanRegion(shape: AnnotationShape) {
    if (!selectedSection) return;
    const r: AnalysisRegion = {
      id: `human-${Date.now()}`,
      x: 28,
      y: 28,
      w: 32,
      h: 24,
      categories: [selectedSection.categories[0]],
      author: "human",
      confidence: 100,
      shape,
    };
    updateSection({ regions: [...selectedSection.regions, r] });
    const category = selectedSection.categories[0];
    setProject((p) => ({
      ...p,
      learned: {
        ...p.learned,
        [category]: {
          ...p.learned[category],
          density: Math.round((p.learned[category].density ?? 50) * 0.8 + 10),
        },
      },
    }));
  }

  if (!loaded)
    return (
      <div className="loading">
        <img className="project-logo" src="/fausoa-logo.png" alt="FAU School of Architecture" />
        <p>Opening project record</p>
      </div>
    );
  if (presentation && selectedSection)
    return (
      <Presentation
        section={selectedSection}
        tiles={project.tiles}
        vectors={vectors}
        analysis={spaceAnalysis}
        onExit={() => setPresentation(false)}
        onToggle={() => setSpaceAnalysis((x) => !x)}
      />
    );
  return (
    <main className="app-shell">
      {connectionStudy && <ConnectionStudy tiles={project.tiles.filter(t => t.approved && correctionFor(t, vectors)).map(t => ({ id: t.id, correction: correctionFor(t, vectors)! }))} studies={project.jointStudies} onStudiesChange={jointStudies => setProject(p => ({ ...p, jointStudies }))} onConfirmJoints={confirmJointReviews} extensions={project.extensionStudies} onExtensionsChange={extensionStudies => setProject(p => ({ ...p, extensionStudies }))} onConfirmExtensions={confirmExtensionReviews} onClose={() => setConnectionStudy(false)}/>}
      {volumeStudy && <Suspense fallback={<div className="volume-loading" role="status">Opening 3D object study…</div>}><VolumeStudy tiles={project.tiles.filter(t => t.approved && correctionFor(t, vectors)).map(t => ({ id: t.id, name: t.name, src: t.src, correction: correctionFor(t, vectors)! }))} records={project.volumes} onSave={saveVolume} onDelete={deleteVolume} onClose={() => setVolumeStudy(false)}/></Suspense>}
      {cubeBuilder && <Suspense fallback={<div className="volume-loading" role="status">Opening cube builder…</div>}><CubeBuilder records={project.volumes} assemblies={project.assemblies} draft={project.assemblyDraft} nextNumber={project.nextAssemblyNumber} onDraftChange={assemblyDraft => setProject(current => ({ ...current, assemblyDraft }))} onSave={saveAssembly} onDelete={id => setProject(current => ({ ...current, assemblies: current.assemblies.filter(record => record.id !== id) }))} onClose={() => setCubeBuilder(false)}/></Suspense>}
      <header className="topbar">
        <div className="brand">
          <img className="project-logo" src="/fausoa-logo.png" alt="FAU School of Architecture" />
          <div>
            <b>SECTION FIELD</b>
            <small>PROTO-ARCHITECTURAL WORKSPACE</small>
          </div>
        </div>
        <div className="phase-switch">
          <button onClick={() => setConnectionStudy(true)}>CONNECTION STUDY</button>
          <button onClick={() => setVolumeStudy(true)}>3D OBJECT STUDY</button>
          <button onClick={() => setCubeBuilder(true)}>CUBE BUILDER</button>
          <button
            className={stage === 1 ? "active" : ""}
            onClick={() => setStage(1)}
          >
            <i>01</i> DEFINE + SELECT
          </button>
          <button
            disabled={!project.sections.length}
            className={stage === 2 ? "active" : ""}
            onClick={() => setStage(2)}
          >
            <i>02</i> GENERATE + EVALUATE
          </button>
        </div>
        <div className="header-actions">
          <span className="save-state" role="status">{bundleStatus || saveState}</span>
          <div className="project-menu-wrap">
            <button className="project-menu-trigger" type="button" aria-expanded={projectMenuOpen} onClick={() => setProjectMenuOpen((value) => !value)} disabled={!loaded || bundleBusy}>
              PROJECT <ChevronDown size={13} />
            </button>
            {projectMenuOpen && <div className="project-menu">
              <button type="button" onClick={exportProject}><Download size={15} /> Export project bundle</button>
              <button type="button" onClick={() => { setProjectMenuOpen(false); importInput.current?.click(); }}><Upload size={15} /> Import project bundle</button>
            </div>}
            <input ref={importInput} type="file" accept=".zip,application/zip" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void importProject(file); }} />
          </div>
          {project.sections.length > 0 && (
            <SectionPicker
              sections={project.sections}
              current={selectedSection}
              open={pickerOpen}
              setOpen={setPickerOpen}
              onSelect={(id: string) => {
                setSelectedSectionId(id);
                setStage(2);
                setPickerOpen(false);
              }}
              onArchive={() => {
                setArchiveOpen(true);
                setPickerOpen(false);
              }}
            />
          )}
        </div>
      </header>
      {stage === 1 ? (
        <DefineStage
          project={project}
          tile={selectedTile}
          vectors={vectors}
          viewMode={viewMode}
          uncertainty={uncertainty}
          onView={setViewMode}
          onUncertainty={setUncertainty}
          onTile={setSelectedTileId}
          onTileUpdate={updateTile}
          onSettings={updateSettings}
          onCategory={toggleCategory}
          onUnbounded={toggleUnbounded}
          saveState={saveState}
        />
      ) : selectedSection ? (
        <EditorStage
          section={selectedSection}
          tiles={project.tiles}
          vectors={vectors}
          activeStep={activeStep}
          setActiveStep={setActiveStep}
          viewMode={viewMode}
          setViewMode={setViewMode}
          uncertainty={uncertainty}
          setUncertainty={setUncertainty}
          analysis={spaceAnalysis}
          setAnalysis={setSpaceAnalysis}
          update={updateSection}
          addRegion={addHumanRegion}
          present={() => setPresentation(true)}
        />
      ) : null}
      {stage === 1 && (
        <div className="continue-bar">
          <div>
            <span>
              {project.settings.categories.length} TARGET
              {project.settings.categories.length > 1 ? "S" : ""}
            </span>
            <b>{categoriesLabel(project.settings.categories)}</b>
          </div>
          <button
            disabled={!usableTiles.length}
            onClick={generateSections}
          >
            {usableTiles.length
              ? `GENERATE ${project.settings.sectionCount} SECTION${project.settings.sectionCount > 1 ? "S" : ""}`
              : "REVIEW A VECTOR TO GENERATE"}
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      {stage === 2 && selectedSection && (
        <div className="editor-actions">
          <button onClick={duplicateSection}>
            <Copy size={15} />
            Duplicate
          </button>
          <button onClick={regenerate}>
            <RefreshCw size={15} />
            Regenerate
          </button>
          <button onClick={() => setStage(1)}>
            <Plus size={15} />
            New Run
          </button>
          <button className="primary" onClick={saveVersion}>
            <Save size={15} />
            Save Version
          </button>
          <button
            className="danger"
            title="Permanently delete"
            onClick={deleteSection}
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
      {archiveOpen && (
        <ArchivePanel
          sections={project.sections}
          onClose={() => setArchiveOpen(false)}
          onSelect={(id: string) => {
            setSelectedSectionId(id);
            setStage(2);
            setArchiveOpen(false);
          }}
        />
      )}{" "}
      {unboundedPrompt && (
        <div className="modal-backdrop">
          <div className="warning-modal">
            <Sparkles size={34} />
            <span>REALITY HAS LEFT THE BUILDING</span>
            <h2>Enable Unbounded Transformations?</h2>
            <p>
              Scale and crop limits will be released for this run. The resulting
              sections may be unreasonable, unruly, or unexpectedly useful. This
              choice will be recorded.
            </p>
            <div>
              <button onClick={() => setUnboundedPrompt(false)}>
                Keep physics
              </button>
              <button
                className="primary"
                onClick={() => {
                  updateSettings({ unbounded: true });
                  setUnboundedPrompt(false);
                }}
              >
                Yes, release the geometry
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ModeControl({
  value,
  onChange,
}: {
  value: "raster" | "svg" | "overlay";
  onChange: (v: "raster" | "svg" | "overlay") => void;
}) {
  return (
    <div className="mode-control">
      {(["raster", "svg", "overlay"] as const).map((x) => (
        <button
          key={x}
          className={value === x ? "active" : ""}
          onClick={() => onChange(x)}
        >
          {x}
        </button>
      ))}
    </div>
  );
}

function DefineStage({
  project,
  tile,
  vectors,
  viewMode,
  uncertainty,
  onView,
  onUncertainty,
  onTile,
  onTileUpdate,
  onSettings,
  onCategory,
  onUnbounded,
  saveState,
}: any) {
  const s: Settings = project.settings;
  const [editorOpen, setEditorOpen] = useState(false);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!editorOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditorOpen(false);
      if (event.key === "Tab") {
        const items = Array.from(
          modalRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input, textarea, select, [tabindex="0"]',
          ) ?? [],
        ).filter(
          (item) =>
            item.getBoundingClientRect().height &&
            getComputedStyle(item).visibility !== "hidden",
        );
        const first = items[0];
        const last = items.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === modalRef.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("keydown", close);
      previous?.focus({ preventScroll: true });
    };
  }, [editorOpen]);
  return (
    <div className="workspace define-workspace">
      <aside className="rail left-rail">
        <PanelTitle n="A" title="GENERATION TARGET" />
        <div className="target-grid">
          {categories.map((c) => (
            <button
              key={c}
              className={s.categories.includes(c) ? `selected ${c}` : ""}
              onClick={() => onCategory(c)}
            >
              <i style={{ background: colors[c] }} />
              {c}
            </button>
          ))}
        </div>
        <PanelTitle n="B" title="RUN PARAMETERS" />
        <NumberControl
          label="Maximum tiles per section"
          value={s.maxTiles}
          min={1}
          max={project.tiles.length}
          onChange={(maxTiles: number) => onSettings({ maxTiles })}
        />
        <NumberControl
          label="Number of sections"
          value={s.sectionCount}
          min={1}
          max={20}
          onChange={(sectionCount: number) => onSettings({ sectionCount })}
        />
        <label className="switch-row">
          <span>Allow tile repetition</span>
          <input
            type="checkbox"
            checked={s.repetition}
            onChange={(e) => onSettings({ repetition: e.target.checked })}
          />
        </label>
        {s.repetition && (
          <NumberControl
            label="Maximum repeats per tile"
            value={s.maxRepeats}
            min={2}
            max={12}
            onChange={(maxRepeats: number) => onSettings({ maxRepeats })}
          />
        )}
        <label className="switch-row">
          <span>Allow unreviewed vectors</span>
          <input
            type="checkbox"
            checked={s.allowUnreviewed ?? true}
            onChange={(e) => onSettings({ allowUnreviewed: e.target.checked })}
          />
        </label>
        <label className="field-label">
          GENERATION SEED
          <input
            value={s.seed}
            onChange={(e) => onSettings({ seed: e.target.value })}
          />
        </label>
        <button
          className={`unbounded-toggle ${s.unbounded ? "on" : ""}`}
          onClick={onUnbounded}
        >
          <Sparkles size={15} />
          <span>
            <b>Unbounded Transformations</b>
            <small>
              {s.unbounded
                ? "ACTIVE · WILL BE RECORDED"
                : "Release scale and crop limits"}
            </small>
          </span>
        </button>
        <div className="criteria-note">
          <b>CATEGORY LOGIC</b>
          <p>
            Reviewed physical descriptors guide tile selection. Porosity counts
            spaces; spatial density describes their compression. Unreviewed
            values contribute a neutral score.
          </p>
        </div>
      </aside>
      <section className="atlas-panel">
        <div className="atlas-toolbar">
          <div>
            <span>PRE-ANALYSIS FIELD</span>
            <b>
              {project.tiles.filter((t: Tile) => t.approved).length}/
              {project.tiles.length} VECTORS APPROVED
            </b>
          </div>
          <ModeControl value={viewMode} onChange={onView} />
          <label>
            <input
              type="checkbox"
              checked={uncertainty}
              onChange={(e) => onUncertainty(e.target.checked)}
            />{" "}
            uncertainty
          </label>
        </div>
        <div className="tile-grid">
          {project.tiles.map((t: Tile) => (
            <button
              key={t.id}
              className={`tile-card ${t.id === tile.id ? "active" : ""}`}
              onClick={() => {
                onTile(t.id);
                setCriteriaOpen(false);
                setEditorOpen(true);
              }}
            >
              <div className="tile-media">
                {viewMode !== "svg" && <img src={t.src} alt="" />}
                {viewMode !== "raster" && (
                  <VectorMotif
                    tile={t}
                    vectors={vectors}
                    uncertainty={uncertainty}
                  />
                )}
              </div>
              <footer>
                <b>{String(t.id).padStart(2, "0")}</b>
                <span>{t.name.replace("IMG_", "")}</span>
                <i className={t.status} />
              </footer>
            </button>
          ))}
        </div>
      </section>
      {editorOpen && (
        <div
          className="tile-editor-modal"
          ref={modalRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`Vector workspace ${tile.name}`}
        >
          <header className="tile-editor-header">
            <span>
              TILE {String(tile.id).padStart(2, "0")} / {tile.name}
            </span>
            <span className="editor-save-state" role="status">
              {saveState}
            </span>
            <button
              title="Close vector editor"
              aria-label="Close vector editor"
              onClick={() => setEditorOpen(false)}
            >
              <X size={20} />
            </button>
          </header>
          <CorrectionEditor
            key={tile.id}
            tile={tile}
            proposal={vectors?.proposals?.[tile.name]}
            onChange={onTileUpdate}
          />
          <div className={`tile-criteria-drawer ${criteriaOpen ? "open" : ""}`}>
            <button
              className="criteria-toggle"
              aria-expanded={criteriaOpen}
              onClick={() => setCriteriaOpen(!criteriaOpen)}
            >
              TILE CRITERIA + REVIEW <ChevronDown size={16} />
            </button>
            {criteriaOpen && (
              <div className="tile-criteria-body">
                <div className="inspect-heading">
                  <span>TILE {String(tile.id).padStart(2, "0")}</span>
                  <h2>{tile.name}</h2>
                  <p>
                    {`${correctionFor(tile, vectors)?.shapes.length ?? 0} vector objects`}
                  </p>
                  <p>
                    {tile.correction
                      ? "Edited proposal"
                      : "Automatic proposal · awaiting review"}
                  </p>
                </div>
                <PanelTitle n="D" title="ORIGINAL TILE CRITERIA" />
                {scoreNames.map((k) => (
                  <label className="range-row" key={k}>
                    <span>
                      <span title={criterionDefinitions[k]}>
                        {criterionLabels[k]}
                      </span>
                      <output>
                        {k === "porosity"
                          ? (tile.openingCount ?? "Unset")
                          : tile.criteriaReviewed?.[k]
                            ? tile.scores[k]
                            : "Unreviewed"}
                      </output>
                    </span>
                    <small className="criterion-definition">
                      {criterionDefinitions[k]}
                    </small>
                    {k === "porosity" ? (
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label="Number of distinct spaces"
                        placeholder="Count spaces"
                        value={tile.openingCount ?? ""}
                        onChange={(e) => {
                          const count =
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value);
                          if (
                            count !== undefined &&
                            (!Number.isSafeInteger(count) || count < 0)
                          )
                            return;
                          onTileUpdate({
                            openingCount: count,
                            scores: {
                              ...tile.scores,
                              porosity:
                                count === undefined ? 50 : porosityScore(count),
                            },
                            criteriaReviewed: {
                              ...tile.criteriaReviewed,
                              porosity: count !== undefined,
                            },
                          });
                        }}
                      />
                    ) : (
                      <input
                        type="range"
                        aria-label={criterionLabels[k]}
                        min="0"
                        max="100"
                        value={tile.scores[k]}
                        onChange={(e) =>
                          onTileUpdate({
                            scores: { ...tile.scores, [k]: +e.target.value },
                            criteriaReviewed: {
                              ...tile.criteriaReviewed,
                              [k]: true,
                            },
                          })
                        }
                      />
                    )}
                    {k !== "porosity" && (
                      <span className="criterion-ends">
                        <small>{criterionEnds[k][0]}</small>
                        <small>{criterionEnds[k][1]}</small>
                      </span>
                    )}
                  </label>
                ))}
                <button
                  className="outline-btn"
                  onClick={() =>
                    onTileUpdate({
                      criteriaReviewed: {
                        branching: true,
                        complexity: true,
                        density: true,
                        porosity: tile.openingCount !== undefined,
                      },
                    })
                  }
                >
                  CONFIRM PHYSICAL ASSESSMENT
                </button>
                <label className="field-label">
                  REVIEW NOTE
                  <textarea
                    value={tile.note}
                    onChange={(e) => onTileUpdate({ note: e.target.value })}
                  />
                </label>
                <button
                  className="approve-btn"
                  disabled={!hasVector(tile, vectors)}
                  onClick={() =>
                    onTileUpdate({
                      correction: correctionFor(tile, vectors),
                      approved: true,
                      status: "confirmed",
                    })
                  }
                >
                  {tile.approved
                    ? "✓ VECTOR CONFIRMED"
                    : hasVector(tile, vectors)
                      ? "CONFIRM USER VECTOR"
                      : "DRAW A MASS TO CONFIRM"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function EditorStage({
  section,
  tiles,
  vectors,
  activeStep,
  setActiveStep,
  viewMode,
  setViewMode,
  uncertainty,
  setUncertainty,
  analysis,
  setAnalysis,
  update,
  addRegion,
  present,
}: any) {
  const changeStep = (index: number, patch: Partial<Step>) =>
    update({
      steps: section.steps.map((s: Step, i: number) =>
        i === index ? { ...s, ...patch } : s,
      ),
    });
  return (
    <div className="workspace editor-workspace">
      <aside className="rail section-info">
        <PanelTitle n="A" title="SECTION RECORD" />
        <div className="record-name">
          <span>{categoriesLabel(section.categories)}</span>
          <input
            value={section.name}
            onChange={(e) => update({ name: e.target.value })}
          />
          <p>
            v{section.version} ·{" "}
            {section.draft ? "AUTOSAVED DRAFT" : "SAVED VERSION"}
          </p>
          <small>{section.milestones?.length ?? 0} NAMED MILESTONES</small>
        </div>
        <div className="record-flags">
          <span>
            SEED <b>{section.seed}</b>
          </span>
          <span>
            INPUTS <b>{section.steps.length} TILES</b>
          </span>
          <span>
            MODE <b>{section.unbounded ? "UNBOUNDED" : "STANDARD"}</b>
          </span>
        </div>
        <PanelTitle n="B" title="SPACE ANALYSIS" />
        <div className="space-legend">
          {categories.map((c) => (
            <div key={c}>
              <i style={{ background: colors[c] }} />
              <span>{c}</span>
            </div>
          ))}
        </div>
        {section.categories.map((c: Category) => (
          <div className="criteria-block" key={c}>
            <b style={{ color: colors[c] }}>{c.toUpperCase()}</b>
            {Object.entries(section.criteria[c]).map(([k, v]) => (
              <span key={k}>
                {k.replace(/([A-Z])/g, " $1")}
                <output>{v as number}</output>
              </span>
            ))}
          </div>
        ))}
        <div className="annotation-palette" aria-label="Annotation tools">
          <button onClick={() => addRegion("rectangle")}>RECTANGLE</button>
          <button onClick={() => addRegion("brush")}>BRUSH</button>
          <button onClick={() => addRegion("polyline")}>POLYLINE</button>
        </div>
        <p className="microcopy">
          Overlapping classifications render as diagonal stripes. Human regions
          remain separate from program proposals.
        </p>
      </aside>
      <section className="composition-panel">
        <div className="composition-toolbar">
          <div>
            <span>GENERATED SECTION</span>
            <b>{section.name.toUpperCase()}</b>
          </div>
          <ModeControl value={viewMode} onChange={setViewMode} />
          <label>
            <input
              type="checkbox"
              checked={uncertainty}
              onChange={(e) => setUncertainty(e.target.checked)}
            />{" "}
            uncertainty
          </label>
          <label>
            <input
              type="checkbox"
              checked={analysis}
              onChange={(e) => setAnalysis(e.target.checked)}
            />{" "}
            space analysis
          </label>
          <button title="Presentation view" onClick={present}>
            <Maximize2 size={16} />
          </button>
        </div>
        <SectionCanvas
          section={section}
          tiles={tiles}
          vectors={vectors}
          viewMode={viewMode}
          uncertainty={uncertainty}
          analysis={analysis}
        />
        <div className="canvas-caption">
          <span>SIMILARITY + CATEGORY INTENT + VECTOR GEOMETRY</span>
          <span>
            {section.steps.filter((s: Step) => s.review).length} CONNECTIONS
            REQUIRE REVIEW
          </span>
        </div>
      </section>
      <aside className="rail recipe-panel">
        <PanelTitle n="C" title="CONNECTION RECIPE" />
        <div className="recipe-list">
          {section.steps.map((step: Step, i: number) => {
            const tile = tiles.find((t: Tile) => t.id === step.tileId);
            return (
              <button
                key={step.id}
                className={activeStep === i ? "active" : ""}
                onClick={() => setActiveStep(i)}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <b>{tile?.name}</b>
                  <small>
                    {step.operation} · {step.transform.rotation}° ·{" "}
                    {step.transform.scale}%
                  </small>
                </div>
                {step.review && <i>REVIEW</i>}
              </button>
            );
          })}
        </div>
        {section.steps[activeStep] && (
          <div className="step-editor">
            <PanelTitle
              n="D"
              title={`STEP ${String(activeStep + 1).padStart(2, "0")}`}
            />
            {activeStep > 0 && (
              <label className="field-label">
                CONNECTION OPERATION
                <select
                  value={section.steps[activeStep].operation}
                  onChange={(e) =>
                    changeStep(activeStep, {
                      operation: e.target.value as Operation,
                      review: true,
                    })
                  }
                >
                  {operations.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            )}
            <NumberControl
              label="Rotation"
              value={section.steps[activeStep].transform.rotation}
              min={0}
              max={359}
              suffix="°"
              onChange={(rotation: number) =>
                changeStep(activeStep, {
                  transform: {
                    ...section.steps[activeStep].transform,
                    rotation,
                  },
                })
              }
            />
            <NumberControl
              label="Scale"
              value={section.steps[activeStep].transform.scale}
              min={section.unbounded ? 1 : 25}
              max={section.unbounded ? 500 : 200}
              suffix="%"
              onChange={(scale: number) =>
                changeStep(activeStep, {
                  transform: { ...section.steps[activeStep].transform, scale },
                })
              }
            />
            <NumberControl
              label="Crop"
              value={section.steps[activeStep].transform.crop}
              min={0}
              max={section.unbounded ? 95 : 50}
              suffix="%"
              onChange={(crop: number) =>
                changeStep(activeStep, {
                  transform: { ...section.steps[activeStep].transform, crop },
                })
              }
            />
            <label className="switch-row">
              <span>Mirror source</span>
              <input
                type="checkbox"
                checked={section.steps[activeStep].transform.mirror}
                onChange={(e) =>
                  changeStep(activeStep, {
                    transform: {
                      ...section.steps[activeStep].transform,
                      mirror: e.target.checked,
                    },
                  })
                }
              />
            </label>
            <button
              className="approve-btn"
              onClick={() => changeStep(activeStep, { review: false })}
            >
              {section.steps[activeStep].review
                ? "APPROVE CONNECTION"
                : "CONNECTION APPROVED"}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function SectionCanvas({
  section,
  tiles,
  vectors,
  viewMode,
  uncertainty,
  analysis,
}: {
  section: SectionRecord;
  tiles: Tile[];
  vectors: VectorLibrary | null;
  viewMode: string;
  uncertainty: boolean;
  analysis: boolean;
}) {
  return (
    <div className="section-canvas">
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={`${section.name} generated section`}
      >
        <defs>
          {categories.map((c) => (
            <pattern
              key={c}
              id={`stripe-${c}`}
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="2" height="5" fill={colors[c]} opacity=".72" />
            </pattern>
          ))}
        </defs>
        {section.steps.map((step) => {
          const tile = tiles.find((t) => t.id === step.tileId);
          if (!tile) return null;
          const tr = step.transform;
          const scale = (tr.scale / 100) * 0.42;
          return (
            <g
              key={step.id}
              transform={`translate(${tr.x} ${tr.y}) rotate(${tr.rotation}) scale(${tr.mirror ? -scale : scale} ${scale}) translate(-50 -50)`}
              opacity={step.operation === "overlap" ? 0.62 : 1}
            >
              {viewMode !== "svg" && (
                <image
                  href={tile.src}
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  opacity={viewMode === "overlay" ? 0.32 : 0.9}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
              {viewMode !== "raster" && correctionFor(tile, vectors) ? (
                <CorrectionGeometry
                  correction={correctionFor(tile, vectors)!}
                  fill={step.operation === "subtract" ? "#070707" : "#fff"}
                />
              ) : viewMode !== "raster" && Array.isArray(tile.vectorShapes) ? (
                <ManualVectorGeometry
                  shapes={tile.vectorShapes}
                  id={`section-${section.number}-${step.id}`}
                  fill={step.operation === "subtract" ? "#070707" : "#fff"}
                />
              ) : null}
            </g>
          );
        })}
        {analysis &&
          section.regions.map((r) => (
            <g key={r.id}>
              {r.shape === "brush" ? (
                <path
                  d={`M ${r.x} ${r.y + r.h * 0.45} Q ${r.x + r.w * 0.25} ${r.y - 4}, ${r.x + r.w * 0.5} ${r.y + r.h * 0.55} T ${r.x + r.w} ${r.y + r.h * 0.45}`}
                  fill="none"
                  stroke={colors[r.categories[0]]}
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity=".34"
                />
              ) : r.shape === "polyline" ? (
                <polygon
                  points={`${r.x},${r.y + r.h} ${r.x + r.w * 0.18},${r.y + r.h * 0.15} ${r.x + r.w * 0.72},${r.y} ${r.x + r.w},${r.y + r.h * 0.72}`}
                  fill={colors[r.categories[0]]}
                  opacity=".28"
                  stroke={colors[r.categories[0]]}
                  strokeWidth=".5"
                />
              ) : (
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill={
                    r.categories.length > 1
                      ? `url(#stripe-${r.categories[0]})`
                      : colors[r.categories[0]]
                  }
                  opacity={r.categories.length > 1 ? 1 : 0.28}
                  stroke={colors[r.categories[0]]}
                  strokeWidth=".5"
                  strokeDasharray={r.author === "program" ? "2 2" : "0"}
                />
              )}
              {r.categories.length > 1 && (
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill={`url(#stripe-${r.categories[1]})`}
                />
              )}
            </g>
          ))}
      </svg>
    </div>
  );
}
function SectionPicker({
  sections,
  current,
  open,
  setOpen,
  onSelect,
  onArchive,
}: any) {
  return (
    <div className="section-picker">
      <button className="picker-trigger" onClick={() => setOpen(!open)}>
        {current ? <SectionThumb section={current} /> : <span>Sections</span>}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="picker-menu">
          <div className="picker-grid">
            {sections
              .slice()
              .reverse()
              .slice(0, 12)
              .map((s: SectionRecord) => (
                <button key={s.id} onClick={() => onSelect(s.id)}>
                  <SectionThumb section={s} />
                  <span>
                    {s.name} · {categoriesLabel(s.categories)} · v{s.version}
                  </span>
                </button>
              ))}
          </div>
          <button className="archive-link" onClick={onArchive}>
            <Archive size={14} />
            SECTION ARCHIVE
          </button>
        </div>
      )}
    </div>
  );
}
function SectionThumb({ section }: { section: SectionRecord }) {
  return (
    <svg viewBox="0 0 100 60">
      <rect width="100" height="60" fill="#080808" />
      {section.steps.slice(0, 7).map((s, i) => (
        <path
          key={s.id}
          d={`M${6 + i * 8} ${48 - (i % 3) * 8} Q ${24 + i * 5} ${8 + (i % 4) * 7}, ${78 + (i % 2) * 10} ${18 + i * 5} L${88 - i * 3} 52Z`}
          fill="#eee"
          opacity={s.operation === "subtract" ? 0.15 : 0.8}
        />
      ))}
    </svg>
  );
}
function ArchivePanel({ sections, onClose, onSelect }: any) {
  return (
    <div className="archive-overlay">
      <div className="archive-header">
        <div>
          <span>PROJECT RECORD</span>
          <h2>SECTION ARCHIVE</h2>
        </div>
        <button onClick={onClose}>
          <X />
        </button>
      </div>
      <div className="archive-grid">
        {sections
          .slice()
          .reverse()
          .map((s: SectionRecord) => (
            <button key={s.id} onClick={() => onSelect(s.id)}>
              <SectionThumb section={s} />
              <div>
                <b>{s.name}</b>
                <span>
                  {categoriesLabel(s.categories)} · v{s.version}
                </span>
                <small>
                  {s.steps.length} tiles ·{" "}
                  {s.unbounded ? "unbounded" : "standard"}
                </small>
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}
function Presentation({
  section,
  tiles,
  vectors,
  analysis,
  onExit,
  onToggle,
}: any) {
  return (
    <main className="presentation">
      <SectionCanvas
        section={section}
        tiles={tiles}
        vectors={vectors}
        viewMode="svg"
        uncertainty={false}
        analysis={analysis}
      />
      <div className="presentation-controls">
        <button onClick={onToggle}>
          {analysis ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
          {analysis ? "Hide" : "Show"} space analysis
        </button>
        <button onClick={onExit}>
          <X size={16} />
          Exit
        </button>
      </div>
      {analysis && (
        <div className="presentation-legend">
          {categories.map((c) => (
            <span key={c}>
              <i style={{ background: colors[c] }} />
              {c}
            </span>
          ))}
        </div>
      )}
    </main>
  );
}
function PanelTitle({ n, title }: { n: string; title: string }) {
  return (
    <div className="panel-title">
      <i>{n}</i>
      <span>{title}</span>
    </div>
  );
}
function NumberControl({ label, value, min, max, onChange, suffix = "" }: any) {
  return (
    <label className="number-control">
      <span>{label}</span>
      <div>
        <button onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <output>
          {value}
          {suffix}
        </output>
        <button onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
    </label>
  );
}
