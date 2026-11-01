# Background previews

The homepage at `/` uses the selected Ghost Fibers background without the comparison switcher. Six complete portfolio previews remain available:

- `/backgrounds/aero-shards/#about`
- `/backgrounds/pattern-waves/#about`
- `/backgrounds/gradient-ascii/#about`
- `/backgrounds/ghost-fibers/#about`
- `/backgrounds/pixel-blast/#about`
- `/backgrounds/particles/#about`

Run `npm run dev` and open a preview. The bottom switcher preserves your scroll position when comparing effects. On smaller screens it becomes a native select. Pause/Play controls animation; reduced-motion preferences start paused. Home returns to the Ghost Fibers homepage. Preview routes are marked noindex; the homepage remains indexable.

The effects occupy a sticky viewport behind the page. The hero artwork remains opaque for a full screen, then fades through an additional 240–380px handoff (160–240px on mobile) into that same background. The copy stays centered in the first screen, with its controls outside the artwork mask. The effects do not intercept pointer events or cover links. Only the selected effect is imported; it is unmounted when the page background is offscreen or the tab is hidden. Mobile uses fewer shards, fibers, or particles and a lower render resolution.

## Sources and dependencies

Components under `src/components/backgrounds/react-bits/` are the official React Bits TypeScript/CSS sources, retrieved from DavidHDev/react-bits. Local adaptations make the pause control freeze Aero Shards' ambient clock, add an explicit paused frame to Gradient ASCII, and add a small damped scroll response to Particles. Their license is retained in `docs/licenses/react-bits.txt`. Source pages are linked from the switcher. Source revision is recorded below.

Astro's React 4 integration provides client rendering alongside the existing Astro components. Pattern Waves uses `ogl`. Aero Shards uses `vgpu`, pinned to **0.3.1**, matching upstream's `^0.3.1` dependency. The newer 0.6 release requires prepared shader objects and cannot consume Aero Shards' raw WGSL strings.

Aero Shards requires WebGPU, generally available in current desktop Chrome/Edge on supported hardware. Its error callback displays a message if initialization fails. The other five effects use WebGL 2. Browsers without the necessary graphics support retain the readable dark page surface.

Tuning lives in `BackgroundPreview.tsx`; layering, brightness, and the comparison control live in `background-preview.css`. No production deployment is part of this change.

Ghost Fibers renders at a pixel ratio of 1 and caps rendering at 30fps to limit full-screen GPU work while keeping visible motion continuous. While the opaque part of the hero covers the background, the background renders a static frame and pauses; it resumes as soon as the handoff enters the viewport. Laser Flow does not pause the background. Coverage is recalculated on resize, and scrolling only checks cached geometry. The existing manual pause, reduced-motion, offscreen, and hidden-tab handling remains in place.

## Readability and interaction

The first five effects use low opacity plus a stronger, even dark layer across the reading column. Pattern Waves, Gradient ASCII, and Pixel Blast are the quietest. Ghost Fibers uses 0.5 opacity over open space on devices with a mouse, then gently dims to 0.24 while the pointer is over text or reading panels, or a content control has visible keyboard focus. Narrow screens use 0.4 and 0.22 respectively. Touch devices retain the reading level; reduced motion removes the opacity transition. This uses CSS hover/focus selectors without pointer-move handlers or React updates. The reading shade is retained. Bright click pulses and dense cursor reveals are disabled, and ambient motion is slower.

Particles has no mouse, click, continuous rotation, or ambient positional motion. Its `scrollDisturbance` option gives the cloud a tiny bounded displacement from scroll velocity, with a damped spring returning it to the same resting positions. Pause and reduced-motion preferences disable that response. The scroll listener is passive and removed when the effect unmounts.

Source revision: `4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4`.
