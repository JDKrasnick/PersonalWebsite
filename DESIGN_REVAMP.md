# Portfolio Redesign — Design Direction (plain words)

> This is a **design brief in words**, not an implementation plan. It describes the feel,
> the concepts, and the section-by-section treatment. Pick a direction (or mix), and the
> next step is to translate the chosen path into a concrete build plan.

---

## 1. The problem with the current site

The current site is clean but reads as a *template*: dark background, periwinkle accent,
"Where I've Worked", reveal-on-scroll, tag pills. It's competent and forgettable. The goal
is to keep the restraint and typographic discipline you already have, but give it **one
memorable idea** that clearly signals *this person is a strong AI/ML engineer and builder*.

**Design principle for the whole revamp:** *one strong interactive concept, executed with
taste, and everything else quiet around it.* Not five gimmicks. One signature, plus clean
type and generous space.

---

## 2. Positioning: broad, not niche

You don't want the design pinned to one specialization (RL, queueing networks, etc.) — those
interests aren't fully settled yet. So the theme should read as the **broad, current
landscape you work across**:

- **Classical ML** — the fundamentals: learning from data, gradient descent, models that
  improve with training.
- **Modern AI / transformers / LLMs** — attention, tokens, embeddings, agents, evals. The
  language everyone in AI speaks right now.
- **Software engineering craft** — clean systems, real products shipped end-to-end, not just
  notebooks.

The visual metaphor should feel like **intelligence and learning in general** — recognizable
to any AI/ML person on sight — rather than any single sub-field. Think "someone fluent in the
whole modern AI stack and a real engineer," not "the queueing-network person."

---

## 3. Aesthetic foundation (shared across all directions)

Keep the bones you have, refine the taste level:

- **Mood:** calm, precise, "instrument panel meets deep space." Confident, not loud.
  Think research lab / trading terminal / observatory — not neon cyberpunk.
- **Color:** stay dark, but evolve the palette so it doesn't read as default-template.
  - Deepen the base to a near-black with a *slight* cool cast (charcoal/ink, not pure #000).
  - Keep a single accent, but consider shifting from the generic periwinkle to something
    with more identity — options: **signal green/teal** (terminal/scientific), **warm amber**
    (against cool dark = distinctive), or a **periwinkle→cyan gradient** used only on the
    interactive element. One accent, used sparingly; everything else grayscale.
  - Introduce a **second, dimmer "data" color** used only inside the interactive piece
    (e.g. particles/connections), so the hero art feels richer than the UI chrome.
- **Type:** you already have Inter + JetBrains Mono, which is good and current. Level it up:
  - Use a **larger, more editorial display size** for the hero name — big, tight tracking,
    confident. Let it breathe.
  - Keep JetBrains Mono for labels/metadata, treated as *data readout* text (metrics,
    coordinates, timestamps) to reinforce the technical, engineered feel.
  - Optional: a slightly more characterful geometric/neo-grotesque for headings while keeping
    Inter for body — only if you want more editorial personality.
- **Layout:** more whitespace, fewer boxes. Move away from "everything is a card with a
  border." Use rules, baseline grids, and generous margins. Let the interactive piece be the
  visual anchor and let text sit quietly beside it.
- **Motion:** slow, eased, purposeful. Nothing bounces. Things *settle*. Respect
  `prefers-reduced-motion` with a genuine static fallback (not just "animation off").

---

## 4. The three directions

Each is a different answer to "what is the one signature interactive idea?" All three read as
**general AI/ML**, not a niche. You can pick one or combine (e.g. A's hero with C's texture).
My recommendation is at the end.

### Direction A — "Attention" (transformers / modern AI) ⟵ most current, most recognizable

**The idea:** The emblem of modern AI is **self-attention** — tokens looking at each other.
The hero is a soft row/field of **tokens** (dots or short mono words) with faint **attention
lines** connecting them; the connections shift and re-weight over time, brighter where
"attention" is strongest. It's the single most legible "this is modern AI/transformers"
image you can show, without naming any one application.

- **Hero:** tokens arranged loosely; attention edges glow and fade as an unseen "head"
  attends across them. Mouse proximity strengthens nearby connections. A mono HUD can show a
  fake-but-plausible readout (layer, head, a softmax-looking value).
- **Interaction:** hovering a token lights up what it "attends to" — a small, satisfying
  demonstration of the mechanism everyone in AI knows.
- **Navigation:** key tokens double as section anchors (About, Work, Projects, Contact).
- **Feel:** unmistakably current, intelligent, clean. Reads as *transformers/LLMs* instantly.
- **Risk:** must stay restrained or it becomes a tangle — few tokens, muted lines, slow motion.

### Direction B — "The Learning Machine" (classical ML / gradient descent)

**The idea:** Classical ML in one image: **a system that learns.** A point (or small network)
**descends a loss landscape** — a gentle 3D surface with hills and valleys — settling toward a
minimum, then perturbing and re-optimizing. Alternatively, a small neural net whose weights
visibly *train* (connections thicken/thin as it "fits"). It's learning-from-data made visible.

- **Hero:** a soft, topographic loss surface; a marker rolls downhill in eased steps, with a
  faint trail. A mono HUD shows a fake metric improving ("loss ↓", "epoch", "accuracy 0.95").
- **Interaction:** clicking/dragging drops the marker somewhere new and it re-descends — you
  *feel* optimization happening. Or hovering nudges the landscape.
- **Feel:** foundational, thoughtful, "I understand how models actually learn." Less trendy
  than A, more timeless.
- **Risk:** neural-net/gradient visuals are common; the craft (palette, easing, restraint) is
  what separates it from a stock illustration.

### Direction C — "Latent Constellation" (embeddings + SWE / terminal)

**The idea:** The most **engineer-forward**, minimal option. Your work lives as points in a
drifting **embedding space** (the shared substrate of all modern ML), framed inside a clean
**instrument/terminal** aesthetic — gridlines, mono labels, live-looking values. Nods to both
the ML side (embeddings/latent space) and the SWE side (terminal craft, precision).

- **Hero:** a slowly drifting constellation of soft points; a few brighter ones are your
  featured work. Mouse parallax. Hovering a cluster label pulls related points together, like
  a query resolving its nearest neighbors.
- **Interaction:** lightweight, fast, flawless on mobile; leans on typographic and motion
  craft rather than heavy 3D.
- **Feel:** restrained, technical, premium. Says "serious engineer with taste."
- **Risk:** lower "wow" than A/B; depends entirely on execution polish to feel high-end.

---

## 5. Section-by-section treatment (applies to the chosen direction)

Same content you have now, re-staged:

- **Hero:** name big and editorial, one line of positioning (broad — e.g. "AI/ML engineer &
  builder — from classical ML to modern LLMs"), the interactive piece as the anchor, a quiet
  "open to opportunities" status, and social/resume links. Replace the generic subtitle
  "Software Engineer" with something that signals the AI/ML range.
- **About:** short, first-person, confident. Keep the running/gym/video-essay humanizing line
  — it's good. Replace the 4 detail cards with a cleaner metadata strip (mono key→value rows)
  so it reads like a spec sheet.
- **Experience:** keep the timeline logic, but drop the heavy borders. Let each role be a
  clean typographic block with the interactive motif appearing subtly (e.g. a small token/
  node lighting up per role). Lead with the *outcome numbers* (95% accuracy, 14+ providers) —
  they're your strongest proof.
- **Projects:** move away from uniform bordered cards. Try an **editorial index** (numbered
  list that expands) or a **featured-3-then-list** split. Each project gets one strong verb
  and its result, not just a tag dump. Keep tags but demote them visually.
- **Skills:** render skills in the **same visual language** as the hero (tokens/points/nodes),
  grouped by category, so the whole site feels like one system. Or keep it minimal as a quiet
  mono list.
- **Contact:** simple, warm, direct. One line, email, socials. Optionally the interactive
  piece "resolves"/settles here (attention calms, the marker reaches the minimum) as a
  closing beat.
- **Navbar:** minimal. Section names as mono labels; optionally the active section is the
  highlighted token/point in the metaphor.

---

## 6. Implementation paths (for the eventual build plan)

Three ways to build whichever direction you pick — lightest to heaviest:

1. **Pure Canvas / lightweight WebGL (no 3D framework).**
   - Best for **Direction A** (attention, 2D) and **Direction C** (constellation).
   - Tiny bundle, fast, easy to make accessible, plays nicely with Astro's zero-JS default
     (island only where needed). Most control, most hand-coding.

2. **Three.js + React Three Fiber (or vanilla Three).**
   - Best for **Direction B** (3D loss landscape) and a true-3D version of A or C.
   - Rich, "wow" 3D, big ecosystem (drei, postprocessing bloom). Heavier bundle; needs care
     for performance/mobile; wrap in an Astro island so the rest of the site stays static.

3. **Spline (no-code 3D, embed or export).**
   - Fastest to a polished 3D look without writing shaders; design the scene at
     app.spline.design and embed. **Trade-off:** heavier runtime, less bespoke, and stock
     templates are generic — build a custom scene matching A/B/C rather than dropping in a
     template, or it'll look like every other Spline portfolio. Reasonable middle path:
     Spline for the hero centerpiece only, hand-coded everything else. **Use the element
     checklist in §6.5 to decide, per asset, whether Spline already has it or it's custom.**

**Framework note:** you're on Astro + GSAP + Vercel. Keep that. Astro islands are ideal —
ship the interactive piece as one hydrated island, keep the rest static HTML so Lighthouse
stays green. GSAP (+ ScrollTrigger) handles scroll choreography; the WebGL/Three/Spline piece
handles the hero art.

---

## 6.5 Proposed 3D / interactive elements (asset shopping list)

Rather than pointing you at Spline templates up front, here are the **specific elements** each
direction needs, described in plain words. Use this later as a checklist: for each item, check
Spline (or Sketchfab / drei examples / a shader) to see if it already exists, otherwise build
it custom. Each is written so it's *searchable* and *buildable*.

**Shared / reusable across directions**

- **Ambient particle field** — a few hundred soft, slightly-blurred points drifting slowly in
  3D with subtle depth-of-field; near-black background. Used as the base layer behind any hero.
- **Cursor-parallax rig** — the whole scene shifts a few degrees toward the mouse, easing back
  when idle. Cheap, huge payoff for "alive" feel.
- **Mono HUD overlay** — small monospace readouts (metric name + ticking value) pinned to a
  corner, styled like an instrument. This is HTML/CSS on top of the canvas, not 3D.
- **Scroll-scrub hook** — the hero animation state (attention weights / descent progress /
  camera position) is driven by scroll for the first viewport, then idle-loops.

**Direction A — Attention**

- **Token nodes** — 12–24 small glowing spheres or short mono word-chips arranged in a loose
  row/arc. Soft emissive glow, subtle idle bob.
- **Attention edges** — thin curved lines between tokens whose *opacity/thickness* animates to
  represent shifting attention weights; brighter = stronger. The signature element.
- **Focus pulse** — on hover, the selected token brightens and its outgoing edges surge, others
  dim (a visible softmax-like "this attends to that").
- *(Spline check: look for "connected nodes / network graph / plexus" scenes; the edges will
  likely need custom weighting logic even if the node scene exists.)*

**Direction B — The Learning Machine**

- **Loss-surface terrain** — a soft, low-poly or smooth 3D topographic surface with gentle
  hills/valleys; muted gradient shading, faint contour lines. The hero centerpiece.
- **Descent marker** — a glowing sphere that eases downhill step-by-step toward a minimum,
  leaving a fading trail; re-drops and re-descends on interaction.
- **Perturbation interaction** — click/drag re-seeds the marker's position; optional gentle
  wobble of the terrain on hover.
- *(Spline check: search "3D terrain / landscape / topography / wave surface"; the animated
  descent + trail is likely custom on top of a static surface.)*

**Direction C — Latent Constellation**

- **Point-cloud constellation** — a few hundred soft points in a slowly rotating volume; a
  handful are brighter "featured" points with tiny mono labels.
- **Cluster-pull interaction** — hovering a category label smoothly migrates the relevant
  points into a tight group and draws faint connecting lines (a query resolving neighbors).
- **Instrument frame** — thin gridlines, tick marks, and mono axis labels framing the cloud
  like a scientific plot. Mostly CSS/SVG over the canvas.
- *(Spline check: "particle cloud / points / galaxy" scenes are common and reusable here; the
  cluster-pull is the custom part.)*

**Reduced-motion / fallback assets (all directions)**

- A single **static hero composition** — a beautifully lit still frame of the same scene
  (rendered once, exported as an image or a non-animated canvas draw) served when
  `prefers-reduced-motion` is on or on low-power devices.

---

## 7. My recommendation

**Direction A ("Attention"), built lightweight (Canvas/2D-WebGL) for the hero, with Direction
C's terminal/constellation restraint applied to the rest of the site.**

Why: given you want broad rather than niche, attention/transformers is the most instantly
legible "modern AI" signal there is — every AI/ML person recognizes it, and it doesn't commit
you to any one sub-field. Done with restraint it's elegant, not gimmicky, and Canvas keeps it
fast and mobile-safe. Layering C's instrument aesthetic over the rest ties the whole site into
"one system" and keeps the SWE-craft signal strong.

If you'd rather feel timeless over trendy: **Direction B (loss landscape)** says "I actually
understand how models learn" and ages better than transformer-specific imagery.

Fallback for all: ships with a genuine `prefers-reduced-motion` static composition so it's
premium even with motion off.

---

## 8. Open questions for you (before the build plan)

1. **Which direction** — A (attention/transformers, recommended), B (learning/loss landscape),
   C (latent constellation + terminal), or a hybrid?
2. **How bold on color** — stay periwinkle-safe, or move to a more distinctive accent
   (signal-green / amber / gradient)?
3. **Effort/risk appetite** — go full 3D (Three/Spline, more wow, more build) or lightweight
   Canvas (faster, safer, still tasteful)?
4. **Scope** — full re-stage of every section, or new hero + light polish on the rest first?
5. **Positioning line** — how do you want to describe yourself in one broad sentence in the
   hero? (Current "Software Engineer" undersells the AI/ML range.)
