import * as THREE from 'three';
import type { HeroHandle, HeroOpts } from './hero-lifecycle';
import { observeCanvasResize } from './hero-lifecycle';

interface Well {
  x: number;
  y: number;
  d: number;
  s: number;
}

// The global minimum deliberately lives in the open right side of the hero. The
// text stays quiet on the left, while the descent has a generous, visible runway.
const WELLS: Well[] = [
  { x: 0.76, y: 0.52, d: 0.7, s: 0.22 },
  { x: 0.34, y: 0.29, d: 0.28, s: 0.12 },
  { x: 0.59, y: 0.78, d: 0.23, s: 0.11 },
];
const GLOBAL_MIN = WELLS[0];

// This is intentionally much larger than the camera's frustum. It makes the
// terrain feel like an environment rather than a finite object in one corner,
// and removes the need to use fog to conceal a rectangular edge.
const WORLD = 34;
const H_SCALE = 6;
const TRAIL_LEN = 120;
const GRID_LINES = 18;
const SURFACE_PAD = 0.45;
const FIELD_MIN = -SURFACE_PAD + 0.02;
const FIELD_MAX = 1 + SURFACE_PAD - 0.02;

// The field extends past the original [0, 1] domain so every visible piece of
// terrain can accept a pointer drop, while the mesh boundary stays off-screen.
function surfaceCoord(t: number): number {
  return -SURFACE_PAD + t * (1 + SURFACE_PAD * 2);
}

// Mid-tier GPUs (few logical cores) get a coarser surface — still 3D, just cheaper.
const SEG = (navigator.hardwareConcurrency ?? 8) <= 4 ? 70 : 110;

function loss(nx: number, ny: number): number {
  // A broad, shallow basin gives the whole plane readable relief. The Gaussian
  // wells then carve local minima into it instead of leaving a mostly-flat slab.
  const dx = nx - 0.68;
  const dy = ny - 0.52;
  let v = 0.78 + 0.34 * (dx * dx + dy * dy * 0.76);
  v += 0.028 * Math.sin(nx * Math.PI * 2.4) * Math.cos(ny * Math.PI * 2.1);
  for (const w of WELLS) {
    const wx = nx - w.x;
    const wy = ny - w.y;
    v -= w.d * Math.exp(-(wx * wx + wy * wy) / (2 * w.s * w.s));
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

function toWorld(nx: number, ny: number): [number, number, number] {
  return [(nx - 0.5) * WORLD, loss(nx, ny) * H_SCALE, (ny - 0.5) * WORLD];
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
    const low = Math.min(...history);
    const high = Math.max(...history, low + 0.001);
    const points = history.map((value, i) => {
      const x = history.length === 1 ? 111 : (i / (history.length - 1)) * 111;
      const y = 2 + ((value - low) / (high - low)) * 25;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    chart.setAttribute('points', points.join(' '));
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
    emissiveIntensity: 0.28,
    flatShading: false,
    side: THREE.DoubleSide,
  });
  const surface = new THREE.Mesh(geo, surfaceMaterial);
  scene.add(surface);

  // A coarse, separate line grid remains legible at hero scale. A dense mesh
  // wireframe aliases away on high-DPI screens and makes the material look noisy.
  const gridPositions: number[] = [];
  for (let line = 0; line <= GRID_LINES; line++) {
    const u = surfaceCoord(line / GRID_LINES);
    for (let step = 0; step < SEG; step++) {
      const a = surfaceCoord(step / SEG);
      const b = surfaceCoord((step + 1) / SEG);
      const rowA = toWorld(a, u);
      const rowB = toWorld(b, u);
      const colA = toWorld(u, a);
      const colB = toWorld(u, b);
      gridPositions.push(...rowA, ...rowB, ...colA, ...colB);
    }
  }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
  const gridMaterial = new THREE.LineBasicMaterial({
    color: 0xaab9ff,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const grid = new THREE.LineSegments(gridGeo, gridMaterial);
  grid.renderOrder = 1;
  scene.add(grid);

  // Concentric contours make the destination read as a true basin without
  // relying on the marker's glow.
  const contourMaterial = new THREE.LineBasicMaterial({
    color: 0xffd49a,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const contourGeometries: THREE.BufferGeometry[] = [];
  for (const radius of [0.055, 0.09, 0.13, 0.17, 0.215, 0.265]) {
    const contourPositions: number[] = [];
    for (let step = 0; step < 72; step++) {
      const theta = (step / 72) * Math.PI * 2;
      const nx = GLOBAL_MIN.x + Math.cos(theta) * radius;
      const ny = GLOBAL_MIN.y + Math.sin(theta) * radius;
      const [wx, wy, wz] = toWorld(nx, ny);
      contourPositions.push(wx, wy + 0.075, wz);
    }
    const contourGeo = new THREE.BufferGeometry();
    contourGeo.setAttribute('position', new THREE.Float32BufferAttribute(contourPositions, 3));
    contourGeometries.push(contourGeo);
    const contour = new THREE.LineLoop(contourGeo, contourMaterial);
    contour.renderOrder = 2;
    scene.add(contour);
  }

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

  const trailPositions = new Float32Array(TRAIL_LEN * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trailMaterial = new THREE.LineBasicMaterial({
    color: 0xffb454,
    transparent: true,
    opacity: 0.7,
  });
  const trail = new THREE.Line(trailGeo, trailMaterial);
  scene.add(trail);
  let trailPts: [number, number, number][] = [];

  let m = { x: 0.8, y: 0.2, vx: 0, vy: 0 };
  let epoch = 0;
  let lossHistory: number[] = [];
  function seedAt(x: number, y: number) {
    m = {
      x: Math.max(FIELD_MIN, Math.min(FIELD_MAX, x)),
      y: Math.max(FIELD_MIN, Math.min(FIELD_MAX, y)),
      vx: 0,
      vy: 0,
    };
    trailPts = [];
    epoch = 0;
    lossHistory = [loss(m.x, m.y)];
  }
  function reseed() {
    // Keep the marker well clear of the text column and close enough to the global
    // well (0.78, 0.5) that it reliably falls into that well rather than a
    // shallower, off-camera one.
    seedAt(Math.random() * 0.22 + 0.64, Math.random() * 0.58 + 0.18);
  }
  reseed();

  let rafId = 0;
  let running = false;
  let t = 0;

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
  let draggingMarker = false;
  function seedFromPointer(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(surface, false)[0];
    if (!hit) return;
    seedAt(hit.point.x / WORLD + 0.5, hit.point.z / WORLD + 0.5);
    positionMarker(m.x, m.y);
    updateHud(epoch, loss(m.x, m.y), lossHistory);
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

  function tick() {
    t += 0.005;
    const g = grad(m.x, m.y);
    // A measured descent keeps the marker readable as it crosses each grid ring.
    m.vx = 0.8 * m.vx - 0.012 * g[0];
    m.vy = 0.8 * m.vy - 0.012 * g[1];
    m.x = Math.max(FIELD_MIN, Math.min(FIELD_MAX, m.x + m.vx));
    m.y = Math.max(FIELD_MIN, Math.min(FIELD_MAX, m.y + m.vy));
    epoch++;
    if (Math.hypot(m.vx, m.vy) < 0.0004 && epoch > 140) reseed();

    const [wx, wy, wz] = positionMarker(m.x, m.y);
    trailPts.push([wx, wy + 0.08, wz]);
    if (trailPts.length > TRAIL_LEN) trailPts.shift();
    for (let i = 0; i < TRAIL_LEN; i++) {
      const p = trailPts[i] || trailPts[0] || [wx, wy, wz];
      trailPositions[i * 3] = p[0];
      trailPositions[i * 3 + 1] = p[1];
      trailPositions[i * 3 + 2] = p[2];
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.setDrawRange(0, trailPts.length);

    const currentLoss = loss(m.x, m.y);
    lossHistory.push(currentLoss);
    if (lossHistory.length > 44) lossHistory.shift();
    renderFrame();
    updateHud(epoch, currentLoss, lossHistory);

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
    rafId = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
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
        trailPts.push([wx, wy + 0.08, wz]);
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
      stopResizeObserver();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      interactionTarget.removeEventListener('pointerdown', onPointerDown);
      interactionTarget.removeEventListener('pointermove', onPointerMove);
      interactionTarget.removeEventListener('pointerup', stopDraggingMarker);
      interactionTarget.removeEventListener('pointercancel', stopDraggingMarker);
      geo.dispose();
      surfaceMaterial.dispose();
      gridGeo.dispose();
      gridMaterial.dispose();
      contourGeometries.forEach((contourGeo) => contourGeo.dispose());
      contourMaterial.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      trailGeo.dispose();
      trailMaterial.dispose();
      renderer.dispose();
    },
  };
}
