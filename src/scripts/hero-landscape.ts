interface LandscapeFeature {
  x: number;
  y: number;
  amplitude: number;
  sx: number;
  sy: number;
}

// A deliberately non-convex 2D slice: several minima compete across sharp
// ridges and asymmetric peaks, like normalized neural-loss visualizations.
export const LOSS_BASINS: LandscapeFeature[] = [
  { x: 0.76, y: 0.52, amplitude: -0.82, sx: 0.16, sy: 0.2 },
  { x: 0.31, y: 0.3, amplitude: -0.42, sx: 0.1, sy: 0.14 },
  { x: 0.58, y: 0.8, amplitude: -0.48, sx: 0.13, sy: 0.09 },
  { x: 0.16, y: 0.7, amplitude: -0.2, sx: 0.09, sy: 0.15 },
];

const LOSS_PEAKS: LandscapeFeature[] = [
  { x: 0.48, y: 0.25, amplitude: 0.34, sx: 0.14, sy: 0.17 },
  { x: 0.9, y: 0.77, amplitude: 0.3, sx: 0.16, sy: 0.13 },
  { x: 0.24, y: 0.56, amplitude: 0.25, sx: 0.18, sy: 0.12 },
];

export const GLOBAL_MIN = LOSS_BASINS[0];
const LOSS_FLOOR_OFFSET = 0.061;

function featureValue(nx: number, ny: number, feature: LandscapeFeature) {
  const dx = (nx - feature.x) / feature.sx;
  const dy = (ny - feature.y) / feature.sy;
  return feature.amplitude * Math.exp(-0.5 * (dx * dx + dy * dy));
}

export function loss(nx: number, ny: number): number {
  const dx = nx - 0.62;
  const dy = ny - 0.5;
  let value = 0.72 + 0.065 * (dx * dx + dy * dy * 0.82);

  for (const feature of LOSS_PEAKS) value += featureValue(nx, ny, feature);
  for (const feature of LOSS_BASINS) value += featureValue(nx, ny, feature);

  // Cross-frequency ripples introduce saddles and narrow connecting valleys
  // without overpowering the named basins and peaks.
  const envelope = Math.exp(-0.24 * (dx * dx + dy * dy));
  value += envelope * (
    0.035 * Math.sin(nx * Math.PI * 4.6 + ny * 1.7)
    + 0.024 * Math.cos(ny * Math.PI * 5.2 - nx * 2.3)
    + 0.012 * Math.sin((nx + ny) * Math.PI * 7.2)
  );
  // The synthetic Gaussian wells dip slightly below the baseline. A constant
  // offset preserves the complete gradient field while keeping displayed loss
  // non-negative, as visitors expect from this training-loss metaphor.
  return value + LOSS_FLOOR_OFFSET;
}

export function lossGradient(nx: number, ny: number): [number, number] {
  const epsilon = 0.00075;
  return [
    (loss(nx + epsilon, ny) - loss(nx - epsilon, ny)) / (2 * epsilon),
    (loss(nx, ny + epsilon) - loss(nx, ny - epsilon)) / (2 * epsilon),
  ];
}
