# About effect previews

Three full-site previews change only the About section. The selected Ghost Fibers page background, hero, bio, and profile facts are shared with the homepage. The homepage itself retains its ordinary About section until a variant is selected.

- `/about-effects/crystalized-ball/#about`: interactive electric glass sphere below the profile details on the right.
- `/about-effects/dither-veil/#about`: a dithered AI artwork that reveals color under the pointer, on tap, or through the keyboard-accessible Reveal image button.
- `/about-effects/laser-flow/`: scroll from the hero to pour light onto the profile details and over the panel's corners.

Crystalized Ball and Dither Veil retain the homepage's profile panel position, with their artwork below the details in the right column. Laser Flow lowers the panel by 64px on desktop and leaves space above it on mobile for the beam; its canvas sits behind the panel and extends into the hero's fade on desktop. The bottom switcher compares the three routes and provides Pause/Play. It becomes a native select on mobile. Home returns to the ordinary homepage. Preview routes are noindex. All factual copy and profile details remain ordinary selectable text, outside the animation canvases.

The art loads near the viewport and unmounts offscreen or while the document is hidden. Reduced-motion starts paused; the same preference updates live. Laser Flow uses a smaller Waterfall stream landing 86 percent across the profile panel. Its shorter spread fades along the longer left edge while concentrating the spill at the right corner. Subtle changes in the path, thickness, surface flow, and falling spill give it a liquid feel. Its source peeks into the final 24–48px of the hero and spills onto the lowered profile panel. Scrolling triggers the original timed intro once the About heading and top of the details panel are in view. The beam then descends, spreads, and spills over the corners over roughly five seconds, even when scrolling stops or the visitor jumps straight to About. There are no continuous React updates for animation progress. The shader is capped at DPR 1.25 and 30fps and renders only the beam and spill area. Ghost Fibers keeps animating through About and Experience, capped at 30fps rather than freezing near the laser. Reduced motion shows settled light after the trigger. Dither Veil has no continuous wander animation and settles when the pointer leaves. Its local paused adaptation freezes the current reveal, disables pointer wakes, and draws a static frame for reduced motion. These previews use the already-installed React and OGL dependencies.

## Component sources

Official React Bits TypeScript/CSS components are vendored under `src/components/about-effects/react-bits/` from revision `4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4`. Dither Veil adds the paused behavior described above. Laser Flow adds optional `maxFps`, `surfacePosition`, and `liquidity` props, caps DPR to the device's actual ratio, and respects Pause during the intro. Its optional liquid motion adds small wave variations without extra rendering passes or simulation buffers; it defaults to zero for the original shader appearance. The retained license is `docs/licenses/react-bits.txt`. Each preview links to its source page on React Bits.

## Programmatic image options

Dither Veil now uses three programmatically rendered images. No AI-generated image is used in the active previews. The original generated `neural-manifold.webp` is retained as an unused earlier asset.

- `/about-effects/dither-veil/neural-loom/#about`: Neural Loom, a braided tube following a (2, 3) torus knot.
- `/about-effects/dither-veil/attention-constellation/#about`: Attention Constellation, a Fibonacci sphere with nearest-neighbor connections and selected long routes.
- `/about-effects/dither-veil/latent-terrain/#about`: Latent Terrain, an analytic surface combining Gaussian peaks, a saddle, and sinusoidal folds.

These are mathematical illustrations inspired by AI, rather than model measurements. The image selector sits below the reveal; the original Dither Veil route defaults to Neural Loom. Each illustration uses a contain fit to preserve its full silhouette.

Regenerate the 1200 by 900 WebPs with `python3 scripts/generate-about-art.py` (NumPy and Pillow required). The renderer computes geometry, perspective projection, depth sorting, linework, color, and glow. It has no image inputs, network access, or AI calls. Fixed seeds make the files reproducible in the recorded environment. Assets and their sizes, seeds, dependency versions, and SHA-256 hashes are under `public/about-images/procedural/`, with metadata in `provenance.json`.

These are local previews. No production deployment is included.
