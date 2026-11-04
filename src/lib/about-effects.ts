export const aboutEffects = [
  { slug: 'crystalized-ball', name: 'Crystalized Ball' },
  { slug: 'dither-veil', name: 'Dither Veil' },
  { slug: 'laser-flow', name: 'Laser Flow' },
] as const;

export type AboutEffectVariant = typeof aboutEffects[number]['slug'];
