export const ditherArt = [
  {
    slug: 'neural-loom', name: 'Neural Loom', label: 'Neural Loom',
    image: '/about-images/procedural/neural-loom.webp',
    alt: 'Programmatic illustration of blue and amber fibers braided around a three-dimensional torus knot',
  },
  {
    slug: 'attention-constellation', name: 'Attention Constellation', label: 'Constellation',
    image: '/about-images/procedural/attention-constellation.webp',
    alt: 'Programmatic spherical network of illuminated nodes, local connections, and selected amber routes',
  },
  {
    slug: 'latent-terrain', name: 'Latent Terrain', label: 'Latent Terrain',
    image: '/about-images/procedural/latent-terrain.webp',
    alt: 'Programmatic folded mathematical surface with a blue mesh and amber contour lines',
  },
] as const;

export type DitherArtVariant = typeof ditherArt[number]['slug'];
