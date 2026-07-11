# Implementation Plan — Portfolio Redesign

Covers **both** shortlisted directions:

- **Direction A — Attention** (`full-page-attention.html`)
- **Direction B — The Learning Machine / gradient descent** (`full-page-learning.html`)

~80% of the work is **shared** (design tokens, section re-staging, scroll rail, motion,
accessibility). The two directions only diverge in the **hero canvas**, one accent color, and
a few motif labels. This plan is structured so you build the shared foundation once, then drop
in whichever hero you choose (or build both behind a flag and decide live).

Reference mockups live in `design-mockups/`. Final target is the real Astro app in `src/`.

---

## 0. Guiding constraints (from the existing stack)

- **Astro 5, `output: 'static'`, Vercel adapter, no UI framework today.** Default path keeps it
  that way — the hero is a **vanilla `<script>` inside the Hero `.astro` component**. Whether to
  add a 3D framework is a deliberate, isolated choice covered in **§0.5**; it changes only the
  hero module internals, not the rest of this plan. (GSAP already present for choreography.)
- **Pure CSS + CSS variables** in `src/styles/global.css`. All theming goes through tokens.
- **Performance budget:** hero canvas JS ≤ ~6 KB min, no libraries. Lighthouse Performance
  stays ≥ 95. Canvas must **pause when offscreen and when tab hidden**.
- **Accessibility:** real `prefers-reduced-motion` fallback (static frame, no rAF loop). Canvas
  is decorative → `aria-hidden="true"`. All content readable with zero JS.

---

## 0.5 Framework choice — vanilla vs. a 3D framework

You've said complexity/framework is fine if the animation needs it. Honest read: **the two
shortlisted concepts (attention field, gradient descent) are 2D canvas scenes and do *not*
benefit from a framework.** Adding React/R3F here means a hydration boundary, ~40–150 KB of
JS, and more moving parts — for a scene a 6 KB vanilla loop already renders perfectly. So the
question isn't "framework yes/no," it's **"do you want to upgrade the concept to true 3D?"**

Three tiers, pick per how much depth you want:

| Tier | Stack | What it buys | Cost |
|---|---|---|---|
| **T1 — Vanilla 2D** *(plan default)* | Astro `<script>` + Canvas2D | The exact mockups. Fast, tiny, zero deps, trivially accessible. | none |
| **T2 — Vanilla 3D** | Astro `<script>` + Three.js (no React) | Real depth: 3D loss *surface* with lighting/bloom (B), or tokens in rotating 3D space (A). Add Three as one `<script>` island; **no React needed.** | +~150 KB gz, more code |
| **T3 — React 3D** | `@astrojs/react` + React Three Fiber + drei | Declarative scene graph, drei/postprocessing helpers, easiest to build *complex/interactive* 3D. Worth it only if the scene grows beyond a few objects. | +React runtime + hydration |

**What each hero actually gains from 3D:**
- **B (gradient descent) benefits most from 3D** — a lit, tilting 3D loss *surface* with the
  marker skiing down it is genuinely more striking than the 2D contour heatmap. This is the
  one case I'd consider T2/T3. Recommend **T2 (Three.js, no React)** — R3F's declarative model
  adds little for a single animated mesh + marker, and Astro-without-React stays lighter.
- **A (attention) gains little from 3D** — attention reads best as a clean 2D diagram; a 3D
  token cloud tends to look like generic "plexus" and muddies the meaning. Keep **T1**.

**Recommendation (decided):** Direction A stays **T1 vanilla**. Direction B ships **T2
(Three.js as a vanilla island, no React)** for its hero — the 3D lit loss surface is the one
place 3D materially beats 2D (mockup: `full-page-learning-3d.html`). Crucially, the 3D tier is
**capability-gated and dynamically imported**, with a 2D-canvas tier + static image as
fallbacks, so mobile / reduced-motion / no-WebGL users never pay the ~150 KB. The `initHero()`
contract in §2 is identical across tiers, so lifecycle, sizing, and reduced-motion logic are
unchanged — only the module internals swap Canvas2D ↔ Three/WebGL. Full tiering is in §2B.
Reach for **T3 (React + R3F)** only if the 3D scene later grows well beyond a single surface +
marker; it isn't needed for what's designed. Three is added as a local npm dep (§4) — no
`astro.config.mjs` integration needed since it's a plain module, not a framework.

---

## 1. Shared foundation (do this regardless of direction)

### 1.1 Design tokens — `src/styles/global.css`
Update `:root`:

```
--bg-primary:   #07070a;   /* was #09090b — slightly deeper, cooler */
--bg-secondary: #0c0c10;
--accent:       #6c8aff;   /* keep periwinkle as the UI accent */
--accent-data:  <direction color>;   /* A: #38e8d0 teal · B: #ffb454 amber */
--border-color: rgba(255,255,255,0.07);
--border-hover: rgba(255,255,255,0.12);
--font-mono:    'JetBrains Mono', monospace;  /* already present */
```

Add shared utility classes (currently the mockups inline these):
- `.section-label` → instrument-readout style (mono, `01 /` index prefix, 28px lead rule).
- `.metric-chip` → mono chip using `--accent-data` (bg 6%, border 25%). Used in Experience.
- `.rv` reveal (or reuse existing `.reveal`/`.visible` — see 1.6).

Keep existing font `@import` (Inter + JetBrains Mono).

### 1.2 Layout / meta — `src/layouts/Layout.astro`
- Update default `title` → `"JD Krasnick — AI/ML Engineer"` and `description` to the broad
  positioning line. Add OG/Twitter meta + a static social preview image (nice-to-have).

### 1.3 Section re-staging (identical for both directions)
These `.astro` components get restyled to match the mockups. **Content is already in your
components** — mostly CSS + small markup changes.

| Component | Change |
|---|---|
| `Navbar.astro` | Mono lowercase links; brand `JD.Krasnick` with `.` in `--accent-data`; active link uses accent. Keep the existing scroll-spy in `index.astro`. |
| `Hero.astro` | Rebuilt — see §2 (the only big divergence). New positioning line, keep badge/socials/CTAs. |
| `About.astro` | Replace 4 detail cards with the **spec sheet** (mono key→value rows, single bordered block). Reword focus line to broad ("Classical ML · Modern AI / LLMs · Full-stack"). |
| `Experience.astro` | Drop heavy borders → clean typographic rows. Add a **metric chip** per role (`accuracy ↑ 95%`, `14+ sources`, …) in the left column under the period. **Bold the outcome numbers** inside highlights. |
| `Projects.astro` | Featured-3 grid + 2-up list (already the data shape). Add hover lift. (Direction C had coordinate readouts — not needed for A/B.) |
| `Skills.astro` | Keep 5-column mono grid; category headers use accent. Minor spacing polish. |
| `Contact.astro` | Add the closing **readout line** above the heading (A: `attention settled · softmax converged` · B: `converged · loss 0.041 · steady state`). Rework copy + big heading. |

### 1.4 Scroll rail (shared component, direction-flavored labels)
New tiny component `src/components/ScrollRail.astro` (fixed left rail + marker), rendered once
in `index.astro`. Marker position = scroll progress. Caps differ by direction:
- **A:** `layer 01` → `layer 12`
- **B:** `loss 1.00` → `min`

Logic: reuse the mockup's scroll handler (passive listener, `marker.style.top = p*100%`).
Fold into the existing scroll listener in `index.astro` to avoid a second handler.

### 1.5 Section dividers (shared mechanism, direction-flavored SVG)
Small inline-SVG `Divider.astro` with a `variant` prop:
- **A:** crossing token-arc paths (teal/periwinkle).
- **B:** topographic contour waves (periwinkle + amber).

Place between About/Experience/Projects/Contact as in the mockups.

### 1.6 Reveal + motion
- Existing `.reveal`/`.visible` IntersectionObserver in `index.astro` already does what the
  mockup's `.rv` does — **reuse it**, just add the classes to new elements. No new observer.
- Keep GSAP hero entrance stagger.

### 1.7 Reduced motion + perf plumbing (shared, see §3)
Wire the canvas lifecycle helper (§3) — same for both heroes.

---

## 2. The hero (the divergence)

Structure is identical; only the draw loop + a color + labels change. Build the hero as:

```
src/components/Hero.astro         # markup: <canvas aria-hidden>, HUD, name, CTAs, socials
src/scripts/hero-attention.ts     # Direction A draw module      (pick one)
src/scripts/hero-gradient.ts      # Direction B draw module       (pick one)
```

`Hero.astro`'s client `<script>` imports the chosen module and calls
`initHero(canvas, { reducedMotion })`. Each module exports the same interface:

```ts
export function initHero(canvas: HTMLCanvasElement, opts): HeroHandle
// HeroHandle = { start(): void; stop(): void; drawStaticFrame(): void; destroy(): void }
```

This uniform contract is what lets you swap A/B (or A/B-behind-a-flag) with a one-line change.

### 2A. Direction A — Attention  (`hero-gradient` NOT used)
- Port `full-page-attention.html`'s script: token chips laid out in the right ~60%, 3 nearest-
  neighbor attention arcs each, a `focus` token cycling every ~110 frames and surging its edges.
- Accent-data = teal `#38e8d0`. HUD = `layer / head / softmax`.
- `drawStaticFrame()` = one render at a fixed focus token (for reduced-motion).
- Tunables to expose: token count, focus dwell, arc opacity, layout jitter.
- **Polish vs mockup:** dim the whole field ~15% more behind text; slow arc pulse; ensure
  tokens avoid the left text column at all breakpoints (compute layout from container width).

### 2B. Direction B — The Learning Machine  (`hero-attention` NOT used)

Direction B ships in **two rendering tiers behind one `initHero()` contract**, chosen at
runtime by capability + preference. This is the recommended B build (see mockups
`full-page-learning-3d.html` = 3D, `full-page-learning.html` = 2D).

**Tier chooser (in `hero-gradient.ts`):**
```
const use3D = supportsWebGL() && !isReducedMotion && !isLowPowerMobile();
```
- `supportsWebGL()` — probe a throwaway `webgl2`/`webgl` context.
- `isLowPowerMobile()` — `matchMedia('(max-width:720px)')` OR `navigator.hardwareConcurrency ≤ 4`
  OR `matchMedia('(pointer:coarse)')`. Tune to taste.

**Tier 1 — 3D loss surface (desktop default, the "wow"):**
- Three.js r160 as a **plain ES module (no React)**. Import dynamically inside `initHero` so the
  ~150 KB (gz) only loads when actually used — never on mobile/reduced-motion/no-WebGL.
- Port `full-page-learning-3d.html`: 110×110 vertex surface (height = `loss(nx,ny)*scale`),
  `computeVertexNormals`, `MeshStandardMaterial` vertexColors (valleys amber→periwinkle, peaks
  dark), faint wireframe overlay, `Fog`, directional key light + **marker point light** that
  lights the terrain as it descends, momentum gradient-descent marker + trail, slow framed orbit.
- Bundle Three **locally** (npm dep), not from CDN — the mockup's unpkg import is mockup-only.
- Add WebGL **context-loss** handling: on `webglcontextlost`, `preventDefault()` + stop loop;
  on `webglcontextrestored`, rebuild + restart. Dispose geometry/material/renderer in `destroy()`.

**Tier 2 — 2D canvas (mobile / fallback / reduced-motion frame source):**
- Port `full-page-learning.html`: precomputed loss field (`ImageData`, 3px blocks, rebuilt on
  resize only), momentum-descent marker, amber trail, auto re-seed.
- This is also the `drawStaticFrame()` source for reduced motion: render one frame with the
  marker settled at the global min + a short trail, then stop.

**Static image fallback (belt-and-suspenders):** pre-render one nice 3D frame to
`public/hero-loss.webp`; show it as the canvas's CSS background so *something* good is visible
before/without JS and on the weakest devices. The live canvas draws over it once ready.

- Accent-data = amber `#ffb454`. HUD = `epoch / loss / accuracy` (shared markup, both tiers).
- Tunables (both tiers): learning rate, momentum, trail length, well positions, re-seed
  threshold; (3D) surface scale, orbit radius/height, light intensities.
- **Polish vs mockup:** darken the surface valleys ~10–15% behind the name; clamp marker spawn
  to the right half so it never sits under the H1; cap DPR at 2; cap segment count on mid GPUs.

> **Cost note:** Tier 1 is the only place in the whole plan that adds a dependency and real GPU
> cost — and it's fully gated (dynamic import, capability-checked, never loads on mobile/reduced
> motion). Tier 2 + static image guarantee a fast, correct experience everywhere else.

---

## 3. Canvas lifecycle, performance & accessibility (shared)

Put this in the Hero `<script>` around whichever module you load:

1. **DPR-aware sizing** (already in mockups): cap `devicePixelRatio` at 2; resize on
   `ResizeObserver` of the canvas (not `window`) so it reacts to layout, debounced.
2. **Pause offscreen:** `IntersectionObserver` on the hero → `handle.stop()` when it leaves,
   `handle.start()` when it returns.
3. **Pause hidden tab:** `document.visibilitychange` → stop/start.
4. **Reduced motion:**
   ```js
   const mq = matchMedia('(prefers-reduced-motion: reduce)');
   if (mq.matches) handle.drawStaticFrame(); else handle.start();
   mq.addEventListener('change', …); // respond live
   ```
5. **No-JS / hydration:** canvas is empty + `aria-hidden`; the hero text/CTA render server-side
   and are fully usable with zero JS. Optionally a CSS gradient background as the canvas's
   ultimate fallback.
6. **Mobile:** below ~720px, reduce particle/token count ~40% (pass via opts) or render the
   static frame only — the hero art is decorative, legibility wins.

---

## 4. File-by-file change list

**New**
- `src/components/ScrollRail.astro`
- `src/components/Divider.astro`
- `src/scripts/hero-attention.ts` and/or `src/scripts/hero-gradient.ts`
  - if Direction B: `hero-gradient.ts` internally dynamic-imports a `hero-gradient-3d.ts`
    (Three.js Tier 1) and contains the Tier 2 canvas fallback + tier chooser.
- `src/scripts/hero-lifecycle.ts` (the §3 wrapper, shared)
- (Direction B only) `public/hero-loss.webp` — pre-rendered static fallback frame
- (optional) `public/og-image.png`

**Dependencies** (Direction B, T2 only)
- `npm i three` (+ `npm i -D @types/three`). No `astro.config.mjs` change — Three is imported
  as a plain module inside the hero script, not registered as an Astro integration.

**Edited**
- `src/styles/global.css` — tokens, `.section-label`, `.metric-chip`, spec-sheet, rail, divider,
  card hover, contact readout.
- `src/layouts/Layout.astro` — title/description/OG.
- `src/pages/index.astro` — render `<ScrollRail/>` + `<Divider/>`s; fold rail progress into the
  existing scroll handler; keep reveal + GSAP.
- `src/components/Hero.astro` — full rebuild (canvas + HUD + new copy).
- `src/components/{Navbar,About,Experience,Projects,Skills,Contact}.astro` — restyle per §1.3.

**Untouched:** `astro.config.mjs`, `Layout` structure. (`package.json` gains `three` only if
Direction B.)

---

## 5. Build order (suggested)

1. **Tokens + shared CSS utilities** (§1.1) — nothing visual yet, but unblocks everything.
2. **Restage the static sections** (About → Experience → Projects → Skills → Contact) (§1.3).
   Site already looks 70% better with zero canvas work; good checkpoint to deploy a preview.
3. **Scroll rail + dividers** (§1.4–1.5).
4. **Hero shell** (markup, HUD, copy) with a CSS-gradient placeholder background.
5. **Hero lifecycle wrapper** (§3) driving a stub module.
6. **Chosen hero module** (§2A or §2B). If undecided: build both, gate with a constant
   `const HERO = 'attention' | 'gradient'` in `Hero.astro`, compare on a Vercel preview, delete
   the loser.
7. **Reduced-motion static frame + mobile downscale.**
8. **Perf/a11y pass** (§6).

Each step is independently deployable (Vercel preview per push).

---

## 6. Testing & acceptance

- [ ] Lighthouse (mobile, throttled): Performance ≥ 95, Accessibility 100.
- [ ] `prefers-reduced-motion: reduce` → no rAF loop runs; static frame shows.
- [ ] Tab backgrounded / hero scrolled away → rAF paused (verify in Performance panel).
- [ ] Zero-JS render → all text, links, resume, email usable; layout intact.
- [ ] Hero text never overlaps busy canvas at 360 / 768 / 1024 / 1440 widths.
- [ ] Keyboard nav + focus states on all links/buttons; contrast ≥ 4.5:1 for body text.
- [ ] No layout shift from canvas (reserve hero height via `min-height:100vh`).
- [ ] Cross-browser: Safari (DPR + `backdrop-filter`), Firefox, Chrome.
- [ ] **(Direction B / 3D)** Three.js chunk is code-split — confirm it is NOT in the initial
      bundle and only loads when the 3D tier is chosen (check Network on desktop vs mobile).
- [ ] **(Direction B / 3D)** Mobile / reduced-motion / no-WebGL fall back to the 2D canvas or
      static `hero-loss.webp` — verify Three never downloads in those cases.
- [ ] **(Direction B / 3D)** WebGL context-loss → restore works (force via devtools) without a
      blank hero; `destroy()` disposes GPU resources (no leak on repeated init).

---

## 7. Decision aid: A vs B

| | **A — Attention** | **B — Gradient Descent** |
|---|---|---|
| Signal | "Modern AI / transformers" — instantly legible | "I understand how models learn" — foundational |
| Motion feel | Calm, cyclical, hypnotic | Kinetic, narrative (thing visibly improving) |
| Hero legibility | Easier (sparse tokens) | Needs field dimming behind name |
| Perf | Slightly cheaper | Cheap, but watch `buildField` on mobile |
| Trend risk | Transformer imagery may date | Ages better |
| Distinctiveness | High | High |

**Recommendation:** build the shared foundation + hero shell first, then implement **both**
modules behind the `HERO` flag (they share the lifecycle wrapper, so the second is ~1–2 hrs).
Compare live on a preview URL and keep one. If you must pick blind: **A** for the strongest
"modern AI" first impression, **B** if you want the site to feel alive and narrative.

---

## 8. Rough effort estimate

| Phase | Est. |
|---|---|
| Tokens + shared CSS | 1–2 h |
| Section re-staging (5 components) | 3–4 h |
| Scroll rail + dividers | 1 h |
| Hero shell + lifecycle wrapper | 2 h |
| Hero module A (2D port + polish) | 2–3 h |
| Hero module B — Tier 2 (2D port + polish) | 2–3 h |
| Hero module B — Tier 1 (3D Three.js port + tier chooser + context-loss + static frame) | 4–6 h |
| Reduced-motion + mobile + perf/a11y | 2–3 h |
| **Total — Direction A (2D)** | **~11–15 h** |
| **Total — Direction B (2D only)** | **~11–15 h** |
| **Total — Direction B (2D + 3D tiers, recommended)** | **~15–21 h** |
| **+ second hero for live compare** | **+2–3 h** |
