const fs = require('node:fs');
const path = require('node:path');
const sharp = require('/Users/ryanburgess/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.join(__dirname, 'vector-experiment');

(async () => {
  const records = fs.readdirSync(root).filter(n => /^results-\d+\.json$/.test(n)).flatMap(n => JSON.parse(fs.readFileSync(path.join(root,n))));
  for (const r of records) {
    await sharp(path.join(root, r.stem + '.svg')).png().toFile(path.join(root, r.stem + '-render.png'));
  }
  const sections = [];
  for (const tile of [...new Set(records.map(r=>r.tile))]) {
    const rows = records.filter(r=>r.tile === tile);
    const id = String(tile).padStart(2,'0');
    const figures = [
      `<figure><figcaption>Raster input (720px preview)</figcaption><img src="tile-${id}-720-raster.png"></figure>`,
      ...([2,4,29].includes(tile) ? [`<figure><figcaption>User-approved screenshot (not pixel-aligned)</figcaption><img src="../vector-benchmark/tile-${id}-approved-svg.png"></figure>`] : []),
      ...rows.map(r=>`<figure><figcaption>${r.method} / ${r.working_size[1]}px / ${r.trace_seconds}s</figcaption><img src="${r.stem}.svg"><details><summary>Input mask and measurements</summary><img src="${r.stem}-mask.png"><pre>${JSON.stringify(r,null,2)}</pre></details><a href="${r.stem}.svg">Open SVG</a></figure>`)
    ];
    sections.push(`<section><h2>Tile ${id}${[2,4,29].includes(tile)?' / approved reference':' / unapproved generalization probe'}</h2><div class="grid">${figures.join('')}</div></section>`);
  }
  fs.writeFileSync(path.join(root,'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checkpoint C / tracing experiment</title><style>body{background:#111;color:#eee;font:16px system-ui;margin:24px;letter-spacing:0}h1{font-size:26px}h2{font-size:21px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}figure{margin:0;border-top:1px solid #555;padding-top:12px;min-width:0}img{display:block;width:100%;height:360px;object-fit:contain;background:#050505}figcaption{min-height:46px}section{border-top:1px solid #777;margin-top:32px;padding-top:10px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}a{color:#66d9d2}p{max-width:1000px;line-height:1.5}</style><h1>Checkpoint C: Potrace experiment</h1><p>Research only. No live drawings were changed. White is proposed mass; black displays transparent void. These are uncorrected automatic candidates, not approved replacements. Screenshot references are not pixel-aligned ground truth. Rendered SVGs below are the actual exported vectors.</p><p>Methods: raw-otsu = automatic brightness split; soft-otsu = light smoothing before the split; connected-tones = extend bright seeds into connected darker tones; local-light = bounded illumination normalization before the split. Small-component deletion is disabled. Smoothing and thresholding can still lose detail.</p>${sections.join('')}</html>`);
  console.log(`Rendered ${records.length} SVGs and created ${path.join(root,'index.html')}`);
})();
