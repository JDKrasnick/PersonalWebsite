# Blog posts and interactive demos

Posts are Markdown files in `content/blog/`. The localhost editor stores private drafts separately; **Prepare for GitHub** writes the reviewed Markdown file. Commit and push the post and any assets together to publish.

## Public article output

Only prepared Markdown posts enter public article output. Build generates `/blog/<slug>/` with the complete sanitized article, article metadata and BlogPosting structured data. The blog index includes readable HTML and direct article links, so reading works without JavaScript; search and demos enhance the page. Old query-based article URLs redirect permanently to the static path.

The generated sitemap lists only the homepage, blog index and prepared posts. Robots allows public reading and excludes private authoring routes. Owner-session checks still protect hosted editor, drafts, previews and APIs; login and private authoring responses retain private headers, and saving a private draft does not add it to public pages or the sitemap.

## Editor controls

The hosted and localhost editors share the formatting toolbar, Write/Markdown modes, and literal Find / replace with Match case, Previous/Next, Replace and Replace all. Formatting includes Paragraph/H2–H4, emphasis, strike, inline/fenced code, links, quotes, bullet/numbered lists, dividers and tables. In Write, clear formatting, list indent/outdent and table row/column insertion/deletion are available; undo history resets for each loaded draft.

Preview saves first and shows the sanitized article and running demos inside the same window. The top Preview button keeps its label and pressed state; use Cmd/Ctrl+Shift+P to toggle, or Escape / Edit post to return to the prior field, selection and scroll. Save uses Cmd/Ctrl+S. Cmd/Ctrl+/ toggles the inline shortcut guide, Cmd/Ctrl+Shift+M changes mode and Cmd/Ctrl+Shift+F opens find/replace. Failed saves retain browser recovery text; retry after reconnecting or signing in again. Saving never publishes.

## Edit private drafts on the website

Open `https://www.jdkrasnick.com/blog/editor` and sign in with the owner password. The editor is absent from public navigation. Its page, previews, draft APIs, and uploaded pictures require a server-verified session and are excluded from public caches and indexing.

The hosted editor saves drafts and pictures to a private Vercel Blob store. **Save draft**, autosave, Write/Markdown modes, and private previews work across devices. Saving never publishes an article. GitHub preparation and publication remain in the local workflow. Concurrent tabs cannot silently overwrite a newer saved version.

Hosted picture uploads accept the same image types as localhost, up to 4 MB per picture. They use authenticated image URLs and are not public assets. Before publishing a draft that uses these pictures, copy the pictures into `public/blog-images/uploads/` and update its references as part of the reviewed GitHub publication.

Owner setup and recovery are documented in `docs/private-blog-editor.md`.

## ChatGPT writing and image scripts

On localhost, Assistant uses the installed Codex CLI with a ChatGPT subscription. API-key accounts are refused before inference. Sessions are read-only and ephemeral, with shell, external integrations, plugins and image tools disabled; credentials remain with Codex. Stop, New chat, Reconnect and browser-stored conversation/job IDs support recovery. Copy reply and Copy code copy suggestions without editing the article. Embedded media is disabled in chat replies to prevent automatic media fetches.

In the protected hosted editor, Assistant uses **Copy & open ChatGPT**: it copies the request and opens a separate ChatGPT window, without local chat API requests or server-side ChatGPT credentials. Paste and submit the request there. **Attach post text** is unchecked by default; only select it when you want the article included. **Use selection** adds a chosen passage to the request. Clipboard fallback exposes selectable text when automatic copy is unavailable.

Image work prefers an editable, reproducible Python/Pillow script that saves a PNG. **Create image script** fills only an empty composer and does not send the request or overwrite your text. Submit when ready, copy the returned code, run it yourself and drop the PNG into the article. The assistant cannot execute the script or produce a file itself. **Open ChatGPT for an image** remains an optional subscription image-generation route; the editor does not call the billed Images API.

## Add pictures

Open **Add picture** to drop or choose a cover image. Drop or paste a picture into the article to insert it at the cursor; **Insert picture** opens a file picker for the body. Both Write and Markdown modes support pictures. Add a cover description in the picture settings; inline alternative text can be edited in Markdown (`![Description](path)`). Existing image URLs still work.

Localhost uploads accept PNG, JPG, WebP, GIF, and AVIF up to 10 MB and 40 megapixels (including animation frames). The local server validates the actual image data and saves the original file under `public/blog-images/uploads/`, with a safe filename and content hash. Markdown and cover metadata reference the resulting relative URL. Re-uploading the same named image reuses its path; different images never overwrite one another. SVG uploads are excluded; export them as PNG first.

Commit the image files along with the prepared post. Uploaded files are public assets in any deployment that includes them, even if the draft is not prepared. Removing a picture or deleting a draft keeps its file, so other posts using it continue to work. Delete unused files manually when appropriate. The local upload route runs in the development server; hosted uploads use the protected editor API and remain private. Neither workflow offers an unauthenticated upload API.

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

## Local version history

In the localhost editor, choose **Version history** to browse timestamped versions and preview their text and metadata. Each changed autosave or manual save records a full snapshot in the gitignored `.local/blog.json`, alongside the draft. Identical saves do not add duplicates. Existing drafts begin their history with their current text; versions from before this feature cannot be recovered.

History opens a full document on the left and a version list on the right. Select a version to see additions and strikethrough removals relative to the preceding saved version; **Show changes** toggles a clean reading view. On narrow screens, the version controls sit above the document. Use the arrow keys to move through versions, and Escape or **Back to editor** to return to writing.

**Restore this version** saves any pending edits first, then restores the selected text and metadata in one revision-checked operation. The text it replaces remains in history. If another tab saved meanwhile, restoration stops and asks you to reload and reopen history. A version whose URL is now used by another post is also blocked until the URL collision is resolved.

Preparing a GitHub file does not mean a post is live, so it does not clear or archive history. After publishing, use **Archive history** to mark the saved versions as archived. They remain viewable and restorable. New edits create active versions again. **Delete archived versions…** asks for confirmation and permanently removes only archived snapshots, keeping the current draft and active versions. Deleting a post also deletes its history. History is local to this checkout and is not uploaded or available in the hosted editor.
