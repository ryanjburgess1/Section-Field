import { strFromU8, strToU8, unzip, zip } from "fflate";

const rasterPaths = Array.from({ length: 48 }, (_, index) =>
  `assets/IMG_${5204 + index}.png`,
);
const vectorPaths = [
  "vectors/tile-vectors.json",
  "vectors/correction-proposals.json",
];
const assetPaths = [...rasterPaths, ...vectorPaths];
const MAX_BUNDLE_BYTES = 200 * 1024 * 1024;

type Manifest = {
  format: "section-field-project";
  version: 1;
  exportedAt: string;
  assets: string[];
};

function zipFiles(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    zip(files, { level: 0 }, (error, data) =>
      error ? reject(error) : resolve(data),
    ),
  );
}

function unzipFiles(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) =>
    unzip(data, (error, files) => error ? reject(error) : resolve(files)),
  );
}

export async function createProjectBundle(
  project: unknown,
  onProgress?: (completed: number, total: number) => void,
): Promise<Blob> {
  const manifest: Manifest = {
    format: "section-field-project",
    version: 1,
    exportedAt: new Date().toISOString(),
    assets: assetPaths,
  };
  const files: Record<string, Uint8Array> = {
    "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
    "project.json": strToU8(JSON.stringify(project)),
    "README.txt": strToU8(
      "Section Field project bundle\n\nImport this ZIP from the Project menu in Section Field. " +
      "It contains the project record, all 48 source rasters, and the vector reference files. " +
      "The site already hosts these source assets, so import restores the project record and " +
      "uses its matching hosted assets. Import replaces the current user's project after confirmation.\n",
    ),
  };
  for (let index = 0; index < assetPaths.length; index += 8) {
    const batch = assetPaths.slice(index, index + 8);
    await Promise.all(batch.map(async (path) => {
      const response = await fetch(`/${path}`);
      if (!response.ok) throw new Error(`Could not include ${path}`);
      files[path] = new Uint8Array(await response.arrayBuffer());
    }));
    onProgress?.(Math.min(index + batch.length, assetPaths.length), assetPaths.length);
  }
  const data = await zipFiles(files);
  return new Blob([Uint8Array.from(data)], { type: "application/zip" });
}

export async function readProjectBundle(file: File): Promise<unknown> {
  if (file.size > MAX_BUNDLE_BYTES) throw new Error("Bundle exceeds the 200 MB limit.");
  const files = await unzipFiles(new Uint8Array(await file.arrayBuffer()));
  if (!files["manifest.json"] || !files["project.json"])
    throw new Error("This is not a Section Field project bundle.");
  const manifest = JSON.parse(strFromU8(files["manifest.json"])) as Manifest;
  if (manifest.format !== "section-field-project" || manifest.version !== 1)
    throw new Error("Unsupported project bundle version.");
  if (!assetPaths.every((path) => manifest.assets?.includes(path) && files[path]?.length))
    throw new Error("The bundle is missing source rasters or vector references.");
  const project = JSON.parse(strFromU8(files["project.json"])) as Record<string, unknown>;
  if (!project || typeof project !== "object" ||
      !Array.isArray(project.tiles) || project.tiles.length !== 48 ||
      !Array.isArray(project.sections) || !project.settings ||
      !Array.isArray(project.jointStudies))
    throw new Error("The project record is incomplete.");
  for (let index = 0; index < 48; index++) {
    const tile = project.tiles[index] as { id?: number; src?: string };
    if (tile?.id !== index + 1 || tile.src !== `/${rasterPaths[index]}`)
      throw new Error("The bundle uses incompatible tile assets.");
  }
  return project;
}
