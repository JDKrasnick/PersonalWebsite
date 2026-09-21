import type { HeroHandle, HeroOpts } from './hero-lifecycle';
import { observeCanvasResize, supportsWebGL } from './hero-lifecycle';
import { GLOBAL_MIN, loss, lossGradient } from './hero-landscape';
import {
  advanceHeroMarker,
  HERO_MOTION,
  lossHistoryToPoints,
  nextHeroStart,
  smoothReturnProgress,
} from './hero-motion';

function updateHud(epoch: number, lossValue: number, history: number[] = []) {
  const epochEl = document.getElementById('hero-epoch');
  const lossEl = document.getElementById('hero-lossv');
  const accuracyEl = document.getElementById('hero-accuracy');
  if (epochEl) epochEl.textContent = String(epoch % 1000).padStart(3, '0');
  if (lossEl) lossEl.textContent = lossValue.toFixed(3);
  if (accuracyEl) accuracyEl.textContent = Math.max(0.5, Math.min(0.99, 1 - lossValue * 0.5)).toFixed(2);
  const chart = document.getElementById('hero-loss-chart');
  if (chart instanceof SVGPolylineElement && history.length > 0) {
    chart.setAttribute('points', lossHistoryToPoints(history));
  }
}

function build2D(canvas: HTMLCanvasElement, opts: HeroOpts): HeroHandle {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { start() {}, stop() {}, drawStaticFrame() {}, destroy() {} };
  }

  const blockSize = opts.mobile ? 5 : 3;
  const trailMax = opts.mobile ? 72 : 108;
  const trailSampleMs = 1000 / 30;

  let width = 0;
  let height = 0;
  let img: ImageData | null = null;
  let rafId = 0;
  let running = false;
  let lastFrameTime: number | null = null;
  let simulationAccumulatorMs = 0;

  let marker = { x: 0.15, y: 0.2, vx: 0, vy: 0 };
  let trail: { x: number; y: number }[] = [];
  let epoch = 0;
  let descentElapsedMs = 0;
  let trailSampleElapsedMs = trailSampleMs;
  let lossHistory: number[] = [];
  let returnMotion: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    elapsedMs: number;
  } | null = null;

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
    const start = nextHeroStart();
    marker = { ...start, vx: 0, vy: 0 };
    trail = [];
    epoch = 0;
    descentElapsedMs = 0;
    trailSampleElapsedMs = trailSampleMs;
    lossHistory = [loss(marker.x, marker.y)];
    returnMotion = null;
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

  function advanceSimulation() {
    if (returnMotion) {
      returnMotion.elapsedMs += HERO_MOTION.stepMs;
      const progress = Math.min(1, returnMotion.elapsedMs / HERO_MOTION.returnDurationMs);
      const eased = smoothReturnProgress(progress);
      marker.x = returnMotion.fromX + (returnMotion.toX - returnMotion.fromX) * eased;
      marker.y = returnMotion.fromY + (returnMotion.toY - returnMotion.fromY) * eased;
      marker.vx = 0;
      marker.vy = 0;
      if (progress >= 1) {
        returnMotion = null;
        trail = [];
        epoch = 0;
        descentElapsedMs = 0;
        trailSampleElapsedMs = trailSampleMs;
        lossHistory = [loss(marker.x, marker.y)];
      }
      return;
    }

    advanceHeroMarker(marker, lossGradient(marker.x, marker.y), 0.02, 0.98);
    descentElapsedMs += HERO_MOTION.stepMs;
    trailSampleElapsedMs += HERO_MOTION.stepMs;
    epoch += HERO_MOTION.stepMs / HERO_MOTION.referenceStepMs;
    if (
      Math.hypot(marker.vx, marker.vy) < HERO_MOTION.settledSpeedPerStep
      && descentElapsedMs >= HERO_MOTION.minimumDescentMs
    ) {
      const start = nextHeroStart();
      returnMotion = {
        fromX: marker.x,
        fromY: marker.y,
        toX: start.x,
        toY: start.y,
        elapsedMs: 0,
      };
      trail = [];
      marker.vx = 0;
      marker.vy = 0;
    }

    if (!returnMotion && trailSampleElapsedMs >= trailSampleMs) {
      trail.push({ x: marker.x, y: marker.y });
      if (trail.length > trailMax) trail.shift();
      trailSampleElapsedMs %= trailSampleMs;
    }

    const currentLoss = loss(marker.x, marker.y);
    lossHistory.push(currentLoss);
    if (lossHistory.length > 44) lossHistory.shift();
  }

  function tick(now: number) {
    const frameDeltaMs = lastFrameTime === null
      ? HERO_MOTION.stepMs
      : Math.min(HERO_MOTION.maxFrameDeltaMs, now - lastFrameTime);
    lastFrameTime = now;
    simulationAccumulatorMs += frameDeltaMs;
    while (simulationAccumulatorMs >= HERO_MOTION.stepMs) {
      advanceSimulation();
      simulationAccumulatorMs -= HERO_MOTION.stepMs;
    }

    const currentLoss = loss(marker.x, marker.y);
    renderFrame();
    updateHud(Math.floor(epoch), currentLoss, lossHistory);

    rafId = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastFrameTime = null;
      simulationAccumulatorMs = 0;
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      lastFrameTime = null;
      simulationAccumulatorMs = 0;
      cancelAnimationFrame(rafId);
    },
    drawStaticFrame() {
      const settled = { x: GLOBAL_MIN.x, y: GLOBAL_MIN.y };
      trail = [];
      lossHistory = [];
      for (let i = 0; i < 16; i++) {
        const t = i / 15;
        trail.push({
          x: 0.65 + (settled.x - 0.65) * t,
          y: 0.15 + (settled.y - 0.15) * t,
        });
        lossHistory.push(loss(
          0.65 + (settled.x - 0.65) * t,
          0.15 + (settled.y - 0.15) * t
        ));
      }
      marker = { ...settled, vx: 0, vy: 0 };
      epoch = 240;
      renderFrame();
      updateHud(Math.floor(epoch), loss(marker.x, marker.y), lossHistory);
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
