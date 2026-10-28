# Blog posts and interactive demos

Posts are Markdown files in `content/blog/`. The localhost editor stores private drafts separately; **Prepare for GitHub** writes the reviewed Markdown file. Commit and push the post and any assets together to publish.

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
