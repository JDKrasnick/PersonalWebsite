export interface HeroMarker {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface HeroPoint {
  x: number;
  y: number;
}

// Motion is simulated at a fixed rate, independent of the display refresh rate.
// A 240 Hz integration step keeps motion smooth on high-refresh displays while
// time scaling preserves the same trajectory and elapsed-time speed everywhere.
export const HERO_MOTION = {
  referenceStepMs: 1000 / 60,
  stepMs: 1000 / 240,
  maxFrameDeltaMs: 100,
  dampingPerStep: 0.8,
  descentForcePerStep: 0.0045,
  maxSpeedPerStep: 0.006,
  settledSpeedPerStep: 0.00008,
  minimumDescentMs: 3000,
  returnDurationMs: 850,
} as const;

const HERO_START_PATTERN = [
  { u: 0.04, y: 0.14 },
  { u: 0.94, y: 0.72 },
  { u: 0.62, y: 0.16 },
  { u: 0.12, y: 0.7 },
  { u: 0.98, y: 0.28 },
  { u: 0.4, y: 0.76 },
  { u: 0.76, y: 0.12 },
  { u: 0.22, y: 0.64 },
] as const;
let heroStartCursor = Math.floor(Math.random() * HERO_START_PATTERN.length);

export function nextHeroStart(maxX = 0.9): HeroPoint {
  const boundedMaxX = Math.max(0.74, Math.min(0.9, maxX));
  const template = HERO_START_PATTERN[heroStartCursor % HERO_START_PATTERN.length];
  heroStartCursor += 1;
  return {
    // Scale a deliberately varied sequence into the current camera's safe
    // horizontal region. Cycling prevents repeated fallback starts while a
    // randomized initial cursor keeps reloads from always beginning alike.
    x: 0.64 + (boundedMaxX - 0.64) * template.u,
    y: template.y,
  };
}

export function smoothReturnProgress(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function lossHistoryToPoints(history: number[]) {
  if (history.length === 0) return '';

  const low = Math.min(...history);
  const high = Math.max(...history, low + 0.001);
  return history.map((value, index) => {
    const x = history.length === 1 ? 111 : (index / (history.length - 1)) * 111;
    // SVG's y-axis points downward, so lower loss belongs nearer the bottom.
    const normalizedLoss = (value - low) / (high - low);
    const y = 2 + (1 - normalizedLoss) * 25;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export function advanceHeroMarker(
  marker: HeroMarker,
  gradient: readonly [number, number],
  min: number,
  max: number,
) {
  const timeScale = HERO_MOTION.stepMs / HERO_MOTION.referenceStepMs;
  const damping = Math.pow(HERO_MOTION.dampingPerStep, timeScale);
  marker.vx = damping * marker.vx
    - HERO_MOTION.descentForcePerStep * gradient[0] * timeScale;
  marker.vy = damping * marker.vy
    - HERO_MOTION.descentForcePerStep * gradient[1] * timeScale;

  const speed = Math.hypot(marker.vx, marker.vy);
  if (speed > HERO_MOTION.maxSpeedPerStep) {
    const scale = HERO_MOTION.maxSpeedPerStep / speed;
    marker.vx *= scale;
    marker.vy *= scale;
  }

  marker.x = Math.max(min, Math.min(max, marker.x + marker.vx * timeScale));
  marker.y = Math.max(min, Math.min(max, marker.y + marker.vy * timeScale));
}
