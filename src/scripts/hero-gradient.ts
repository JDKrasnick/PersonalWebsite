import type { HeroHandle, HeroOpts } from './hero-lifecycle';
import { observeCanvasResize, supportsWebGL } from './hero-lifecycle';

interface Well {
  x: number;
  y: number;
  d: number;
  s: number;
}

// The deepest well (global min) sits in the right half of normalized space — that's
// also where the marker spawns/roams, so it reliably settles in the well that's
// visually emphasized rather than drifting toward a shallower, off-center one.
const WELLS: Well[] = [
  { x: 0.78, y: 0.5, d: 0.9, s: 0.19 },
  { x: 0.26, y: 0.34, d: 0.5, s: 0.12 },
  { x: 0.62, y: 0.78, d: 0.4, s: 0.1 },
];

// Global minimum — deepest well, used as the settled marker position for the static frame.
const GLOBAL_MIN = WELLS[0];

function loss(nx: number, ny: number): number {
  let v = 1;
  for (const w of WELLS) {
    const dx = nx - w.x;
    const dy = ny - w.y;
    v -= w.d * Math.exp(-(dx * dx + dy * dy) / (2 * w.s * w.s));
  }
  return v;
}

function grad(nx: number, ny: number): [number, number] {
  const e = 0.001;
  return [
    (loss(nx + e, ny) - loss(nx - e, ny)) / (2 * e),
    (loss(nx, ny + e) - loss(nx, ny - e)) / (2 * e),
  ];
}

function updateHud(epoch: number, lossValue: number) {
  const epochEl = document.getElementById('hero-epoch');
  const lossEl = document.getElementById('hero-lossv');
  const accuracyEl = document.getElementById('hero-accuracy');
  if (epochEl) epochEl.textContent = String(epoch % 1000).padStart(3, '0');
  if (lossEl) lossEl.textContent = lossValue.toFixed(3);
  if (accuracyEl) accuracyEl.textContent = Math.max(0.5, Math.min(0.99, 1 - lossValue * 0.5)).toFixed(2);
}

function build2D(canvas: HTMLCanvasElement, opts: HeroOpts): HeroHandle {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { start() {}, stop() {}, drawStaticFrame() {}, destroy() {} };
  }

  const blockSize = opts.mobile ? 5 : 3;
  const trailMax = opts.mobile ? 70 : 130;

  let width = 0;
  let height = 0;
  let img: ImageData | null = null;
  let rafId = 0;
  let running = false;

  let marker = { x: 0.15, y: 0.2, vx: 0, vy: 0 };
  let trail: { x: number; y: number }[] = [];
  let epoch = 0;

  function buildField() {
    if (!ctx || width === 0 || height === 0) return;
    img = ctx.createImageData(width, height);
    const d = img.data;
    for (let py = 0; py < height; py += blockSize) {
      for (let px = 0; px < width; px += blockSize) {
        const v = loss(px / width, py / height);
        const t = Math.max(0, Math.min(1, v));
        const band = Math.pow(Math.max(0, Math.sin(t * 40)), 8) * 0.06;
        const val = Math.pow(1 - t, 2.4);
        const r = 7 + val * 26 + band * 90;
        const g = 7 + val * 46 + band * 80;
        const b = 11 + val * 95 + band * 150;
        for (let oy = 0; oy < blockSize && py + oy < height; oy++) {
          for (let ox = 0; ox < blockSize && px + ox < width; ox++) {
            const i = ((py + oy) * width + (px + ox)) * 4;
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
            d[i + 3] = 255;
          }
        }
      }
    }
  }

  const applySize = (w: number, h: number, dpr: number) => {
    width = w;
    height = h;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildField();
  };

  // Size synchronously so `img` exists immediately — drawStaticFrame() (reduced motion)
  // can be called right after initHero() returns, before the ResizeObserver's first
  // (async) callback would otherwise have fired.
  const initialRect = canvas.getBoundingClientRect();
  if (initialRect.width > 0 && initialRect.height > 0) {
    applySize(initialRect.width, initialRect.height, Math.min(window.devicePixelRatio || 1, 2));
  }

  const stopResizeObserver = observeCanvasResize(canvas, applySize);

  function reseed() {
    // Keep the marker well clear of the text column and close enough to the global
    // well (0.78, 0.5) that it reliably falls into that well rather than a
    // shallower, off-camera one.
    marker = { x: Math.random() * 0.25 + 0.65, y: Math.random() * 0.4 + 0.1, vx: 0, vy: 0 };
    trail = [];
    epoch = 0;
  }
  reseed();

  function renderFrame() {
    if (!ctx || !img) return;
    ctx.putImageData(img, 0, 0);

    for (let i = 1; i < trail.length; i++) {
      const a = i / trail.length;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x * width, trail[i - 1].y * height);
      ctx.lineTo(trail[i].x * width, trail[i].y * height);
      ctx.strokeStyle = `rgba(255,180,84,${a * 0.6})`;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    const mx = marker.x * width;
    const my = marker.y * height;
    const rg = ctx.createRadialGradient(mx, my, 0, mx, my, 24);
    rg.addColorStop(0, 'rgba(255,180,84,0.5)');
    rg.addColorStop(1, 'rgba(255,180,84,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(mx, my, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function tick() {
    const g = grad(marker.x, marker.y);
    marker.vx = 0.86 * marker.vx - 0.02 * g[0];
    marker.vy = 0.86 * marker.vy - 0.02 * g[1];
    marker.x = Math.max(0.02, Math.min(0.98, marker.x + marker.vx));
    marker.y = Math.max(0.02, Math.min(0.98, marker.y + marker.vy));
    trail.push({ x: marker.x, y: marker.y });
    if (trail.length > trailMax) trail.shift();
    epoch++;
    if (Math.hypot(marker.vx, marker.vy) < 0.0004 && epoch > 120) reseed();

    renderFrame();
    updateHud(epoch, loss(marker.x, marker.y));

    rafId = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    drawStaticFrame() {
      const settled = { x: GLOBAL_MIN.x, y: GLOBAL_MIN.y };
      trail = [];
      for (let i = 0; i < 16; i++) {
        const t = i / 15;
        trail.push({
          x: 0.65 + (settled.x - 0.65) * t,
          y: 0.15 + (settled.y - 0.15) * t,
        });
      }
      marker = { ...settled, vx: 0, vy: 0 };
      epoch = 240;
      renderFrame();
      updateHud(epoch, loss(marker.x, marker.y));
    },
    destroy() {
      running = false;
      cancelAnimationFrame(rafId);
      stopResizeObserver();
    },
  };
}

export function initHero(canvas: HTMLCanvasElement, opts: HeroOpts): HeroHandle {
  const use3D = !opts.reducedMotion && !opts.mobile && supportsWebGL();

  if (!use3D) {
    return build2D(canvas, opts);
  }

  // Wrap the async 3D module load behind a synchronous handle: queue whichever
  // action (start/static/stop) was requested most recently and replay it once
  // the real implementation (3D, or 2D on failure) attaches.
  let active: HeroHandle | null = null;
  let destroyed = false;
  let pending: 'start' | 'static' | 'stop' | null = null;

  function attach(handle: HeroHandle) {
    if (destroyed) {
      handle.destroy();
      return;
    }
    active = handle;
    if (pending === 'start') handle.start();
    else if (pending === 'static') handle.drawStaticFrame();
  }

  import('./hero-gradient-3d')
    .then((mod) => attach(mod.initHero(canvas, opts)))
    .catch(() => attach(build2D(canvas, opts)));

  return {
    start() {
      pending = 'start';
      active?.start();
    },
    stop() {
      pending = 'stop';
      active?.stop();
    },
    drawStaticFrame() {
      pending = 'static';
      active?.drawStaticFrame();
    },
    destroy() {
      destroyed = true;
      active?.destroy();
    },
  };
}
