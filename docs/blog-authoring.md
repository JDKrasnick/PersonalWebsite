# Blog posts and interactive demos

Posts are Markdown files in `content/blog/`. The localhost editor stores private drafts separately; **Prepare for GitHub** writes the reviewed Markdown file. Commit and push the post and any assets together to publish.

The formatting toolbar supports heading levels 2–4, emphasis, strikethrough, inline/fenced code, quotes, bullet/numbered lists, dividers, tables, and undo/redo. In Write, clear formatting removes styling from a selection; Indent/Outdent and Tab/Shift+Tab adjust list nesting. Table controls appear when the cursor is inside a table, including row/column deletion. Find/replace searches literal article text in Write or Markdown, with match case and single/all replacement. These features round-trip through Markdown.

Preview saves first and opens inside the editor window. Click Preview again, choose Edit post, or press Esc to return to the editing position. Cmd/Ctrl+Shift+P toggles Preview; Cmd/Ctrl+S saves; Cmd/Ctrl+Shift+M changes editing mode; Cmd/Ctrl+Shift+F opens find/replace. The expandable Keyboard shortcuts guide lists formatting keys and Markdown input shortcuts. A failed save leaves browser recovery text intact.

**Assistant** opens a ChatGPT subscription-backed writing panel through local Codex. Post text is attached only when selected; Use selection puts a selected passage in the message. Images default to editable, reproducible scripts (usually Python/Pillow saving a PNG), with Copy code on code blocks. Create image script starts a request without sending it or overwriting existing composer text. Run the script locally and drop its image into the post. The external ChatGPT image-generation option remains available. The assistant does not execute scripts, edit, or publish your article automatically, and all assistant routes stay local. See README for connection setup and recovery.

## Add pictures

Open **Add picture** to drop or choose a cover image. Drop or paste a picture into the article to insert it at the cursor; **Insert picture** opens a file picker for the body. Both Write and Markdown modes support pictures. Add a cover description in the picture settings; inline alternative text can be edited in Markdown (`![Description](path)`). Existing image URLs still work.

Uploads accept PNG, JPG, WebP, GIF, and AVIF up to 10 MB and 40 megapixels (including animation frames). The local server validates the actual image data and saves the original file under `public/blog-images/uploads/`, with a safe filename and content hash. Markdown and cover metadata reference the resulting relative URL. Re-uploading the same named image reuses its path; different images never overwrite one another. SVG uploads are excluded; export them as PNG first.

Commit the image files along with the prepared post. Uploaded files are public assets in any deployment that includes them, even if the draft is not prepared. Removing a picture or deleting a draft keeps its file, so other posts using it continue to work. Delete unused files manually when appropriate. The upload endpoint exists only in the localhost development server; there is no public upload API.

## Add an animation or interactive element

1. Create a standalone HTML file in `public/blog-demos/`, containing its HTML, CSS, and JavaScript. No framework or build step is required. Copy `gradient-descent.html` to start.
2. Put a fenced `demo` block anywhere in the post. The editor's **Insert demo** button adds this example:

````markdown
```demo
{
  "src": "/blog-demos/gradient-descent.html",
  "title": "Gradient descent: try the learning rate",
  "height": 420
}
```
````

`src` is a root-relative HTML path inside `/blog-demos/`. `title` is required and labels the embedded content for readers and screen readers. `height` is optional (default 420), and accepts whole numbers from 240 to 900 pixels. No other settings are needed.

**Write** keeps the JSON block editable; **Markdown** shows the source; **Preview** runs the interactive demo in the article. The block survives visual-editor saves, Markdown export, and GitHub publication. Invalid or missing demo files block preparation/build, while drafts may contain unfinished code.

Keep scripts in the HTML demo file. Raw scripts and iframes in article Markdown remain sanitized. Each demo runs in an isolated iframe with scripts enabled, without access to the article's DOM, cookies, or storage. Use self-contained browser code; parent-page integrations and authenticated requests are not part of this format. Demo files are public static assets when deployed.

## Agent editing workflow

- For a prepared post, edit its `.md` file directly. Preserve its frontmatter (`id`, `title`, `slug`, `excerpt`, `tags`, `publishedAt`, and optional `icon`, `image`, `imageAlt`). Keep the same `id` and `slug` for an existing post.
- Edit demos directly in `public/blog-demos/`; changes require no updates to the blog renderer. Do not put draft article text in a demo asset.
- Keep `demo` settings valid JSON. Other code fences (Python, JavaScript, etc.) stay normal code examples.
- Build with `npm run build`; this validates that prepared posts' demo files exist in the exported site. Use localhost to check actual controls, narrow screens, keyboard access, and reduced motion.

The starter demo has a learning-rate slider, Step, Play/Pause, and Reset. It starts paused, stops when offscreen or the tab is hidden, and uses manual steps when reduced motion is requested.
