from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
from run_vector_experiment import topology

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'vector-experiment'
records = json.loads((OUT / 'results-720.json').read_text())
checks = []
for r in records:
    mask = np.array(Image.open(OUT / (r['stem'] + '-mask.png'))) > 127
    rendered = np.array(Image.open(OUT / (r['stem'] + '-render.png')).convert('RGBA'))[:, :, 3] > 127
    checks.append({'stem': r['stem'], 'mask_to_render_disagreement_fraction': float(np.mean(mask != rendered)), 'render_topology': topology(rendered)})
(OUT / 'render-checks.json').write_text(json.dumps(checks, indent=2))
for tile in [2,4,29,12,16,25]:
    entries = [('Raster input', OUT / f'tile-{tile:02}-720-raster.png')]
    if tile in [2,4,29]:
        entries.append(('Approved screenshot (not aligned)', ROOT / f'vector-benchmark/tile-{tile:02}-approved-svg.png'))
    entries += [(r['method'], OUT / (r['stem'] + '-render.png')) for r in records if r['tile'] == tile]
    canvas = Image.new('RGB', (1200, 880), '#161616')
    d = ImageDraw.Draw(canvas)
    for i,(label,file) in enumerate(entries):
        im=Image.open(file).convert('RGBA');im.thumbnail((380,390))
        x=i%3*400+(400-im.width)//2;y=i//3*440+38
        canvas.paste(im,(x,y),im)
        d.text((i%3*400+10,i//3*440+10),f'Tile {tile:02} / {label}', fill='white')
    canvas.save(OUT / f'comparison-{tile:02}.png')
print('Saved comparison sheets and mask-to-SVG rendering checks (not reference accuracy scores).')
