# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Product Purpose
JD Krasnick's personal portfolio and technical blog. Visitors can explore his work and read articles. JD can write, preview, and publish technical posts.

## Operating Context
Astro website. The blog is being developed and used on localhost. Deployment is outside this task's scope.

## Capabilities and Constraints
The blog is independent of the portfolio homepage and reachable from the header on the hero screen. The hero itself matches main, with its original View Projects and Get in Touch actions. Authoring and draft previews are local-only and excluded from public output. Preparing a post writes reviewed Markdown under content/blog; publishing is a Git commit and push. Each post may have an optional picture and alternative text, validated and preserved as image/imageAlt Markdown frontmatter. Picture URLs accept HTTPS or root-relative public asset paths; no upload is provided. Draft pictures stay private until preparation. Public-folder assets must be committed with the Markdown; remote URLs remain externally hosted. Visitors can comment directly on articles anonymously, without an account. Comments require rate limiting and abuse defenses. Local comments persist in files; the hosted Vercel comment API uses server-only Redis REST credentials, which still need configuring before deployment.

Posts support small animations and interactives through fenced demo JSON referencing standalone HTML/CSS/JavaScript under public/blog-demos. Machine editability takes priority: Markdown, JSON configuration, and plain static files require no demo framework or build step. Insert demo keeps configuration directly editable in Write or Markdown; Preview runs the embed. Reader embeds use scripts-only sandboxed iframes without same-origin access; raw article scripts and iframes remain sanitized. Preparation/build reject invalid configuration or missing referenced files. Demo assets are public when deployed and must be committed with the prepared post; private article drafts stay local. The detailed author/agent workflow is docs/blog-authoring.md.

## Brand Commitments
Preserve the site's dark blue identity, as explicitly requested. Follow the user's Dan Luu reference for a simple, readable blog with minimal clutter: date/title links and comfortable page width. Pictures are optional but prominent, leading on the left beside each article's date and title. Do not display post icons in the index or editor; older icon metadata remains supported for compatibility. The editor should feel like the actual article, directly editable, without split panes or a confined writing window. Preserve existing portfolio content and navigation.

Article text must read as primary content rather than subdued photo captions. Preserve Inter and dark blue surfaces while using brighter body ink, semibold neutral titles, and larger reading text: 19px desktop/18px mobile with 1.8 line height. Paragraphs, lists, blockquotes, code, tables, pictures, and demos share the full reading/editor column and its left/right edges. Do not apply a separate paragraph-width cap or mobile code-block breakout.

Search and topic filters open from a magnifying-glass icon into a nonmodal side panel. Engineering and Research remain available alongside existing post tags. Closing the panel preserves filters; clear explicitly resets them. The control identifies active filters and supports keyboard focus and Escape dismissal.

## Evidence on Hand
Existing Astro components, styles, and portfolio content. No real blog articles supplied; any starter article is labeled as an example. The user requested a sample local circuit-board picture: public/blog-images/technical-experiment.jpg, with provenance recorded in public/blog-images/credits.json. It illustrates the example and does not depict the author's own work. The local example and default seed include a standalone gradient-descent demo with a learning-rate slider, Step, Play/Pause, and Reset. It starts paused, pauses offscreen or in a hidden tab, and uses manual steps for reduced motion.
