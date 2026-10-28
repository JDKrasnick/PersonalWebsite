---
name: JD Krasnick
description: The incumbent dark blue portfolio system and its technical blog extension.
colors:
  bg-primary: "#080a15"
  bg-secondary: "#0d1020"
  bg-card: "rgba(116, 138, 255, 0.055)"
  border-color: "rgba(143, 160, 255, 0.13)"
  text-primary: "#f1f2fa"
  text-secondary: "#a5aabd"
  accent: "#7c91ff"
  accent-hover: "#9bacff"
  blog-panel: "#0d1121"
  blog-line: "#262c44"
  blog-body-ink: "#e2e6ee"
  blog-reading-link: "#b8c6ff"
  blog-subtle: "#b4bdcf"
  blog-quiet: "#a0abc2"
  scrollbar-track: "#080a15"
  scrollbar-thumb: "#65729c"
  scrollbar-thumb-hover: "#91a4e8"
  scrollbar-thumb-active: "#b8c6ff"
typography:
  heading:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  blog-display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  blog-headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "clamp(36px, 4vw, 52px)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  blog-subtitle:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  blog-prose:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.8
  blog-prose-mobile:
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.8
  blog-display-mobile:
    fontSize: "26px"
  blog-headline-mobile:
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.18
  blog-subtitle-mobile:
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.6
  blog-archive-title:
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.5
  blog-picture-row-title:
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.4
  blog-archive-title-mobile:
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.45
  blog-prose-h1:
    fontSize: "32px"
    fontWeight: 600
  blog-prose-h2:
    fontSize: "25px"
    fontWeight: 600
  blog-prose-h2-mobile:
    fontSize: "23px"
    fontWeight: 600
  blog-prose-h3:
    fontSize: "20px"
    fontWeight: 600
  blog-prose-h4:
    fontSize: "17px"
    fontWeight: 600
  blog-code:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "14px"
    lineHeight: 1.8
  blog-code-mobile:
    fontSize: "13px"
  blog-inline-code:
    fontSize: "0.82em"
  blog-table:
    fontSize: "16px"
  blog-table-mobile:
    fontSize: "15px"
  blog-comment-body:
    fontSize: "16px"
    lineHeight: 1.8
  demo-title:
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  demo-control:
    fontSize: "14px"
  blog-markdown-source:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "16px"
    lineHeight: 1.8
  blog-utility-micro:
    fontSize: "10px"
  blog-badge:
    fontSize: "11px"
  blog-label:
    fontSize: "12px"
  blog-control:
    fontSize: "13px"
  blog-date:
    fontSize: "14px"
  blog-date-mobile:
    fontSize: "13px"
  mono:
    fontFamily: "JetBrains Mono, monospace"
rounded:
  portfolio-control: "8px"
  blog-control: "7px"
  blog-code: "10px"
  blog-workspace: "12px"
spacing:
  blog-gap-sm: "8px"
  blog-gap-md: "24px"
  blog-gutter-desktop: "48px"
  blog-gutter-mobile: "24px"
components:
  blog-button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#090d23"
    rounded: "{rounded.blog-control}"
    padding: "9px 16px"
  blog-button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "#090d23"
  blog-button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.blog-control}"
    padding: "9px 16px"
---

# Design System: JD Krasnick

## Overview

**Creative North Star: "Midnight systems"**

This records the incumbent portfolio identity named in the global stylesheet: blue-black surfaces, periwinkle accents, restrained borders, and clear technical typography. The user explicitly confirmed preserving the dark blue identity. This is a scan of implemented work, with no new visual world or approved system replacement.

The blog extends that identity with a wide, compact article index and a full-size editable article. The user's Dan Luu reference guides the blog toward plain linked writing with minimal clutter. Compact author controls sit above the shared reading and editing document layout. Optional interactive figures sit within that reading flow; their plain-text configuration stays editable by people and agents. This is a surface-specific refinement; the homepage retains its incumbent visual system.

**Key Characteristics:**
- Blue-black surfaces with restrained periwinkle emphasis.
- Inter reading text and JetBrains Mono for code and technical identity.
- Fine dividers, tonal panels, and gently rounded controls.

## Colors

### Primary

Periwinkle (`accent`) identifies links, active controls, focus, and the blog's primary action; its lighter companion (`accent-hover`) marks hover.

### Neutral

Midnight (`bg-primary`) is the shared base. The incumbent secondary and translucent card surfaces support subtle layering. The blog uses its own opaque panel and divider tokens without changing the portfolio tokens. Near-white ink carries titles; brighter body ink carries paragraphs, descriptions, code, and comments. Blog-local subtle and quiet text carry supporting metadata. Reading links use a lighter periwinkle, while archive titles remain neutral near-white until hover. The portfolio's existing secondary text token remains unchanged.

**The Shared Identity Rule.** Extend the existing dark blue palette rather than introducing a replacement identity for a new surface.

## Typography

Inter is the shared heading and body family, including the visual article editor; JetBrains Mono carries the brand, code, and optional Markdown source view. Font stacks and reusable roles are normative in the frontmatter.

Portfolio headings inherit semibold typography. The blog index retains its compact medium-weight heading. Article titles, archive titles, and prose subheadings use semibold weight (600). The approved Roomy & familiar article header uses a fluid Inter title and a distinct regular-weight subtitle in brighter body ink, with a maximum subtitle measure of 780px. Reader subtitles display the escaped post excerpt; the editor description shares this scale. Archive titles are 22px, rising to 24px in picture rows; their color and weight establish them as article entry points. Article subheadings descend through 32px, 25px, 20px, and 17px. Reader/editor body paragraphs retain brighter body ink at regular weight (400), 19px, with 1.8 line height.

At the blog's mobile breakpoint, the index heading is 26px and archive links are 20px with 1.45 line height. Article titles and subtitles use their mobile frontmatter roles; body prose remains 18px with 1.8 line height. Dates are 14px desktop and 13px mobile. Code is 14px/13px, tables 16px/15px, and comment body text 16px. Markdown source is 16px. Code remains monospaced and preserves whitespace with horizontal overflow where needed.

The smaller frontmatter roles describe ancillary UI, not a second reading scale: 10px is limited to the code-copy utility and mobile footer; 11px to badges and compact mobile actions; 12px to labels, captions, and status text; 13px to controls; and 14px to dates, navigation, and fields. These observed roles are not permission to shrink article text. Legacy avatar-only sizing is excluded because avatars are not part of the current article header.

## Layout

The portfolio container is capped at 1100px with 2rem side padding, reduced to 1.25rem at 768px. Its fixed navigation belongs to the homepage.

The blog header and index are capped at 1600px with 48px desktop gutters. The index has a plain Blog heading without a subtitle, then chronological date/title rows capped at 1160px. Optional pictures lead on the left with date and title to their right; rows without pictures remain compact. A magnifying-glass button opens search and topics in a nonmodal right sidebar (280px). At 850px and below, that panel moves above the results, aligned right with a maximum width of 340px. At 650px gutters are 24px. Reader and visual editor share a 1160px document container, including their gutters.

The editor is a single editable article, with the same title, subtitle, and prose scales as the reader. It grows with the document and uses the page scrollbar. A compact sticky action bar holds the post selector, New post, saving, preview, and GitHub preparation. Post metadata is collapsed under Post settings. Write is a visual editor; Markdown is an optional source view. There is no sidebar or split preview window.

Article headers have no border or bottom padding. The desktop title-to-subtitle margin is 28px, subtitle bottom margin is 26px, and reader header-to-picture margin is 52px; mobile uses 24px, 24px, and 36px. The editor matches the title gap and leaves 52px after the description before the picture on desktop, 36px on mobile. Article headers and local typography previews omit the author byline; the reader keeps its date and example labeling, and the editor keeps its state badge. The site's name remains in navigation and footer.

Paragraphs, lists, blockquotes, code, tables, pictures, and interactive figures share the full document column and its outer alignment. The 1160px desktop container includes two 48px gutters, leaving 1064px for content when the container reaches its maximum width. Mobile uses 24px gutters, leaving 342px at a 390px viewport. There is no separate paragraph-width cap or mobile code-block breakout; text and media follow the same left and right column edges.

## Elevation & Depth

Depth comes primarily from blue tonal layers and fine borders. Blog panels have no box shadows. The incumbent homepage also uses subtle background gradients and a translucent blurred navigation surface after scrolling; these are existing treatments, not requirements for every new panel. Hover changes color or border; the existing portfolio buttons additionally shift upward slightly.

## Shapes

Controls have gentle corners. Article code blocks are contained and scrollable. Archive entries are open rows without card backgrounds or separating rules. Optional index pictures have gently rounded corners (6px); article pictures retain their full document-width presentation.

## Components

### Buttons

The blog's primary action has dark ink on periwinkle; quiet actions use an outlined transparent surface. Both share compact medium-weight labels, a minimum height of 40px, and the frontmatter padding. Editor toolbar actions reduce size to suit the workspace. Hover lightens the primary surface or adds a tonal fill and clearer border to quiet actions. Disabled buttons reduce opacity and show a waiting cursor.

### Native Scrollbars

The blog stylesheet scopes its native scrollbar styling to blog pages and their scrollable content, without replacing scrolling with JavaScript. The homepage retains its main-branch stylesheet and scrollbar. WebKit/Blink vertical and horizontal tracks are 10px thick. The blue-gray thumb has a minimum length of 40px on both axes, an 8px radius, and a 2px track-colored border with padding-box clipping. Hover lightens the thumb; active dragging uses the lighter periwinkle token. Track and corner use the midnight track token.

Browsers without `::-webkit-scrollbar` selector support use standard `scrollbar-width: thin` and thumb/track colors. Forced-colors mode restores automatic standard scrollbar colors and uses CanvasText/Canvas for the WebKit thumb and track. Preserve native scrolling behavior and these system-color overrides.

### Inputs / Fields

Comment inputs use a dark panel, a fine blue-gray stroke, gentle corners, and visible labels. Search has an outlined field. The editor title and description are borderless auto-expanding text areas; rich article content uses the reader's typography. Metadata is collapsed under Post settings. Add picture discloses a cover dropzone and file picker, an optional URL and alternative-text field, with live preview, load-error feedback, and removal. Insert picture opens a body file picker; both Write and Markdown accept file drops and clipboard pictures at the drop position or current selection. Upload progress and errors appear in a status message; successful uploads remind the author to commit the image with the post. Removing a picture retains its file for shared references. Native Tab navigation and visible keyboard focus remain available; formatting comes from the toolbar or keyboard shortcuts.

### Navigation

Portfolio navigation remains fixed with monospaced lowercase desktop links and a separate mobile menu at 768px. Blog is the second link, immediately after About, in both. The hero is restored exactly from main, with View Projects and Get in Touch; the header provides blog access from the hero screen. The closed mobile menu is inert and its toggle exposes expansion state; Escape closes it. Blog navigation is compact, in flow, and marks the active destination with an accent underline. Its Editor action is local-only and absent from production. Preserve the keyboard-visible skip link.

### Chips / Status

Topic filters are quiet until selected, then gain a blue tonal fill and border; selection is expressed by `aria-pressed`. Example badges label sample content. Draft and published badges communicate state, with published using a muted green tonal treatment.

### Search / Topic Panel

The icon-only magnifying-glass toggle has an accessible label, `aria-expanded`, and `aria-controls`. Its open state gains a quiet tonal fill; active filters retain a blue highlight after closing. The inline, nonmodal panel contains search, All topics, Engineering, Research, existing post tags, result count, Clear filters, and a close button. Opening focuses the input; closing by the button or Escape returns focus to the toggle. Closing preserves the current filters. Sidebar topic buttons are full-width, left-aligned controls with a minimum height of 40px.

### Cards / Rows / Reading

Each article appears once with its date and underlined, neutral near-white semibold title link. Post icons are absent from the list and editor, including the icon picker. Rows omit excerpts, topic labels, reading time, arrows, and dividers. An optional picture leads on the left (220×144px desktop; 128×96px mobile), with date and title on the right. The desktop picture/text gap is 28px, reducing to 16px on mobile. Picture-row titles are 24px on desktop; all mobile row titles are 20px. Rows without a picture retain compact date/title formatting with 22px desktop titles. The reader header contains the title, optional excerpt as a subtitle, and date, with example labeling when applicable. An optional document-width picture sits between header and body; author bylines, avatars, tags, and reading time do not appear in the reader header. Reader and editor body prose is 19px on desktop and 18px on mobile, with 1.8 line height and bright body ink. Links, code, tables, and blockquotes remain clearly distinguished.

Pictures are optional author-provided assets, not a default decoration. Cover pictures have transparent backing, so empty space around the contained image shows the page background without a colored frame. The user-requested local example uses a circuit-board photograph at `public/blog-images/technical-experiment.jpg`; its photographer, source, license link, and illustrative-use description are recorded in `public/blog-images/credits.json`. It is not a photograph of the author's own work. Preserve descriptive alternative text in the article; index thumbnails are decorative duplicates of the linked article.

### Interactive Figures

Demo figures remain in the article flow with vertical spacing (32px), a full-width frame, a fine border, gentle corners (8px), and a compact caption containing the title and Open demo link. The configured height defaults to 420px and accepts 240–900px. Invalid configurations leave the code visible with an error message.

The editor displays an editable JSON code block, not an inline running iframe; Preview runs the interactive figure. Insert demo adds that configuration without introducing a second editor surface. The standalone gradient-descent example uses an 18px semibold title and 14px supporting/control text. It starts paused, supports a rate slider, Step, Play/Pause, and Reset, pauses offscreen or in hidden tabs, and uses manual stepping under reduced motion. These are starter-demo behaviors, not a new homepage motion system. See `docs/blog-authoring.md` for authoring and agent-editing details.

### Focus, Selection, and Icons

**The Visible Interaction Rule.** Blog keyboard focus uses a visible accent outline; selection uses dark text on the accent fill. Preserve both when adding controls.

Blog arrows are inline stroked SVGs from `BlogArrow.astro`, with direction expressed by rotation and decorative arrows hidden from assistive technology. Reduced-motion preferences remove blog transitions and smooth scrolling.

## Do's and Don'ts

### Do:

- **Do** reuse the incumbent dark blue palette and font families.
- **Do** keep author controls compact above the shared reading and editing document layout.
- **Do** preserve visible keyboard focus, readable selection, and native Tab navigation.
- **Do** use inline SVG arrows and explicit labels for actionable controls.

### Don't:

- **Don't** treat the blog's article index or single-document editor as a homepage redesign.
- **Don't** replace the confirmed dark blue identity when adding a new surface.
- **Don't** inherit the homepage's older white-on-accent selection treatment into blog controls; the blog deliberately uses dark selection text.
