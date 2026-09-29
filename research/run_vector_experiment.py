"""Checkpoint C experiment only. Does not modify application assets or state."""
from pathlib import Path
import argparse
import hashlib
import json
import time
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import potrace

ROOT = Path(__file__).resolve().parent
SOURCE = Path('/Users/ryanburgess/Documents/design 7 (office of future)/studio/assignment 2/simple sections')
OUT = ROOT / 'vector-experiment'


def otsu(values):
    hist = np.bincount(np.clip(values, 0, 255).astype('uint8').ravel(), minlength=256).astype(float)
    p = hist / hist.sum()
    w = np.cumsum(p)
    m = np.cumsum(p * np.arange(256))
    score = (m[-1] * w - m) ** 2 / np.maximum(w * (1 - w), 1e-12)
    return int(np.argmax(score))


def topology(mask):
    # Use explicit complementary connectivity, not an architectural opening count.
    _, components = ndi.label(mask, ndi.generate_binary_structure(2, 2))
    background, count = ndi.label(~mask, ndi.generate_binary_structure(2, 1))
    edge = set(np.concatenate((background[0], background[-1], background[:, 0], background[:, -1])))
    holes = sum(i not in edge for i in range(1, count + 1))
    return {'pixel_components_8_connected': int(components), 'pixel_holes_4_connected': holes}


def trace(mask, destination):
    t = time.perf_counter()
    paths = potrace.Bitmap(~mask).trace(turdsize=0, alphamax=0.7, opticurve=True, opttolerance=0.15)
    commands = []
    segments = 0
    def xy(p): return f'{p.x:.3f},{p.y:.3f}'
    for curve in paths:
        if curve.start_point is None:
            continue
        commands.append('M' + xy(curve.start_point))
        for s in curve:
            segments += 1
            if s.is_corner:
                commands.append('L' + xy(s.c) + ' L' + xy(s.end_point))
            else:
                commands.append('C' + xy(s.c1) + ' ' + xy(s.c2) + ' ' + xy(s.end_point))
        commands.append('Z')
    h, w = mask.shape
    destination.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><path fill="white" fill-rule="evenodd" d="{" ".join(commands)}"/></svg>')
    return {'trace_seconds': round(time.perf_counter() - t, 3), 'contours': len(paths), 'segments': segments, 'svg_bytes': destination.stat().st_size}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--tiles', default='2,4,29,12,16,25')
    parser.add_argument('--size', type=int, default=720)
    parser.add_argument('--methods', default='raw-otsu,soft-otsu,connected-tones,local-light')
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    results_path = OUT / f'results-{args.size}.json'
    records = json.loads(results_path.read_text()) if results_path.exists() else []
    for tile in map(int, args.tiles.split(',')):
        file = SOURCE / f'IMG_{5203 + tile}.PNG'
        original = Image.open(file).convert('RGBA')
        im = original.copy()
        im.thumbnail((args.size, args.size), Image.Resampling.LANCZOS)
        a = np.array(im).astype(float)
        valid = a[:, :, 3] >= 128
        gray = a[:, :, :3] @ np.array([0.2126, 0.7152, 0.0722])
        smoothed = ndi.gaussian_filter(gray, 0.8)
        threshold = otsu(gray[valid])
        smooth_threshold = otsu(smoothed[valid])
        # A bounded local illumination estimate; clipping avoids amplifying dark voids.
        local = ndi.gaussian_filter(gray * valid, 32) / np.maximum(ndi.gaussian_filter(valid.astype(float), 32), 1e-5)
        normalized = gray * np.clip(np.median(gray[valid]) / np.maximum(local, 1), 0.7, 1.4)
        normalized_threshold = otsu(normalized[valid])
        masks = {
            'raw-otsu': (valid & (gray > threshold), {'threshold': threshold}),
            'soft-otsu': (valid & (smoothed > smooth_threshold), {'threshold': smooth_threshold, 'gaussian_sigma': 0.8}),
            'connected-tones': (ndi.binary_propagation(valid & (smoothed > smooth_threshold), mask=valid & (smoothed > smooth_threshold * 0.7)), {'seed_threshold': smooth_threshold, 'growth_threshold': round(smooth_threshold * 0.7, 2), 'gaussian_sigma': 0.8}),
            'local-light': (valid & (normalized > normalized_threshold), {'threshold': normalized_threshold, 'illumination_sigma': 32, 'gain_limits': [0.7, 1.4]}),
        }
        im.save(OUT / f'tile-{tile:02}-{args.size}-raster.png')
        for method, (mask, preparation) in masks.items():
            if method not in args.methods.split(','):
                continue
            stem = f'tile-{tile:02}-{args.size}-{method}'
            if any(r['stem'] == stem for r in records):
                continue
            Image.fromarray(mask.astype('uint8') * 255).save(OUT / f'{stem}-mask.png')
            result = trace(mask, OUT / f'{stem}.svg')
            record = {'stem': stem, 'tile': tile, 'role': 'reference' if tile in [2,4,29] else 'unapproved generalization probe', 'method': method, 'source': str(file), 'source_sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'source_size': original.size, 'working_size': im.size, 'preparation': preparation, 'trace_parameters': {'turdsize':0, 'alphamax':0.7, 'opttolerance':0.15}, 'solid_fraction_canvas': round(float(mask.mean()),4), **topology(mask), **result}
            records.append(record)
            results_path.write_text(json.dumps(records, indent=2))
            print(json.dumps(record), flush=True)


if __name__ == '__main__':
    main()
