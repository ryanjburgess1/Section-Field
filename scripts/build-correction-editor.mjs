import { build } from "vite";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const source = path.join(root, "research/correction-editor");
const out = path.join(root, "public/correction-editor");
await build({
  configFile: false,
  root: source,
  base: "/correction-editor/",
  publicDir: false,
  build: { outDir: out, emptyOutDir: true },
});
await mkdir(path.join(out, "package/dist"), { recursive: true });
await copyFile(
  path.join(source, "package/dist/paper-core.min.js"),
  path.join(out, "package/dist/paper-core.min.js"),
);
await copyFile(
  path.join(source, "package/LICENSE.txt"),
  path.join(out, "paper-LICENSE.txt"),
);
const records = JSON.parse(
  await readFile("research/vector-experiment/results-720.json", "utf8"),
);
const proposals = {};
for (let tile = 1; tile <= 48; tile++) {
  const record = records.find(
    (r) => r.tile === tile && r.method === "connected-tones",
  );
  if (!record) throw Error(`Missing proposal for tile ${tile}`);
  const svg = await readFile(
    `research/vector-experiment/${record.stem}.svg`,
    "utf8",
  );
  const [width, height] = record.working_size;
  proposals[`IMG_${5203 + tile}`] = {
    width,
    height,
    shapes: [{ d: svg.match(/ d="([^"]+)"/)[1] }],
    draft: [],
    draftMode: "add",
  };
}
await writeFile(
  "public/vectors/correction-proposals.json",
  JSON.stringify(proposals),
);
console.log(
  `Built correction editor and ${Object.keys(proposals).length} tile proposals.`,
);
