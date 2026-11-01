export const backgrounds = [
  { slug: 'aero-shards', name: 'Aero Shards' },
  { slug: 'pattern-waves', name: 'Pattern Waves' },
  { slug: 'gradient-ascii', name: 'Gradient ASCII' },
  { slug: 'ghost-fibers', name: 'Ghost Fibers' },
  { slug: 'pixel-blast', name: 'Pixel Blast' },
  { slug: 'particles', name: 'Particles' },
] as const;

export type BackgroundVariant = typeof backgrounds[number]['slug'];
