import * as THREE from 'three';
import type { HeroHandle, HeroOpts } from './hero-lifecycle';
import { observeCanvasResize } from './hero-lifecycle';
import { GLOBAL_MIN, loss, lossGradient } from './hero-landscape';
import {
  advanceHeroMarker,
  HERO_MOTION,
  lossHistoryToPoints,
  nextHeroStart,
  smoothReturnProgress,
} from './hero-motion';

// This is intentionally much larger than the camera's frustum. It makes the
// terrain feel like an environment rather than a finite object in one corner,
// and removes the need to use fog to conceal a rectangular edge.
const WORLD = 34;
const H_SCALE = 5.2;
const TRAIL_LEN = 108;
const TRAIL_SAMPLE_MS = 1000 / 30;
// Ultra-wide screens expose much more of the horizontal frustum. Keep the mesh
// generously oversized so its edge never cuts into the hero background.
const SURFACE_PAD = 1.5;
const FIELD_MIN = -SURFACE_PAD + 0.02;
const FIELD_MAX = 1 + SURFACE_PAD - 0.02;

// The field extends past the original [0, 1] domain so every visible piece of
// terrain can accept a pointer drop, while the mesh boundary stays off-screen.
function surfaceCoord(t: number): number {
  return -SURFACE_PAD + t * (1 + SURFACE_PAD * 2);
}

// Mid-tier GPUs (few logical cores) get a coarser surface — still 3D, just cheaper.
const SEG = (navigator.hardwareConcurrency ?? 8) <= 4 ? 70 : 110;

function toWorld(nx: number, ny: number): [number, number, number] {
  return [(nx - 0.5) * WORLD, loss(nx, ny) * H_SCALE, (ny - 0.5) * WORLD];
}

interface ContourSample {
  x: number;
  y: number;
  value: number;
}

function contourIntersection(a: ContourSample, b: ContourSample, level: number) {
  const difference = b.value - a.value;
  const t = Math.abs(difference) < 1e-9
    ? 0.5
    : Math.max(0, Math.min(1, (level - a.value) / difference));
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

// Extract exact level sets from a triangulated sampling of the same loss
// function that shapes the surface. Within each triangle, contours at
// different levels are parallel and therefore cannot cross.
function buildContourPositions(levels: readonly number[]) {
  const resolution = 84;
  const fieldMin = -0.18;
  const fieldMax = 1.18;
  const samples: ContourSample[][] = [];
  for (let row = 0; row <= resolution; row++) {
    const y = fieldMin + (row / resolution) * (fieldMax - fieldMin);
    const sampleRow: ContourSample[] = [];
    for (let column = 0; column <= resolution; column++) {
      const x = fieldMin + (column / resolution) * (fieldMax - fieldMin);
      sampleRow.push({ x, y, value: loss(x, y) });
    }
    samples.push(sampleRow);
  }

  const positions: number[] = [];
  const addTriangle = (triangle: readonly ContourSample[], level: number) => {
    const intersections: { x: number; y: number }[] = [];
    for (let edge = 0; edge < 3; edge++) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      if ((a.value < level) !== (b.value < level)) {
        intersections.push(contourIntersection(a, b, level));
      }
    }
    if (intersections.length !== 2) return;
    for (const point of intersections) {
      positions.push(
        (point.x - 0.5) * WORLD,
        level * H_SCALE + 0.075,
        (point.y - 0.5) * WORLD,
      );
    }
  };

  for (const level of levels) {
    for (let row = 0; row < resolution; row++) {
      for (let column = 0; column < resolution; column++) {
        const topLeft = samples[row][column];
        const topRight = samples[row][column + 1];
        const bottomRight = samples[row + 1][column + 1];
        const bottomLeft = samples[row + 1][column];
        addTriangle([topLeft, topRight, bottomRight], level);
        addTriangle([topLeft, bottomRight, bottomLeft], level);
      }
    }
  }
  return positions;
}

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

export function initHero(canvas: HTMLCanvasElement, _opts: HeroOpts): HeroHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x07070a, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);

  const geo = new THREE.BufferGeometry();
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const cValley = new THREE.Color(0xffbd69);
  const cMid = new THREE.Color(0x718cff);
  const cPeak = new THREE.Color(0x222d74);

  for (let j = 0; j <= SEG; j++) {
    for (let i = 0; i <= SEG; i++) {
      const nx = surfaceCoord(i / SEG);
      const ny = surfaceCoord(j / SEG);
      const [wx, wy, wz] = toWorld(nx, ny);
      pos.push(wx, wy, wz);
      const t = Math.max(0, Math.min(1, loss(nx, ny)));
      const g = Math.pow(1 - t, 1.45);
      const c = cPeak
        .clone()
        .lerp(cMid, Math.min(1, 0.42 + g * 0.72))
        .lerp(cValley, Math.max(0, g - 0.22) * 1.28);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < SEG; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = j * (SEG + 1) + i;
      const b = a + 1;
      const c = a + SEG + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const surfaceMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.76,
    roughness: 0.62,
    metalness: 0.18,
    emissive: 0x101638,
    emissiveIntensity: 0.18,
    flatShading: false,
    side: THREE.DoubleSide,
  });
  const surface = new THREE.Mesh(geo, surfaceMaterial);
  scene.add(surface);

  // Deterministic samples turn the terrain into a model surface rather than a
  // decorative mesh. Warmer points mark lower-loss regions.
  const samplePositions: number[] = [];
  const sampleColors: number[] = [];
  const sampleHigh = new THREE.Color(0x9bacff);
  const sampleLow = new THREE.Color(0xffbd69);
  for (let i = 0; i < 56; i++) {
    const nx = 0.04 + (((i * 37) % 101) / 100) * 1.12;
    const ny = 0.03 + (((i * 61 + 17) % 103) / 102) * 1.02;
    const [wx, wy, wz] = toWorld(nx, ny);
    samplePositions.push(wx, wy + 0.12, wz);
    const lowLossWeight = Math.max(0, Math.min(1, 1 - loss(nx, ny)));
    const color = sampleHigh.clone().lerp(sampleLow, lowLossWeight * 0.8);
    sampleColors.push(color.r, color.g, color.b);
  }
  const sampleGeo = new THREE.BufferGeometry();
  sampleGeo.setAttribute('position', new THREE.Float32BufferAttribute(samplePositions, 3));
  sampleGeo.setAttribute('color', new THREE.Float32BufferAttribute(sampleColors, 3));
  const sampleMaterial = new THREE.PointsMaterial({
    vertexColors: true,
    size: 0.1,
    transparent: true,
    opacity: 0.32,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const samples = new THREE.Points(sampleGeo, sampleMaterial);
  samples.renderOrder = 2;
  scene.add(samples);

  const contourGeometries: THREE.BufferGeometry[] = [];
  const contourMaterials: THREE.LineBasicMaterial[] = [];
  const addContours = (levels: readonly number[], color: number, opacity: number) => {
    const contourGeo = new THREE.BufferGeometry();
    contourGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(buildContourPositions(levels), 3),
    );
    const contourMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    contourGeometries.push(contourGeo);
    contourMaterials.push(contourMaterial);
    const contours = new THREE.LineSegments(contourGeo, contourMaterial);
    contours.renderOrder = 2;
    scene.add(contours);
  };
  addContours([0.08, 0.16, 0.26, 0.38], 0xffd49a, 0.26);
  addContours([0.52, 0.68, 0.84, 1], 0xaab9ff, 0.16);

  const ambient = new THREE.HemisphereLight(0x9fb0ff, 0x111122, 1.45);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffd2a1, 2.2);
  key.position.set(-9, 15, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x829bff, 1.25);
  rim.position.set(10, 7, -12);
  scene.add(rim);
  const markerLight = new THREE.PointLight(0xffb454, 9, 10, 2);
  scene.add(markerLight);

  const markerMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffb454,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });
  const markerGeometry = new THREE.SphereGeometry(0.18, 24, 24);
  const marker = new THREE.Mesh(markerGeometry, markerMaterial);
  scene.add(marker);

  const clickIndicatorGeometry = new THREE.RingGeometry(0.16, 0.22, 40);
  const clickIndicatorMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd49a,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const clickIndicator = new THREE.Mesh(clickIndicatorGeometry, clickIndicatorMaterial);
  clickIndicator.visible = false;
  clickIndicator.renderOrder = 3;
  scene.add(clickIndicator);
  const clickNormal = new THREE.Vector3();
  const ringNormal = new THREE.Vector3(0, 0, 1);
  let clickPulse = 0;

  const trailPositions = new Float32Array(TRAIL_LEN * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeo.setDrawRange(0, 0);
  const trailMaterial = new THREE.LineBasicMaterial({
    color: 0xffb454,
    transparent: true,
    opacity: 0.62,
    depthTest: false,
  });
  const trail = new THREE.Line(trailGeo, trailMaterial);
  trail.renderOrder = 3;
  scene.add(trail);
  const trailPointMaterial = new THREE.PointsMaterial({
    color: 0xffd49a,
    size: 0.075,
    transparent: true,
    opacity: 0.72,
    sizeAttenuation: true,
    depthTest: false,
    depthWrite: false,
  });
  const trailPoints = new THREE.Points(trailGeo, trailPointMaterial);
  trailPoints.renderOrder = 4;
  scene.add(trailPoints);
  let trailPts: [number, number, number][] = [];

  let m = { x: 0.8, y: 0.2, vx: 0, vy: 0 };
  let epoch = 0;
  let descentElapsedMs = 0;
  let trailSampleElapsedMs = TRAIL_SAMPLE_MS;
  let lossHistory: number[] = [];
  let returnMotion: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    elapsedMs: number;
  } | null = null;
  function seedAt(x: number, y: number) {
    m = {
      x: Math.max(FIELD_MIN, Math.min(FIELD_MAX, x)),
      y: Math.max(FIELD_MIN, Math.min(FIELD_MAX, y)),
      vx: 0,
      vy: 0,
    };
    trailPts = [];
    epoch = 0;
    descentElapsedMs = 0;
    trailSampleElapsedMs = TRAIL_SAMPLE_MS;
    lossHistory = [loss(m.x, m.y)];
    returnMotion = null;
  }
  function reseed() {
    // Keep the marker well clear of the text column and close enough to the global
    // well (0.78, 0.5) that it reliably falls into that well rather than a
    // shallower, off-camera one.
    const start = nextHeroStart(0.69 + camera.aspect * 0.09);
    seedAt(start.x, start.y);
  }
  reseed();

  let rafId = 0;
  let running = false;
  let t = 0;
  let lastFrameTime: number | null = null;
  let simulationAccumulatorMs = 0;

  function positionMarker(nx: number, ny: number) {
    const [wx, wy, wz] = toWorld(nx, ny);
    marker.position.set(wx, wy + 0.2, wz);
    markerLight.position.set(wx, wy + 1.25, wz);
    return [wx, wy, wz] as const;
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hero = canvas.closest('.hero');
  const interactionTarget = hero instanceof HTMLElement ? hero : canvas;
  const localOptimumToast = document.getElementById('hero-local-optimum-toast');
  const toastPosition = new THREE.Vector3();
  let toastTimer = 0;
  let draggingMarker = false;

  function showNonGlobalMaximumToast() {
    if (!(localOptimumToast instanceof HTMLElement)) return;
    const rect = canvas.getBoundingClientRect();
    toastPosition.copy(marker.position).project(camera);
    const left = Math.min(rect.width - 86, Math.max(86, (toastPosition.x * 0.5 + 0.5) * rect.width));
    const top = Math.min(rect.height - 26, Math.max(18, (-toastPosition.y * 0.5 + 0.5) * rect.height - 30));
    localOptimumToast.style.left = `${left}px`;
    localOptimumToast.style.top = `${top}px`;
    localOptimumToast.hidden = false;
    localOptimumToast.classList.remove('is-visible');
    void localOptimumToast.offsetWidth;
    localOptimumToast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      localOptimumToast.hidden = true;
      localOptimumToast.classList.remove('is-visible');
    }, 1300);
  }

  function seedFromPointer(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(surface, false)[0];
    if (!hit) return;
    seedAt(hit.point.x / WORLD + 0.5, hit.point.z / WORLD + 0.5);
    const [dx, dy] = lossGradient(m.x, m.y);
    clickNormal.set(-(dx * H_SCALE) / WORLD, 1, -(dy * H_SCALE) / WORLD).normalize();
    clickIndicator.position.copy(hit.point).addScaledVector(clickNormal, 0.08);
    clickIndicator.quaternion.setFromUnitVectors(ringNormal, clickNormal);
    clickIndicator.scale.setScalar(1);
    clickIndicatorMaterial.opacity = 0.8;
    clickIndicator.visible = true;
    clickPulse = 1;
    positionMarker(m.x, m.y);
    updateHud(Math.floor(epoch), loss(m.x, m.y), lossHistory);
  }

  function onPointerDown(event: PointerEvent) {
    if (event.target instanceof Element && event.target.closest('a, button')) return;
    draggingMarker = true;
    seedFromPointer(event);
    interactionTarget.setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event: PointerEvent) {
    if (draggingMarker && event.buttons & 1) seedFromPointer(event);
  }
  function stopDraggingMarker() {
    draggingMarker = false;
  }
  interactionTarget.addEventListener('pointerdown', onPointerDown);
  interactionTarget.addEventListener('pointermove', onPointerMove);
  interactionTarget.addEventListener('pointerup', stopDraggingMarker);
  interactionTarget.addEventListener('pointercancel', stopDraggingMarker);

  function renderFrame() {
    // Keep the framing stable: just enough motion to feel alive, without moving
    // the terrain or the marker across the text column. The overscaled surface
    // runs beyond every edge of the frame, so there is no false horizon to hide.
    const drift = Math.sin(t * 0.2);
    camera.position.set(4.2 + drift * 0.65, 15.2 + Math.sin(t * 0.31) * 0.25, 21 + Math.cos(t * 0.2) * 0.45);
    camera.lookAt(3.8, 0.55, -0.7);
    renderer.render(scene, camera);
  }

  function advanceSimulation() {
    if (returnMotion) {
      returnMotion.elapsedMs += HERO_MOTION.stepMs;
      const progress = Math.min(1, returnMotion.elapsedMs / HERO_MOTION.returnDurationMs);
      const eased = smoothReturnProgress(progress);
      m.x = returnMotion.fromX + (returnMotion.toX - returnMotion.fromX) * eased;
      m.y = returnMotion.fromY + (returnMotion.toY - returnMotion.fromY) * eased;
      m.vx = 0;
      m.vy = 0;

      positionMarker(m.x, m.y);

      if (progress >= 1) {
        returnMotion = null;
        trailPts = [];
        epoch = 0;
        descentElapsedMs = 0;
        trailSampleElapsedMs = TRAIL_SAMPLE_MS;
        lossHistory = [loss(m.x, m.y)];
      }
      return;
    }

    advanceHeroMarker(m, lossGradient(m.x, m.y), FIELD_MIN, FIELD_MAX);
    descentElapsedMs += HERO_MOTION.stepMs;
    trailSampleElapsedMs += HERO_MOTION.stepMs;
    epoch += HERO_MOTION.stepMs / HERO_MOTION.referenceStepMs;
    if (
      Math.hypot(m.vx, m.vy) < HERO_MOTION.settledSpeedPerStep
      && descentElapsedMs >= HERO_MOTION.minimumDescentMs
    ) {
      const settledAtGlobalMinimum = Math.hypot(m.x - GLOBAL_MIN.x, m.y - GLOBAL_MIN.y) < 0.12;
      if (!settledAtGlobalMinimum) showNonGlobalMaximumToast();
      const start = nextHeroStart(0.69 + camera.aspect * 0.09);
      returnMotion = {
        fromX: m.x,
        fromY: m.y,
        toX: start.x,
        toY: start.y,
        elapsedMs: 0,
      };
      // Repositioning is not an optimization step. Clear the completed descent
      // so the uphill reset cannot read as a second training trajectory.
      trailPts = [];
      m.vx = 0;
      m.vy = 0;
    }

    const [wx, wy, wz] = positionMarker(m.x, m.y);
    if (!returnMotion && trailSampleElapsedMs >= TRAIL_SAMPLE_MS) {
      trailPts.push([wx, wy + 0.13, wz]);
      if (trailPts.length > TRAIL_LEN) trailPts.shift();
      trailSampleElapsedMs %= TRAIL_SAMPLE_MS;
    }

    const currentLoss = loss(m.x, m.y);
    lossHistory.push(currentLoss);
    if (lossHistory.length > 44) lossHistory.shift();
  }

  function tick(now: number) {
    // A fixed simulation step makes the marker's path and speed identical on
    // 60 Hz, 120 Hz, and variable-refresh displays. Long inactive-tab gaps are
    // discarded so returning to the page cannot make the ball jump ahead.
    const frameDeltaMs = lastFrameTime === null
      ? HERO_MOTION.stepMs
      : Math.min(HERO_MOTION.maxFrameDeltaMs, now - lastFrameTime);
    lastFrameTime = now;
    simulationAccumulatorMs += frameDeltaMs;
    t += frameDeltaMs * 0.0003;

    while (simulationAccumulatorMs >= HERO_MOTION.stepMs) {
      advanceSimulation();
      simulationAccumulatorMs -= HERO_MOTION.stepMs;
    }

    if (clickPulse > 0) {
      clickPulse = Math.max(0, clickPulse - frameDeltaMs * 0.00084);
      clickIndicator.scale.setScalar(1 + (1 - clickPulse) * 1.8);
      clickIndicatorMaterial.opacity = clickPulse * 0.8;
      clickIndicator.visible = clickPulse > 0;
    }

    const [wx, wy, wz] = positionMarker(m.x, m.y);
    for (let i = 0; i < TRAIL_LEN; i++) {
      const p = trailPts[i] || trailPts[0] || [wx, wy, wz];
      trailPositions[i * 3] = p[0];
      trailPositions[i * 3 + 1] = p[1];
      trailPositions[i * 3 + 2] = p[2];
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.setDrawRange(0, trailPts.length);

    const currentLoss = loss(m.x, m.y);
    renderFrame();
    updateHud(Math.floor(epoch), currentLoss, lossHistory);

    rafId = requestAnimationFrame(tick);
  }

  function applySize(w: number, h: number, dpr: number) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h || 1;
    camera.updateProjectionMatrix();
    if (!running) renderFrame();
  }

  // Size synchronously so the renderer/camera match the real layout before the
  // first render — otherwise start()/drawStaticFrame() called immediately after
  // initHero() returns would render at the canvas's default 300x150 buffer,
  // stretched and distorted, until the async ResizeObserver's first callback fires.
  const initialRect = canvas.getBoundingClientRect();
  if (initialRect.width > 0 && initialRect.height > 0) {
    applySize(initialRect.width, initialRect.height, Math.min(window.devicePixelRatio || 1, 2));
  }

  const stopResizeObserver = observeCanvasResize(canvas, applySize);

  function onContextLost(e: Event) {
    e.preventDefault();
    running = false;
    cancelAnimationFrame(rafId);
  }
  function onContextRestored() {
    if (!destroyed) start();
  }
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);

  let destroyed = false;

  function start() {
    if (running || destroyed) return;
    running = true;
    lastFrameTime = null;
    simulationAccumulatorMs = 0;
    rafId = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    lastFrameTime = null;
    simulationAccumulatorMs = 0;
    cancelAnimationFrame(rafId);
  }

  return {
    start,
    stop,
    drawStaticFrame() {
      m = { x: GLOBAL_MIN.x, y: GLOBAL_MIN.y, vx: 0, vy: 0 };
      trailPts = [];
      lossHistory = [];
      for (let i = 0; i < 16; i++) {
        const tt = i / 15;
        const nx = 0.65 + (GLOBAL_MIN.x - 0.65) * tt;
        const ny = 0.15 + (GLOBAL_MIN.y - 0.15) * tt;
        const [wx, wy, wz] = toWorld(nx, ny);
        trailPts.push([wx, wy + 0.13, wz]);
        lossHistory.push(loss(nx, ny));
      }
      for (let i = 0; i < TRAIL_LEN; i++) {
        const p = trailPts[i] || trailPts[trailPts.length - 1] || [0, 0, 0];
        trailPositions[i * 3] = p[0];
        trailPositions[i * 3 + 1] = p[1];
        trailPositions[i * 3 + 2] = p[2];
      }
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.setDrawRange(0, trailPts.length);
      epoch = 280;
      positionMarker(m.x, m.y);
      renderFrame();
      updateHud(epoch, loss(m.x, m.y), lossHistory);
    },
    destroy() {
      destroyed = true;
      running = false;
      cancelAnimationFrame(rafId);
      window.clearTimeout(toastTimer);
      stopResizeObserver();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      interactionTarget.removeEventListener('pointerdown', onPointerDown);
      interactionTarget.removeEventListener('pointermove', onPointerMove);
      interactionTarget.removeEventListener('pointerup', stopDraggingMarker);
      interactionTarget.removeEventListener('pointercancel', stopDraggingMarker);
      geo.dispose();
      surfaceMaterial.dispose();
      sampleGeo.dispose();
      sampleMaterial.dispose();
      contourGeometries.forEach((contourGeo) => contourGeo.dispose());
      contourMaterials.forEach((contourMaterial) => contourMaterial.dispose());
      markerGeometry.dispose();
      markerMaterial.dispose();
      clickIndicatorGeometry.dispose();
      clickIndicatorMaterial.dispose();
      trailGeo.dispose();
      trailMaterial.dispose();
      trailPointMaterial.dispose();
      renderer.dispose();
    },
  };
}
