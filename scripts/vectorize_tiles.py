from pathlib import Path
from PIL import Image, ImageFilter
import json
import math
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
OUTPUT = ROOT / "public" / "vectors" / "tile-vectors.json"
THRESHOLDS = (55, 75, 95, 115, 135, 155)
GRID = 144


def rdp(points, epsilon):
    if len(points) < 3:
        return points
    a = np.array(points[0], dtype=float)
    b = np.array(points[-1], dtype=float)
    line = b - a
    length = np.linalg.norm(line)
    if length == 0:
        distances = [np.linalg.norm(np.array(p) - a) for p in points]
    else:
        distances = [abs(np.cross(line, np.array(p) - a)) / length for p in points]
    index = int(np.argmax(distances))
    if distances[index] > epsilon:
        left = rdp(points[: index + 1], epsilon)
        right = rdp(points[index:], epsilon)
        return left[:-1] + right
    return [points[0], points[-1]]


def neighborhood_sum(mask):
    padded = np.pad(mask.astype(np.uint8), 1)
    total = np.zeros(mask.shape, dtype=np.uint8)
    for dy in range(3):
        for dx in range(3):
            total += padded[dy : dy + mask.shape[0], dx : dx + mask.shape[1]]
    return total


def clean_mask(mask):
    # Close one-pixel breaks, soften sawtooth noise, and preserve architectural gaps.
    expanded = neighborhood_sum(mask) >= 3
    closed = neighborhood_sum(expanded) >= 7
    return neighborhood_sum(closed) >= 4


def remove_tiny_components(mask, minimum=5):
    height, width = mask.shape
    output = mask.copy()
    visited = np.zeros(mask.shape, dtype=bool)
    for y in range(height):
        for x in range(width):
            if visited[y, x] or not mask[y, x]:
                continue
            stack = [(x, y)]
            component = []
            visited[y, x] = True
            while stack:
                px, py = stack.pop()
                component.append((px, py))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = px + dx, py + dy
                    if 0 <= nx < width and 0 <= ny < height and mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        stack.append((nx, ny))
            if len(component) < minimum:
                for px, py in component:
                    output[py, px] = False
    return output


def mask_for(image, threshold):
    width, height = image.size
    scale = GRID / max(width, height)
    size = (max(1, round(width * scale)), max(1, round(height * scale)))
    sample = image.resize(size, Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(0.45))
    rgba = np.asarray(sample.convert("RGBA"), dtype=np.float32)
    luminance = rgba[:, :, 0] * 0.2126 + rgba[:, :, 1] * 0.7152 + rgba[:, :, 2] * 0.0722
    alpha = rgba[:, :, 3]
    saturation = rgba[:, :, :3].max(axis=2) - rgba[:, :, :3].min(axis=2)
    luminance_image = Image.fromarray(np.uint8(np.clip(luminance, 0, 255)))
    local_high = np.asarray(luminance_image.filter(ImageFilter.MaxFilter(5)), dtype=np.float32)
    local_low = np.asarray(luminance_image.filter(ImageFilter.MinFilter(5)), dtype=np.float32)
    texture = local_high - local_low

    # Transparency locates the photographed object. Tone, chroma, and texture retain
    # shaded material while uniform black regions remain spatial void.
    alpha_limit = 40 + threshold * 0.72
    dark_limit = 3.5 + threshold * 0.045
    texture_limit = 3.0 + threshold * 0.035
    material = (alpha >= alpha_limit) & (
        (luminance >= dark_limit) | (texture >= texture_limit) | (saturation >= 3.0)
    )
    return remove_tiny_components(clean_mask(material))


def boundary_path(mask):
    height, width = mask.shape
    edges = {}

    def add(a, b):
        edges.setdefault(a, []).append(b)

    for y in range(height):
        for x in range(width):
            if not mask[y, x]:
                continue
            if y == 0 or not mask[y - 1, x]:
                add((x, y), (x + 1, y))
            if x == width - 1 or not mask[y, x + 1]:
                add((x + 1, y), (x + 1, y + 1))
            if y == height - 1 or not mask[y + 1, x]:
                add((x + 1, y + 1), (x, y + 1))
            if x == 0 or not mask[y, x - 1]:
                add((x, y + 1), (x, y))

    loops = []
    while edges:
        start = next(iter(edges))
        loop = [start]
        current = start
        for _ in range((width + 1) * (height + 1) * 2):
            options = edges.get(current)
            if not options:
                break
            nxt = options.pop()
            if not options:
                edges.pop(current, None)
            current = nxt
            loop.append(current)
            if current == start:
                break
        if len(loop) >= 5 and loop[-1] == start:
            loops.append(rdp(loop, 0.7))

    sx = 88 / width
    sy = 88 / height
    ox = 6
    oy = 6
    commands = []
    for loop in loops:
        if len(loop) < 4:
            continue
        commands.append("M" + " L".join(f"{ox + x * sx:.2f},{oy + y * sy:.2f}" for x, y in loop) + " Z")
    return " ".join(commands)


def skeletonize(mask):
    img = mask.astype(np.uint8).copy()
    changed = True
    while changed:
        changed = False
        for phase in (0, 1):
            remove = []
            for y in range(1, img.shape[0] - 1):
                for x in range(1, img.shape[1] - 1):
                    if img[y, x] == 0:
                        continue
                    p = [img[y - 1, x], img[y - 1, x + 1], img[y, x + 1], img[y + 1, x + 1], img[y + 1, x], img[y + 1, x - 1], img[y, x - 1], img[y - 1, x - 1]]
                    neighbors = sum(p)
                    transitions = sum(p[i] == 0 and p[(i + 1) % 8] == 1 for i in range(8))
                    if not (2 <= neighbors <= 6 and transitions == 1):
                        continue
                    if phase == 0:
                        keep = p[0] * p[2] * p[4] == 0 and p[2] * p[4] * p[6] == 0
                    else:
                        keep = p[0] * p[2] * p[6] == 0 and p[0] * p[4] * p[6] == 0
                    if keep:
                        remove.append((y, x))
            if remove:
                changed = True
                for y, x in remove:
                    img[y, x] = 0
    return img


def branch_path(mask):
    # Trace skeleton chains between endpoints and junctions; retain meaningful connectors only.
    skel = skeletonize(mask)
    pixels = {(x, y) for y, x in zip(*np.where(skel > 0))}
    if not pixels:
        return ""
    directions = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
    neighbors = {p: [(p[0] + dx, p[1] + dy) for dx, dy in directions if (p[0] + dx, p[1] + dy) in pixels] for p in pixels}
    nodes = {p for p, ns in neighbors.items() if len(ns) != 2}
    visited = set()
    chains = []
    for node in nodes:
        for nxt in neighbors[node]:
            edge = tuple(sorted((node, nxt)))
            if edge in visited:
                continue
            chain = [node, nxt]
            visited.add(edge)
            prev, current = node, nxt
            while current not in nodes:
                options = [p for p in neighbors[current] if p != prev]
                if not options:
                    break
                following = options[0]
                visited.add(tuple(sorted((current, following))))
                chain.append(following)
                prev, current = current, following
            if len(chain) >= 9:
                chains.append(rdp(chain, 1.2))
    height, width = mask.shape
    sx, sy = 88 / width, 88 / height
    commands = []
    for chain in sorted(chains, key=len, reverse=True)[:18]:
        commands.append("M" + " L".join(f"{6 + x * sx:.2f},{6 + y * sy:.2f}" for x, y in chain))
    return " ".join(commands)


def main():
    result = {"grid": GRID, "thresholds": list(THRESHOLDS), "tiles": {}}
    for source in sorted(ASSETS.glob("IMG_*.png")):
        image = Image.open(source).convert("RGBA")
        tile = {}
        for threshold in THRESHOLDS:
            mask = mask_for(image, threshold)
            low = mask_for(image, max(20, threshold - 16))
            high = mask_for(image, min(220, threshold + 16))
            tile[str(threshold)] = {
                "solid": boundary_path(mask),
                "uncertaintyLow": boundary_path(low),
                "uncertaintyHigh": boundary_path(high),
                # Connector centerlines will be authored from reviewed regions. A full
                # mass skeleton creates misleading lines through broad solid areas.
                "branches": "",
                "solidRatio": round(float(mask.mean()), 4),
            }
        result["tiles"][source.stem] = tile
        print(source.stem)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, separators=(",", ":")))
    print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size / 1024:.1f} KiB)")


if __name__ == "__main__":
    main()
