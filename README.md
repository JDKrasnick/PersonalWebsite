# JD Krasnick's website

## Local technical blog

Run `npm install` and `npm run dev`, then open `http://localhost:4321/blog`.
The portfolio's header includes a Blog link. Open `/blog/editor` to write.

The blog retains its dark blue palette and Inter typography with bright reading text (19px desktop, 18px mobile; 1.8 line height) and semibold near-white article titles. Paragraphs, lists, quotes, pictures, code, tables, and demos share the full reading/editor column, without a separate paragraph-width cap or mobile code-block breakout.

- Create posts with New post. Write directly into the formatted article, including headings, emphasis, links, lists, tables, images by URL, and code blocks. The document grows with your writing; it has no internal scrolling pane.
- Drafts autosave after a short pause. Save draft (or Cmd/Ctrl+S) saves immediately.
- Write is the visual editor; Markdown opens the underlying source when needed. Preview opens the saved draft in the actual article layout in a new tab. Post settings contains the URL and tags. Post icons and their picker are no longer shown; older icon metadata remains supported for compatibility.
- Insert demo adds an editable `demo` JSON code block in Write, or a fenced block in Markdown. The editor shows the configuration, not a running iframe; use Preview to run it. Each block references a standalone HTML/CSS/JavaScript file under `public/blog-demos/`. See the [blog and interactive-demo authoring guide](docs/blog-authoring.md) for the format and agent editing workflow. Commit demo files with the prepared Markdown; preparation and build validate referenced files. Raw article scripts remain sanitized, and running demos use a scripts-only sandbox without same-origin access.
- Add picture optionally attaches a post picture by URL, with alternative text, live preview, load-error feedback, and Remove picture. Use an HTTPS URL or a root-relative path such as `/images/post.jpg` for a file placed at `public/images/post.jpg`. This is a URL field, not an upload. The picture leads the index row on the left (220×144px desktop; 128×96px mobile), beside the date/title, and appears between the article header and body.
- Prepare for GitHub writes a reviewed Markdown file under `content/blog/`. Update GitHub file replaces that prepared version. Later draft edits stay private until prepared again.
- Picture fields stay private with the draft until preparation, then round-trip as validated `image` and `imageAlt` Markdown frontmatter. Commit any referenced `public/` image files together with the Markdown. Remote pictures remain hosted at their external URLs; preparation does not download or bundle them.
- Commit and push the prepared Markdown files to publish through the repository's deployment workflow. The editor never commits, pushes, or deploys automatically.
- Each published article has an on-site anonymous comment form. No account is needed; display names are optional. Comments are rendered as plain text, and Markdown HTML is sanitized before rendering.
- The Dan Luu-inspired index uses date/underlined-title rows, with prominent optional pictures and compact formatting for posts without pictures. The magnifying-glass button opens a nonmodal search/topic panel with All topics, Engineering, Research, existing post tags, result count, and Clear filters. The input receives focus on opening; close or Escape returns focus to the toggle. Filters persist when the panel closes, and the highlighted toggle indicates active filters. On narrow screens the panel sits above the results.

The local example uses `public/blog-images/technical-experiment.jpg`, a circuit-board photograph by Alexandre Debiève. `public/blog-images/credits.json` records the source, license link, and illustrative use; it is not a photograph of JD's work.

The local example also includes a gradient-descent demo with a learning-rate slider, Step, Play/Pause, and Reset. It starts paused, pauses when offscreen or the tab is hidden, and uses manual steps with reduced motion. Demo HTML files are public static assets when deployed; keep private draft text out of them.

Private drafts are persisted in `.local/blog.json` (gitignored). Local comments and abuse-limit state are in `.local/comments.json`; `.local/comments-secret` signs comment sessions and hashes client addresses. Back up `.local` to preserve drafts and local discussion. Browser storage also keeps pending text if a save fails. Version checks prevent a second editor tab from overwriting a newer save.

A clearly labeled example article is provided on first use. It can be edited, unpublished, or deleted from the editor.

The author editor is injected only for `astro dev`, outside the public pages directory. The editor and draft API reject non-loopback clients and external origins. Neither route, authoring controls, nor editor JavaScript ships in the production build. Only prepared `content/blog/*.md` files enter `/blog/posts.json`. The public site cannot create or modify articles; GitHub repository write access controls publishing. Draft previews are local only.

### Anonymous comments

Comments stay directly on each article, independent of GitHub publishing. Local development uses file storage automatically. The Vercel deployment includes a separate `/api/comments` function; hosted storage must be configured before public comments work:

1. Create a Redis database with an HTTPS REST API, such as Upstash Redis.
2. Configure `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and a random `COMMENTS_SECRET` (at least 32 characters) as server-only Vercel environment variables. `.env.example` lists the settings; never prefix them with `PUBLIC_`.
3. Rebuild through the usual GitHub deployment workflow. To moderate hosted comments locally, use the same server settings in your gitignored `.env` and open the article in the local site; Remove buttons are local-only.

Abuse prevention includes signed sessions bound to a hashed client address, a minimum form-fill interval, a honeypot, content/link/size checks, duplicate suppression, 30-second posting cooldown, 3 comments per 10 minutes and 20 per day per client, and 20 comments per minute per article across clients. Reads are limited to 120 per minute per client. Redis checks and writes are atomic across function instances; client-address records expire. Raw IP addresses are not stored. Comments are paginated in groups of 30. Public deletion is disabled; local-only moderation can remove comments.

If hosted storage is unconfigured or unavailable, the API returns an unavailable response instead of accepting comments that would be lost. No external database or deployment has been provisioned by this change. Use `npm run dev` for the private editor; a plain static server cannot run the live comment API.

Validation: `npm test`, `npm run check`, and `npm run build`. Tests use temporary storage and cover publishing boundaries, restart persistence, anonymous comments, rate limiting, spam defenses, concurrency and pagination. Builds verify that private authoring stays out of public artifacts and that only prepared Markdown enters the public feed.

## Astro project

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
