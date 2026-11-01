# Private draft editor

The public blog remains static and contains only prepared Markdown from `content/blog/`. Owner routes use on-demand server rendering and never export draft HTML or JSON into public assets.

## Access

- `/blog/editor`: password-protected writing workspace.
- `/blog/login`: owner sign-in, absent from public navigation.
- `/blog/preview?draft=ID`: authenticated preview.
- `/blog/logout`: same-origin POST clears the session.
- `/api/blog/drafts`, `/save`, `/delete`, `/upload`, `/image`: authenticated APIs under `/api/blog/`.

The production editor saves private drafts; it does not publish, unpublish, or write repository files. Localhost retains the original local editor and GitHub preparation workflow.

## Deployment configuration

Use Node 24 and create a **private** Vercel Blob store. A public Blob store is not an acceptable replacement: every SDK read and write explicitly uses `access: 'private'`.

Run `node scripts/blog-owner-credentials.mjs` once. It generates a random owner password, a salted scrypt hash, and a separate session secret. It preserves existing generated credentials on repeat runs. Private files are written with mode 0600 under `.local/`, excluded from Git, Vite file serving, and Vercel CLI uploads. Never commit them or copy them into `public/`.

Configure these server-only Vercel environment variables:

| Name | Value |
| --- | --- |
| `BLOG_EDITOR_PASSWORD_HASH` | `passwordHash` from `.local/blog-owner.json` |
| `BLOG_EDITOR_SESSION_SECRET` | `sessionSecret` from that file |
| `BLOG_DRAFT_BLOB_TOKEN` | Read/write token for the private Blob store |
| `BLOG_DRAFT_PREFIX` | Optional namespace, default `blog-private/v1`; use a separate prefix for tests |

The human-readable owner password is in `.local/blog-editor-access.txt`. The plaintext password is never deployed. Missing configuration fails closed. Rotate the password hash or session secret and redeploy to invalidate all existing sessions.

## Privacy and data integrity

Sessions last seven days, use an HMAC tied to both server secrets, and are stored in a host-only HttpOnly, Secure, SameSite=Strict cookie in production. Login and mutation requests require an exact same-origin header. A private, atomically updated Blob record limits login attempts per client and globally across function instances; it stores hashed client identifiers, not raw IP addresses.

Draft writes and deletes require the current revision and Blob ETag. Conditional writes reject stale tabs. Private reads bypass the Blob cache, and authenticated responses use `Cache-Control: private, no-store`. Private previews sanitize Markdown and retain the existing sandboxed demo behavior. Picture uploads decode bytes with Sharp, validate the actual format and pixel count, and use content-derived filenames.

The normal public reader ignores draft query parameters. The public feed remains sourced only from prepared Markdown. Asset/build checks assert that private pages are not static exports, credentials are absent from public JavaScript, and the feed does not contain private drafts.

## Validation

Run `npm test`, `npm run check`, and `npm run build` with Node 24. The authoring tests cover authentication, forged/expired sessions, cross-site writes, rate limits across instances, concurrent saves, private pictures, and backend error redaction. Before release, verify the deployed editor with both an authenticated browser and a separate guest session.
