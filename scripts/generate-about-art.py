#!/usr/bin/env python3
"""Render three deterministic, geometric AI illustrations. No image inputs or AI calls.

Requires NumPy and Pillow. Run: python3 scripts/generate-about-art.py
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter
from PIL import __version__ as PILLOW_VERSION

WIDTH, HEIGHT = 1200, 900
BLUE = np.array([74, 126, 244], dtype=float)
ICE = np.array([185, 225, 255], dtype=float)
GOLD = np.array([255, 180, 92], dtype=float)
VIOLET = np.array([151, 123, 244], dtype=float)


def tone(color, strength=1.0):
    return tuple(np.clip(np.asarray(color) * strength, 0, 255).astype(int))


def mix(a, b, amount):
    return np.asarray(a) * (1 - amount) + np.asarray(b) * amount


def rotation(pitch, yaw, roll=0):
    cx, sx, cy, sy, cz, sz = math.cos(pitch), math.sin(pitch), math.cos(yaw), math.sin(yaw), math.cos(roll), math.sin(roll)
    rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return rz @ rx @ ry


class Studio:
    def __init__(self, seed, pitch=0, yaw=0, roll=0, camera=9, focal=1300):
        self.rng = np.random.default_rng(seed)
        self.transform = rotation(pitch, yaw, roll)
        self.camera, self.focal = camera, focal
        yy, xx = np.mgrid[0:HEIGHT, 0:WIDTH]
        halo = np.exp(-(((xx - 600) / 420) ** 2 + ((yy - 430) / 330) ** 2))
        floor = np.exp(-(((xx - 600) / 410) ** 2 + ((yy - 790) / 48) ** 2))
        grain = self.rng.normal(0, 0.38, (HEIGHT, WIDTH, 1))
        rgb = np.array([7, 10, 20]) + halo[..., None] * np.array([5, 9, 21]) + floor[..., None] * np.array([3, 5, 12]) + grain
        self.base = Image.fromarray(np.clip(rgb, 0, 255).astype('uint8'))
        self.ink = Image.new('RGB', (WIDTH, HEIGHT))
        self.emission = Image.new('RGB', (WIDTH, HEIGHT))
        self.commands = []

    def project(self, points):
        points = np.asarray(points) @ self.transform.T
        factor = self.focal / (self.camera - points[..., 2])
        xy = np.stack([WIDTH / 2 + points[..., 0] * factor, HEIGHT / 2 - points[..., 1] * factor], axis=-1)
        return xy, points[..., 2]

    def line(self, points, color, width=1, brightness=1, glow=True):
        xy, depths = self.project(points)
        for i in range(len(xy) - 1):
            depth = (depths[i] + depths[i + 1]) / 2
            gain = brightness * (0.4 + 0.6 * np.clip((depth + 3.8) / 7.6, 0, 1))
            self.commands.append((depth, 'line', tuple(xy[i]), tuple(xy[i + 1]), tone(color, gain), width, glow))

    def node(self, point, color=ICE, radius=5):
        xy, depth = self.project([point])
        radius *= self.camera / (self.camera - depth[0])
        self.commands.append((depth[0], 'node', tuple(xy[0]), radius, tone(color), None, None))

    def polygon(self, points, color):
        xy, depth = self.project(points)
        self.commands.append((float(depth.mean()), 'polygon', [tuple(p) for p in xy], tone(color), None, None, None))

    def finish(self):
        draw, emit = ImageDraw.Draw(self.ink), ImageDraw.Draw(self.emission)
        for command in sorted(self.commands, key=lambda item: item[0]):
            _, kind, a, b, color, width, glow = command
            if kind == 'polygon':
                draw.polygon(a, fill=b)
            elif kind == 'line':
                draw.line([a, b], fill=color, width=width)
                if glow:
                    emit.line([a, b], fill=tone(color, 0.65), width=max(2, width + 1))
            else:
                x, y = a
                r, color = b, color
                emit.ellipse((x - r * 1.8, y - r * 1.8, x + r * 1.8, y + r * 1.8), fill=tone(color, 0.7))
                draw.ellipse((x - r, y - r, x + r, y + r), fill=tone(color, 0.35), outline=tone(color, 0.9), width=1)
                draw.ellipse((x - r * 0.46, y - r * 0.55, x + r * 0.18, y + r * 0.05), fill=tuple(mix(color, [255, 255, 255], 0.8).astype(int)))
        soft = self.emission.filter(ImageFilter.GaussianBlur(11))
        tight = self.emission.filter(ImageFilter.GaussianBlur(3))
        image = ImageChops.screen(self.base, soft)
        image = ImageChops.screen(image, tight)
        return ImageChops.screen(image, self.ink)


def neural_loom():
    """A braided tube following a (2, 3) torus knot; each strand is explicit."""
    studio = Studio(81, pitch=0.62, yaw=-0.28, roll=0.22)
    t = np.linspace(0, 2 * np.pi, 720)
    center = np.stack([(2.05 + 0.78 * np.cos(3 * t)) * np.cos(2 * t),
                       (2.05 + 0.78 * np.cos(3 * t)) * np.sin(2 * t), 0.9 * np.sin(3 * t)], axis=-1)
    tangent = np.gradient(center, axis=0)
    tangent /= np.linalg.norm(tangent, axis=-1)[:, None]
    normal = np.cross(tangent, np.array([0, 0, 1]))
    normal /= np.linalg.norm(normal, axis=-1)[:, None]
    binormal = np.cross(tangent, normal)
    for strand in range(29):
        phase = strand * 2 * np.pi / 29 + t * 5
        radius = 0.16 + 0.045 * np.cos(t * 3 + strand * 0.1)
        points = center + radius[:, None] * (np.cos(phase)[:, None] * normal + np.sin(phase)[:, None] * binormal)
        color = mix(BLUE, ICE, (strand % 7) / 7)
        if strand % 11 == 0:
            color = GOLD
        studio.line(points, color, width=2 if strand % 7 == 0 else 1, brightness=1.3)
    for index in range(8, len(center), 37):
        studio.node(center[index], GOLD if index % 3 == 0 else ICE, radius=4.2)
    # Separate fine signal tracks reinforce the braided silhouette.
    for sign in [-1, 1]:
        studio.line(center + normal * sign * 0.31, mix(BLUE, VIOLET, 0.4), brightness=0.6)
    return studio.finish()


def spherical_arc(a, b, lift=0, steps=35):
    a, b = np.asarray(a), np.asarray(b)
    radius = np.linalg.norm(a)
    u, v = a / radius, b / radius
    theta = math.acos(float(np.clip(np.dot(u, v), -0.9999, 0.9999)))
    ts = np.linspace(0, 1, steps)
    points = (np.sin((1 - ts) * theta)[:, None] * u + np.sin(ts * theta)[:, None] * v) / math.sin(theta)
    return points * (radius + lift * np.sin(ts * np.pi))[:, None]


def attention_constellation():
    """A Fibonacci sphere with nearest-neighbor edges and selected long routes."""
    studio = Studio(144, pitch=-0.2, yaw=0.4, roll=-0.1)
    count, radius = 145, 2.55
    index = np.arange(count)
    y = 1 - 2 * (index + 0.5) / count
    azimuth = index * np.pi * (3 - np.sqrt(5))
    ring = np.sqrt(1 - y * y)
    points = radius * np.stack([ring * np.cos(azimuth), y, ring * np.sin(azimuth)], axis=-1)
    edges = set()
    for i, point in enumerate(points):
        near = np.argsort(np.sum((points - point) ** 2, axis=-1))[1:5]
        for j in near:
            edges.add(tuple(sorted((i, int(j)))))
    for i, j in sorted(edges):
        studio.line(spherical_arc(points[i], points[j], steps=12), mix(BLUE, ICE, 0.55), width=3, brightness=1.05)
    for theta in [0.2, 1.25, 2.3]:
        ts = np.linspace(0, 2 * np.pi, 250)
        circle = radius * np.stack([np.cos(ts), np.sin(ts) * np.cos(theta), np.sin(ts) * np.sin(theta)], axis=-1)
        studio.line(circle * 1.04, VIOLET, brightness=0.42)
    hubs = [19, 44, 70, 101, 122]
    for i, j in [(19, 70), (19, 101), (44, 122), (70, 122), (44, 101), (19, 122)]:
        studio.line(spherical_arc(points[i], points[j], lift=0.32, steps=70), GOLD, width=2, brightness=1.2)
    for i, point in enumerate(points):
        studio.node(point, GOLD if i in hubs else mix(BLUE, ICE, 0.75), radius=6.5 if i in hubs else 3.2)
    return studio.finish()


def latent_terrain():
    """An analytic folded surface: Gaussian peaks, a saddle, and sinusoidal folds."""
    studio = Studio(233, pitch=0.9, yaw=-0.55, roll=-0.06, camera=10.5, focal=1300)
    xs, zs = np.linspace(-3.25, 3.25, 79), np.linspace(-2.25, 2.25, 61)
    xx, zz = np.meshgrid(xs, zs)
    height = (1.7 * np.exp(-((xx + 0.7) ** 2 / 1.4 + (zz - 0.4) ** 2 / 0.85))
              - 1.15 * np.exp(-((xx - 1.2) ** 2 / 0.8 + (zz + 0.5) ** 2 / 0.9))
              + 0.42 * np.sin(xx * 1.7 + zz * 0.8) + 0.23 * np.cos(zz * 2.6) - 0.1)
    surface = np.stack([xx, height, zz], axis=-1)
    hmin, hmax = height.min(), height.max()
    for row in range(0, len(zs) - 1, 2):
        for column in range(0, len(xs) - 1, 2):
            quad = surface[row:row + 3:2, column:column + 3:2]
            h = (height[row, column] - hmin) / (hmax - hmin)
            studio.polygon([quad[0, 0], quad[0, 1], quad[1, 1], quad[1, 0]], mix([18, 38, 69], [40, 60, 104], h))
    for row, points in enumerate(surface):
        h = float((height[row].mean() - hmin) / (hmax - hmin))
        color = mix(mix(BLUE, ICE, 0.45), ICE, h * 0.6)
        if row % 10 == 4:
            color = mix(VIOLET, GOLD, 0.65)
        studio.line(points, color, width=4 if row % 10 == 4 else 3, brightness=1.1 if row % 2 else 1.35)
    for column in range(0, len(xs), 2):
        studio.line(surface[:, column], mix(mix(BLUE, VIOLET, 0.5), ICE, 0.3), width=2, brightness=0.95)
    for row, column in [(15, 24), (25, 33), (33, 45), (43, 56), (48, 63)]:
        studio.node(surface[row, column], GOLD, radius=5)
    # A sparse ribbon of samples floats above the surface rather than adding labels.
    path = surface[35].copy()
    path[:, 1] += 0.08
    studio.line(path, GOLD, width=2, brightness=1.1)
    return studio.finish()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'public/about-images/procedural')
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {'generator': 'scripts/generate-about-art.py', 'method': 'Deterministic NumPy geometry and Pillow rendering; no input images or AI generation.', 'size': [WIDTH, HEIGHT], 'numpy': np.__version__, 'pillow': PILLOW_VERSION, 'images': []}
    for slug, render, seed in [('neural-loom', neural_loom, 81), ('attention-constellation', attention_constellation, 144), ('latent-terrain', latent_terrain, 233)]:
        path = args.out_dir / f'{slug}.webp'
        render().save(path, 'WEBP', quality=91, method=6)
        data = path.read_bytes()
        manifest['images'].append({'file': path.name, 'seed': seed, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        print(f'{slug}: {len(data):,} bytes')
    (args.out_dir / 'provenance.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
