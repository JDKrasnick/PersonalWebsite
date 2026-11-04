import { $, escape, words, readTime, urlFor, arrow, slugify, api, showError, toast, renderMarkdown, type Draft } from './blog';
import { mountDemos } from './blog-demos';
import { initBlogAssistant } from './blog-assistant';
import { initEditorFind } from './blog-editor-find';
import type { Editor } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { postImage } from '../lib/blog-images';
import { demoFence, exampleDemo } from '../lib/blog-demos';
import { draftValues, mergeDraftEdits, sameDraftValues } from '../lib/blog-draft-merge';

export async function initEditor() {
  const hosted = document.querySelector<HTMLElement>('[data-blog-editor]')?.dataset.hosted === 'true';
  const pictureElement = document.createElement('img');
  pictureElement.id = 'editor-picture-preview'; pictureElement.alt = '';
  $('editor-picture-preview').replaceWith(pictureElement);
  const fields = { title: $<HTMLTextAreaElement>('post-title'), excerpt: $<HTMLTextAreaElement>('post-excerpt'), slug: $<HTMLInputElement>('post-slug'), tags: $<HTMLInputElement>('post-tags'), image: $<HTMLInputElement>('post-image'), imageAlt: $<HTMLInputElement>('post-image-alt'), content: $<HTMLTextAreaElement>('post-content') };
  let richEditor: Editor | undefined;
  let sourceMode = false;
  let drafts: Draft[] = [];
  let current: Draft | undefined;
  let version = 0, savedVersion = 0, slugEdited = false, timer: ReturnType<typeof setTimeout>;
  let saveQueue: Promise<unknown> = Promise.resolve();
  let busy = false;
  let previewing = false;
  let editingPosition: { element: HTMLElement | null; scrollY: number } | undefined;
  let uploading = false;
  let conflictCopy: { mine: Record<string, string>; latest: Draft } | undefined;
  const conflictKey = () => `jd-blog-conflict:${current?.id ?? 'new'}`;
  type PictureTarget = { cover: true } | { cover: false; source: boolean; start: number; end: number };
  let pictureTarget: PictureTarget = { cover: true };
  const backupKey = () => `jd-blog-recovery:${current?.id ?? 'new'}`;
  const values = () => ({ title: fields.title.value, excerpt: fields.excerpt.value, slug: fields.slug.value, tags: fields.tags.value, image: fields.image.value, imageAlt: fields.imageAlt.value, content: fields.content.value });
  const status = (value: string) => { $('save-state').textContent = value; };
  const error = (value: unknown) => { showError('editor-error', value); status('Save failed — see details'); };
  const applyValues = (copy: Record<string, string>) => {
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) fields[key].value = copy[key] || '';
    richEditor?.commands.setContent(fields.content.value, { contentType: 'markdown', emitUpdate: false });
    refreshPreview();
  };
  const reviewConflict = (mine: Record<string, string>, latest: Draft) => {
    conflictCopy = { mine, latest };
    // Archive separately: subsequent typing must not erase the competing copy.
    try { localStorage.setItem(conflictKey(), JSON.stringify(mine)); } catch { /* Both copies remain in this tab. */ }
    $('editor-error').hidden = true; $('editor-conflict').hidden = false;
    status('Review draft versions');
    setBusy(busy);
  };
  const refreshPreview = () => {
    $('demo-editor-hint').hidden = !/\`\`\`demo\b/.test(fields.content.value);
    $('word-count').textContent = `${words(fields.content.value).toLocaleString()} words · ${readTime(fields.content.value)}`;
    const picture = $<HTMLImageElement>('editor-picture-preview');
    let image = '';
    try { image = postImage(fields.image.value, fields.imageAlt.value).image; } catch { /* The save API provides validation feedback. */ }
    $('editor-picture').hidden = !image;
    if (image && picture.getAttribute('src') !== image) { $('editor-picture-error').hidden = true; picture.hidden = false; picture.src = image; }
    if (!image) picture.removeAttribute('src');
    picture.alt = fields.imageAlt.value;
    $('picture-settings').querySelector('summary')!.textContent = fields.image.value ? 'Edit picture' : 'Add picture';
    $('remove-picture').hidden = !fields.image.value;
    for (const field of [fields.title, fields.excerpt, ...(sourceMode ? [fields.content] : [])]) { field.style.height = 'auto'; field.style.height = `${field.scrollHeight}px`; }
  };
  const updateToolbar = () => {
    const locked = busy || Boolean(conflictCopy);
    const names: Record<string, string> = { bold: 'bold', italic: 'italic', strike: 'strike', 'inline-code': 'code', quote: 'blockquote', code: 'codeBlock', list: 'bulletList', 'ordered-list': 'orderedList', link: 'link' };
    document.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(button => {
      const format = button.dataset.format!;
      if (names[format]) button.setAttribute('aria-pressed', String(!sourceMode && Boolean(richEditor?.isActive(names[format]))));
      if (format === 'undo' || format === 'redo') button.disabled = locked || sourceMode || !(format === 'undo' ? richEditor?.can().undo() : richEditor?.can().redo());
      if (format === 'clear') button.disabled = locked || sourceMode;
      if (format === 'indent' || format === 'outdent') button.disabled = locked || sourceMode || !(format === 'indent' ? richEditor?.can().sinkListItem('listItem') : richEditor?.can().liftListItem('listItem'));
    });
    $<HTMLSelectElement>('text-style').value = !sourceMode && richEditor?.isActive('heading') ? String(richEditor.getAttributes('heading').level) : 'paragraph';
    $('table-actions').hidden = sourceMode || !richEditor?.isActive('table');
    findPanel.refresh();
  };
  const renderRail = () => {
    $('post-selector').innerHTML = `<option value="" disabled${!current ? ' selected' : ''}>New draft</option>${drafts.map(draft => `<option value="${escape(draft.id)}"${draft.id === current?.id ? ' selected' : ''}>${escape(draft.title || 'Untitled post')}</option>`).join('')}`;
    const published = !hosted && Boolean(current?.prepared);
    $('publish-post').hidden = hosted;
    $('post-state').textContent = published ? 'Ready for GitHub' : 'Draft';
    $('post-state').classList.toggle('published', published);
    $('publish-post').textContent = published ? 'Update GitHub file' : 'Prepare for GitHub';
    $('published-note').innerHTML = published ? `Prepared in content/blog. Commit and push to make it live. <a href="${urlFor(current!.published!)}">View prepared post ${arrow('up-right')}</a>` : 'Only you can see this draft.';
    $('unpublish-post').hidden = !published;
    $<HTMLButtonElement>('delete-post').disabled = !current;
  };
  const load = (draft?: Draft) => {
    closePreview();
    clearTimeout(timer); current = draft; version = 0; savedVersion = 0; slugEdited = Boolean(draft);
    fields.title.value = draft?.title || ''; fields.excerpt.value = draft?.excerpt || ''; fields.slug.value = draft?.slug || ''; fields.tags.value = draft?.tags.join(', ') || ''; fields.content.value = draft?.content || '';
    fields.image.value = draft?.image || ''; fields.imageAlt.value = draft?.imageAlt || '';
    history.replaceState(null, '', draft ? `/blog/editor?id=${encodeURIComponent(draft.id)}` : '/blog/editor');
    $('editor-error').hidden = true;
    conflictCopy = undefined; $('editor-conflict').hidden = true;
    $('picture-upload-state').hidden = true;
    status(draft ? 'All changes saved' : 'Ready to write');
    try {
      const recovery = localStorage.getItem(backupKey());
      if (recovery) {
        const recovered = JSON.parse(recovery);
        if (draft && sameDraftValues(recovered, draft)) localStorage.removeItem(backupKey());
        else if (recovered.revision !== draft?.revision && draft) { reviewConflict(draftValues(recovered), draft); }
        else { for (const key of Object.keys(fields) as (keyof typeof fields)[]) if (typeof recovered[key] === 'string') fields[key].value = recovered[key]; version++; status('Unsaved text recovered'); }
      }
      const archived = localStorage.getItem(conflictKey());
      if (archived && draft && !conflictCopy) reviewConflict(draftValues(JSON.parse(archived)), draft);
    } catch { /* Disk saving still works if browser storage is unavailable. */ }
    richEditor?.commands.setContent(fields.content.value, { contentType: 'markdown', emitUpdate: false });
    // A freshly loaded draft must not inherit another post's undo stack.
    if (richEditor) richEditor.view.updateState(EditorState.create({ schema: richEditor.schema, doc: richEditor.state.doc, plugins: richEditor.state.plugins }));
    refreshPreview(); renderRail(); updateToolbar();
  };
  const save = async (): Promise<Draft | undefined> => {
    clearTimeout(timer);
    const task = saveQueue.then(async () => {
      if (conflictCopy) throw Object.assign(new Error('Choose which draft version to use.'), { review: true });
      if (version === savedVersion && current) { $('editor-error').hidden = true; status('All changes saved'); return current; }
      if (!current && !Object.values(values()).some(Boolean)) return undefined;
      let savingVersion = version;
      const previousKey = backupKey();
      status('Saving…');
      let post: Draft;
      try { post = await api<Draft>('save', { ...values(), id: current?.id, revision: current?.revision }); }
      catch (failure) {
        if ((failure as { status?: number }).status !== 409 || !current) throw failure;
        const latest = (await api<Draft[]>('drafts')).find(draft => draft.id === current!.id);
        if (!latest) throw new Error('This draft was deleted in another tab. Your text is still in this browser.');
        // Include any keystrokes typed while the failed request was in flight.
        const merged = mergeDraftEdits(current, values(), latest);
        if (merged.conflicts.length) {
          applyValues(merged.values);
          reviewConflict(merged.values, latest);
          throw Object.assign(new Error('Choose which draft version to use.'), { review: true });
        }
        current = latest; applyValues(merged.values); savingVersion = ++version;
        try { localStorage.setItem(backupKey(), JSON.stringify({ ...merged.values, revision: latest.revision })); } catch { /* The tab still contains the merged text. */ }
        post = sameDraftValues(merged.values, latest) ? latest : await api<Draft>('save', { ...merged.values, id: latest.id, revision: latest.revision });
      }
      current = post;
      const index = drafts.findIndex(draft => draft.id === post.id);
      if (index < 0) drafts.unshift(post); else drafts[index] = post;
      savedVersion = savingVersion; slugEdited = true;
      if (!fields.slug.value) fields.slug.value = post.slug;
      try {
        localStorage.removeItem(previousKey);
        if (version !== savedVersion) localStorage.setItem(backupKey(), JSON.stringify({ ...values(), revision: post.revision }));
      } catch { /* Server persisted the post. */ }
      history.replaceState(null, '', `/blog/editor?id=${encodeURIComponent(post.id)}`);
      $('editor-error').hidden = true;
      status(version === savedVersion ? 'All changes saved' : 'Unsaved changes'); renderRail();
      return post;
    });
    saveQueue = task.catch(() => {});
    try { const result = await task; return version !== savedVersion && result ? await save() : result; } catch (value) { if (!(value as { review?: boolean }).review) error(value); throw value; }
  };
  const changed = () => {
    version++; status('Unsaved changes');
    try { localStorage.setItem(backupKey(), JSON.stringify({ ...values(), revision: current?.revision })); } catch { /* Autosave remains available. */ }
    if (conflictCopy) { reviewConflict(values(), conflictCopy.latest); refreshPreview(); findPanel.refresh(); return; }
    refreshPreview(); clearTimeout(timer); timer = setTimeout(() => { void save().catch(() => {}); }, 1000);
    findPanel.refresh();
  };
  $('conflict-download').addEventListener('click', () => {
    if (!conflictCopy) return;
    const copy = conflictCopy.mine;
    const href = URL.createObjectURL(new Blob([`# ${copy.title}\n\n${copy.excerpt}\n\n${copy.content}\n\n<!-- Draft metadata: ${JSON.stringify({ slug: copy.slug, tags: copy.tags, image: copy.image, imageAlt: copy.imageAlt }).replace(/--/g, '\\u002d\\u002d')} -->`], { type: 'text/markdown' }));
    const link = document.createElement('a'); link.href = href; link.download = `${copy.slug || 'draft'}-browser-copy.md`; link.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
  });
  for (const choice of ['mine', 'saved']) $('conflict-' + choice).addEventListener('click', async () => {
    if (!conflictCopy || busy) return;
    const pending = conflictCopy; setBusy(true);
    try {
      const latest = (await api<Draft[]>('drafts')).find(draft => draft.id === current?.id);
      if (!latest) throw new Error('This draft was deleted in another tab. Download your browser copy before continuing.');
      const copy = mergeDraftEdits(pending.latest, pending.mine, latest).values;
      localStorage.removeItem(conflictKey()); localStorage.removeItem(backupKey());
      drafts[drafts.findIndex(draft => draft.id === latest.id)] = latest;
      load(latest);
      if (choice === 'mine') { applyValues(copy); version++; status('Unsaved changes — click Save draft'); localStorage.setItem(backupKey(), JSON.stringify({ ...copy, revision: latest.revision })); }
    } catch (value) { error(value); } finally { setBusy(false); }
  });
  const findPanel = initEditorFind({ editor: () => richEditor, source: () => sourceMode, field: fields.content, changed, busy: () => busy });
  const setBusy = (value: boolean) => {
    busy = value;
    const locked = value || Boolean(conflictCopy);
    ['save-draft', 'open-preview', 'publish-post', 'unpublish-post', 'new-post', 'delete-post', 'post-selector'].forEach(id => { $<HTMLButtonElement>(id).disabled = value; });
    Object.values(fields).forEach(field => { if (field instanceof HTMLSelectElement) field.disabled = locked; else field.readOnly = locked; });
    richEditor?.setEditable(!locked, false);
    $<HTMLButtonElement>('remove-picture').disabled = locked;
    $<HTMLButtonElement>('insert-demo').disabled = locked;
    ['choose-cover', 'insert-picture', 'picture-file'].forEach(id => { $<HTMLButtonElement>(id).disabled = locked; });
    document.querySelectorAll<HTMLButtonElement>('[data-editor-mode]').forEach(button => { button.disabled = locked; });
    document.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(button => { button.disabled = locked; });
    $<HTMLSelectElement>('text-style').disabled = locked;
    ['conflict-mine', 'conflict-saved', 'conflict-download'].forEach(id => { $<HTMLButtonElement>(id).disabled = value; });
    if (!value) $<HTMLButtonElement>('delete-post').disabled = !current;
    updateToolbar();
  };
  Object.entries(fields).forEach(([key, field]) => field.addEventListener('input', () => {
    if (key === 'slug') slugEdited = true;
    if (key === 'title' && !slugEdited) fields.slug.value = slugify(fields.title.value);
    changed();
  }));
  $('editor-picture-preview').addEventListener('error', () => { $('editor-picture-preview').hidden = true; $('editor-picture-error').hidden = false; });
  $('editor-picture-preview').addEventListener('load', () => { $('editor-picture-preview').hidden = false; $('editor-picture-error').hidden = true; });
  $('remove-picture').addEventListener('click', () => { fields.image.value = ''; fields.imageAlt.value = ''; changed(); });
  const articleTarget = (event?: DragEvent): PictureTarget => {
    const position = event && !sourceMode ? richEditor?.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos : undefined;
    return { cover: false, source: sourceMode, start: sourceMode ? fields.content.selectionStart : (position ?? richEditor?.state.selection.from ?? 0), end: sourceMode ? fields.content.selectionEnd : (position ?? richEditor?.state.selection.to ?? 0) };
  };
  const uploadPicture = async (files: File[], target: PictureTarget) => {
    if (busy || !files.length) return;
    const state = $('picture-upload-state');
    state.hidden = false;
    if (files.length !== 1) { state.textContent = 'Choose one picture at a time.'; toast(state.textContent); return; }
    const file = files[0];
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) { state.textContent = 'Use a PNG, JPG, WebP, GIF, or AVIF picture.'; toast(state.textContent); return; }
    const maxMegabytes = hosted ? 4 : 10;
    if (file.size > maxMegabytes * 1024 * 1024) { state.textContent = `Choose a picture under ${maxMegabytes} MB.`; toast(state.textContent); return; }
    clearTimeout(timer);
    uploading = true; setBusy(true);
    state.textContent = 'Uploading picture…';
    status('Uploading picture…');
    try {
      const response = await fetch('/api/blog/upload', { method: 'POST', headers: { 'Content-Type': file.type, 'X-Image-Name': encodeURIComponent(file.name) }, body: file });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not upload this picture. Try again.');
      if (target.cover) {
        fields.image.value = result.image; fields.imageAlt.value = '';
        $<HTMLDetailsElement>('picture-settings').open = true;
        changed();
      } else if (target.source) {
        fields.content.setRangeText(`\n\n![](${result.image})\n\n`, target.start, target.end, 'end');
        changed();
      } else {
        richEditor?.chain().setTextSelection({ from: target.start, to: target.end }).setImage({ src: result.image, alt: '' }).run();
      }
      state.textContent = hosted ? 'Picture added. It is stored privately with your drafts.' : 'Picture added. Commit the image file with your post to publish it.';
      status('Unsaved changes');
      toast('Picture added.');
      $('editor-error').hidden = true;
    } catch (value) {
      state.textContent = 'Picture upload failed. Your article is unchanged.';
      status('Picture upload failed');
      toast('Picture upload failed. Try again.');
      showError('editor-error', value);
    } finally {
      uploading = false; setBusy(false);
      if (version !== savedVersion) { clearTimeout(timer); timer = setTimeout(() => { void save().catch(() => {}); }, 1000); }
      if (target.cover) fields.imageAlt.focus();
      else if (target.source) fields.content.focus();
      else richEditor?.commands.focus();
    }
  };
  const choosePicture = (target: PictureTarget) => {
    if (busy) return;
    pictureTarget = target;
    const input = $<HTMLInputElement>('picture-file'); input.value = ''; input.click();
  };
  $('choose-cover').addEventListener('click', () => choosePicture({ cover: true }));
  $('insert-picture').addEventListener('click', () => choosePicture(articleTarget()));
  $('picture-file').addEventListener('change', () => { void uploadPicture(Array.from($<HTMLInputElement>('picture-file').files ?? []), pictureTarget); });
  // Capture file drops before the rich editor/browser attempts to open or insert them.
  const article = document.querySelector<HTMLElement>('.article-editor')!;
  const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files');
  const clearDrag = () => { article.classList.remove('is-dragging'); ['rich-editor', 'markdown-source', 'choose-cover'].forEach(id => $(id).classList.remove('is-dragging')); };
  article.addEventListener('dragover', event => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
    clearDrag();
    if (!busy) {
      const body = (event.target as HTMLElement).closest('#rich-editor, #markdown-source');
      if (body) body.classList.add('is-dragging'); else article.classList.add('is-dragging');
    }
  }, true);
  article.addEventListener('dragleave', event => { if (!article.contains(event.relatedTarget as Node | null)) clearDrag(); });
  article.addEventListener('drop', event => {
    if (!hasFiles(event)) return;
    event.preventDefault(); event.stopPropagation(); clearDrag();
    const body = (event.target as HTMLElement).closest('#rich-editor, #markdown-source');
    void uploadPicture(Array.from(event.dataTransfer?.files ?? []), body ? articleTarget(event) : { cover: true });
  }, true);
  article.addEventListener('paste', event => {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (!files.length) return;
    event.preventDefault(); event.stopPropagation();
    const body = (event.target as HTMLElement).closest('#rich-editor, #markdown-source');
    void uploadPicture(files, body ? articleTarget() : { cover: true });
  }, true);
  $('insert-demo').addEventListener('click', () => {
    if (busy) return;
    if (sourceMode) {
      fields.content.setRangeText(demoFence(exampleDemo), fields.content.selectionStart, fields.content.selectionEnd, 'end');
      fields.content.focus(); changed();
    } else richEditor?.chain().focus().insertContent([
      { type: 'codeBlock', attrs: { language: 'demo' }, content: [{ type: 'text', text: JSON.stringify(exampleDemo, null, 2) }] },
      { type: 'paragraph' },
    ]).run();
    toast('Demo inserted. Preview runs it.');
  });
  $('post-selector').addEventListener('change', async () => {
    if (busy) return;
    const selectedId = $<HTMLSelectElement>('post-selector').value;
    setBusy(true);
    try { await save(); load(drafts.find(draft => draft.id === selectedId)); } catch { /* Keep the current draft if saving fails. */ } finally { setBusy(false); }
  });
  $('new-post').addEventListener('click', async () => { if (busy) return; setBusy(true); try { await save(); load(); fields.title.focus(); } catch { /* Save failure leaves the current draft intact. */ } finally { setBusy(false); } });
  const focusSaveIssue = () => { const notice = $(conflictCopy ? 'editor-conflict' : 'editor-error'); notice.scrollIntoView({ block: 'center' }); notice.focus({ preventScroll: true }); };
  $('save-draft').addEventListener('click', async () => { setBusy(true); try { await save(); toast('Draft saved.'); } catch { focusSaveIssue(); } finally { setBusy(false); } });
  function closePreview(restore = false) {
    previewing = false;
    document.querySelector<HTMLElement>('.article-editor')!.hidden = false;
    $('editor-preview').hidden = true;
    $('editor-preview-article').replaceChildren();
    $('open-preview').setAttribute('aria-pressed', 'false');
    if (restore && editingPosition) {
      editingPosition.element?.focus({ preventScroll: true });
      window.scrollTo({ top: editingPosition.scrollY, behavior: 'instant' });
    }
    editingPosition = undefined;
  }
  $('close-editor-preview').addEventListener('click', () => closePreview(true));
  // Keep the active field/selection before a mouse click moves focus to the toggle.
  $('open-preview').addEventListener('pointerdown', () => {
    if (!previewing) editingPosition = { element: document.activeElement as HTMLElement, scrollY: window.scrollY };
  });
  $('open-preview').addEventListener('click', async () => {
    if (busy) return;
    if (previewing) { closePreview(true); return; }
    editingPosition ??= { element: document.activeElement as HTMLElement, scrollY: window.scrollY };
    setBusy(true);
    try {
      const post = await save();
      if (!post) throw new Error('Write something before opening a preview.');
      const picture = postImage(post.image, post.imageAlt);
      const root = $('editor-preview-article');
      root.innerHTML = `<header class="article-header"><h1>${escape(post.title || 'Untitled post')}</h1>${post.excerpt ? `<p class="article-description">${escape(post.excerpt)}</p>` : ''}</header>${picture.image ? `<figure class="article-picture"><img src="${escape(picture.image)}" alt="${escape(picture.imageAlt)}" /></figure>` : ''}<div class="prose">${renderMarkdown(post.content)}</div>`;
      mountDemos(root);
      previewing = true;
      document.querySelector<HTMLElement>('.article-editor')!.hidden = true;
      $('editor-preview').hidden = false;
      $('open-preview').setAttribute('aria-pressed', 'true');
      $('editor-preview').scrollIntoView({ block: 'start', behavior: 'instant' });
      $('close-editor-preview').focus({ preventScroll: true });
    }
    catch (value) { editingPosition = undefined; error(value); }
    finally { setBusy(false); }
  });
  $('publish-post').addEventListener('click', async () => {
    if (hosted) return;
    setBusy(true);
    try {
      const post = await save();
      if (!post) throw new Error('Add a title and some content before publishing.');
      const published = await api<Draft>('publish', { id: post.id, revision: post.revision });
      drafts[drafts.findIndex(draft => draft.id === post.id)] = published; current = published;
      renderRail(); toast('Markdown file prepared. Commit and push to GitHub to publish.');
    } catch (value) { error(value); }
    finally { setBusy(false); }
  });
  $('unpublish-post').addEventListener('click', async () => {
    if (hosted) return;
    if (!current || !confirm('Remove this post’s GitHub file? Your draft is kept. Commit and push the removal to take it off the live site.')) return;
    setBusy(true);
    try { const post = await save(); const result = await api<Draft>('unpublish', { id: post!.id, revision: post!.revision }); drafts[drafts.findIndex(draft => draft.id === result.id)] = result; current = result; renderRail(); toast('GitHub file removed. Commit and push to unpublish.'); }
    catch (value) { error(value); } finally { setBusy(false); }
  });
  $('delete-post').addEventListener('click', async () => {
    if (!current || !confirm(hosted ? 'Permanently delete this private draft?' : 'Permanently delete this draft and remove its GitHub file? Live changes still require a commit and push.')) return;
    clearTimeout(timer); setBusy(true);
    try { await saveQueue; await api('delete', { id: current.id, revision: current.revision }); localStorage.removeItem(backupKey()); drafts = drafts.filter(draft => draft.id !== current!.id); version = savedVersion; load(drafts[0]); toast('Post deleted.'); }
    catch (value) { error(value); } finally { setBusy(false); }
  });
  document.querySelectorAll<HTMLButtonElement>('[data-editor-mode]').forEach(button => button.addEventListener('click', () => {
    sourceMode = button.dataset.editorMode === 'markdown';
    $('rich-editor').hidden = sourceMode;
    $('markdown-source').hidden = !sourceMode;
    if (!sourceMode) richEditor?.commands.setContent(fields.content.value, { contentType: 'markdown', emitUpdate: false });
    document.querySelectorAll<HTMLButtonElement>('[data-editor-mode]').forEach(tab => tab.setAttribute('aria-pressed', String(tab === button)));
    refreshPreview(); updateToolbar();
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(button => button.addEventListener('click', () => {
    if (busy) return;
    if (!sourceMode && richEditor) {
      const chain = richEditor.chain().focus();
      switch (button.dataset.format) {
        case 'heading': chain.toggleHeading({ level: 2 }).run(); break;
        case 'bold': chain.toggleBold().run(); break;
        case 'italic': chain.toggleItalic().run(); break;
        case 'strike': chain.toggleStrike().run(); break;
        case 'inline-code': chain.toggleCode().run(); break;
        case 'quote': chain.toggleBlockquote().run(); break;
        case 'code': chain.toggleCodeBlock().run(); break;
        case 'list': chain.toggleBulletList().run(); break;
        case 'ordered-list': chain.toggleOrderedList().run(); break;
        case 'divider': chain.setHorizontalRule().run(); break;
        case 'table': chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
        case 'row': chain.addRowAfter().run(); break;
        case 'column': chain.addColumnAfter().run(); break;
        case 'remove-row': chain.deleteRow().run(); break;
        case 'remove-column': chain.deleteColumn().run(); break;
        case 'remove-table': chain.deleteTable().run(); break;
        case 'clear': chain.unsetAllMarks().clearNodes().run(); break;
        case 'indent': chain.sinkListItem('listItem').run(); break;
        case 'outdent': chain.liftListItem('listItem').run(); break;
        case 'undo': chain.undo().run(); break;
        case 'redo': chain.redo().run(); break;
        case 'link': {
          const previous = richEditor.getAttributes('link').href || '';
          const url = prompt('Link URL', previous || 'https://');
          if (url === null) break;
          if (!url) chain.extendMarkRange('link').unsetLink().run();
          else if (/^(https?:\/\/|mailto:|\/|#)/i.test(url)) chain.extendMarkRange('link').setLink({ href: url }).run();
          else toast('Use an https://, http://, mailto:, or relative link.');
          break;
        }
      }
      updateToolbar(); return;
    }
    const start = fields.content.selectionStart, end = fields.content.selectionEnd;
    const selection = fields.content.value.slice(start, end);
    const format: Record<string, string> = { bold: `**${selection || 'bold text'}**`, italic: `*${selection || 'italic text'}*`, strike: `~~${selection || 'text'}~~`, 'inline-code': `\`${selection || 'code'}\``, quote: `\n${(selection || 'Quote').split('\n').map(line => `> ${line}`).join('\n')}\n`, link: `[${selection || 'link text'}](https://example.com)`, code: `\n\`\`\`python\n${selection || '# Your code here'}\n\`\`\`\n`, list: `\n${(selection || 'List item').split('\n').map(line => `- ${line}`).join('\n')}\n`, 'ordered-list': `\n${(selection || 'List item').split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n')}\n`, divider: '\n\n---\n\n', table: '\n\n| Heading | Heading |\n| --- | --- |\n| Cell | Cell |\n| Cell | Cell |\n\n' };
    const text = format[button.dataset.format!];
    if (text === undefined) return;
    fields.content.setRangeText(text, start, end, 'select'); fields.content.focus(); changed();
  }));
  $('text-style').addEventListener('change', () => {
    if (busy) return;
    const value = $<HTMLSelectElement>('text-style').value;
    if (!sourceMode && richEditor) {
      if (value === 'paragraph') richEditor.chain().focus().setParagraph().run();
      else richEditor.chain().focus().setHeading({ level: Number(value) as 2 | 3 | 4 }).run();
    } else {
      const start = fields.content.value.lastIndexOf('\n', fields.content.selectionStart - 1) + 1;
      const end = fields.content.value.indexOf('\n', fields.content.selectionEnd);
      const text = fields.content.value.slice(start, end < 0 ? undefined : end).replace(/^#{1,6}\s+/, '');
      fields.content.setRangeText(`${value === 'paragraph' ? '' : '#'.repeat(Number(value)) + ' '}${text}`, start, end < 0 ? fields.content.value.length : end, 'select');
      fields.content.focus(); changed();
    }
    updateToolbar();
  });
  window.addEventListener('beforeunload', event => { if (uploading || version !== savedVersion) event.preventDefault(); });
  window.addEventListener('keydown', event => {
    // The assistant has its own composer and modal keyboard behavior.
    if ((event.target as HTMLElement).closest('#blog-assistant')) return;
    const mod = event.metaKey || event.ctrlKey, key = event.key.toLowerCase();
    if (event.key === 'Escape' && previewing) { event.preventDefault(); closePreview(true); return; }
    if (event.key === 'Escape' && $<HTMLDetailsElement>('editor-shortcuts').open) { $<HTMLDetailsElement>('editor-shortcuts').open = false; return; }
    if (!mod || busy) return;
    if (key === 's' && !event.shiftKey && !event.altKey) { event.preventDefault(); void save().then(() => toast('Draft saved.')).catch(focusSaveIssue); return; }
    if (conflictCopy) return;
    if (key === 'p' && event.shiftKey && !event.altKey) { event.preventDefault(); $('open-preview').click(); return; }
    if (previewing) return;
    if (key === 'm' && event.shiftKey && !event.altKey) { event.preventDefault(); document.querySelector<HTMLButtonElement>(`[data-editor-mode="${sourceMode ? 'document' : 'markdown'}"]`)!.click(); (sourceMode ? fields.content : richEditor?.view.dom)?.focus(); return; }
    if (key === '/' && !event.shiftKey && !event.altKey) { event.preventDefault(); const help = $<HTMLDetailsElement>('editor-shortcuts'); help.open = !help.open; if (help.open) help.scrollIntoView({ block: 'nearest' }); return; }
    if (key === 'f' && !event.altKey && (event.shiftKey || (event.target as HTMLElement).closest('#rich-editor, #markdown-source'))) { event.preventDefault(); findPanel.toggle(); $('editor-find').scrollIntoView({ block: 'nearest' }); return; }
    const inBody = (event.target as HTMLElement).closest('#rich-editor, #markdown-source');
    if (!inBody) return;
    if (event.altKey && ['0', '2', '3', '4'].includes(event.code.replace('Digit', ''))) {
      event.preventDefault(); $<HTMLSelectElement>('text-style').value = event.code === 'Digit0' ? 'paragraph' : event.code.replace('Digit', ''); $('text-style').dispatchEvent(new Event('change')); return;
    }
    let format = !event.altKey && !event.shiftKey ? ({ b: 'bold', i: 'italic', k: 'link', '\\': 'clear' } as Record<string, string>)[key] : event.shiftKey && !event.altKey && key === 's' ? 'strike' : undefined;
    // Tiptap owns its native rich-text keys; source mode uses the same toolbar commands.
    if (format && (sourceMode || !event.defaultPrevented)) { event.preventDefault(); document.querySelector<HTMLButtonElement>(`[data-format="${format}"]`)?.click(); }
  });
  window.addEventListener('resize', refreshPreview);
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--blog-editor-bar-height', `${document.querySelector('.editor-bar')!.getBoundingClientRect().height}px`);
  }).observe(document.querySelector('.editor-bar')!);
  setBusy(true);
  try {
    const { createPostEditor } = await import('./blog-rich-editor');
    richEditor = createPostEditor($('rich-editor'), markdown => { fields.content.value = markdown; changed(); }, updateToolbar);
    drafts = (await api<Draft[]>('drafts')).sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    const requested = new URLSearchParams(location.search).get('id');
    let hasNewRecovery = false;
    try { hasNewRecovery = !requested && Boolean(localStorage.getItem('jd-blog-recovery:new')); } catch { /* Browser storage can be unavailable. */ }
    load(hasNewRecovery ? undefined : (drafts.find(draft => draft.id === requested) ?? drafts[0]));
    setBusy(false);
    initBlogAssistant(() => `Title: ${fields.title.value}\nDescription: ${fields.excerpt.value}\n\n${fields.content.value}`, () => {
      if (sourceMode) return fields.content.value.slice(fields.content.selectionStart, fields.content.selectionEnd);
      return richEditor ? richEditor.state.doc.textBetween(richEditor.state.selection.from, richEditor.state.selection.to, '\n') : '';
    });
  } catch (value) { showError('editor-error', value); setBusy(true); }
}
