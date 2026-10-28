import { $, escape, words, readTime, urlFor, arrow, slugify, api, showError, toast, type Draft } from './blog';
import type { Editor } from '@tiptap/core';
import { postImage } from '../lib/blog-images';
import { demoFence, exampleDemo } from '../lib/blog-demos';

export async function initEditor() {
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
  const backupKey = () => `jd-blog-recovery:${current?.id ?? 'new'}`;
  const values = () => ({ title: fields.title.value, excerpt: fields.excerpt.value, slug: fields.slug.value, tags: fields.tags.value, image: fields.image.value, imageAlt: fields.imageAlt.value, content: fields.content.value });
  const status = (value: string) => { $('save-state').textContent = value; };
  const error = (value: unknown) => { showError('editor-error', value); status('Could not save'); };
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
    const names: Record<string, string> = { heading: 'heading', bold: 'bold', italic: 'italic', code: 'codeBlock', list: 'bulletList', link: 'link' };
    document.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(button => button.setAttribute('aria-pressed', String(!sourceMode && Boolean(richEditor?.isActive(names[button.dataset.format!])))));
  };
  const renderRail = () => {
    $('post-selector').innerHTML = `<option value="" disabled${!current ? ' selected' : ''}>New draft</option>${drafts.map(draft => `<option value="${escape(draft.id)}"${draft.id === current?.id ? ' selected' : ''}>${escape(draft.title || 'Untitled post')}</option>`).join('')}`;
    const published = Boolean(current?.prepared);
    $('post-state').textContent = published ? 'Ready for GitHub' : 'Draft';
    $('post-state').classList.toggle('published', published);
    $('publish-post').textContent = published ? 'Update GitHub file' : 'Prepare for GitHub';
    $('published-note').innerHTML = published ? `Prepared in content/blog. Commit and push to make it live. <a href="${urlFor(current!.published!)}">View prepared post ${arrow('up-right')}</a>` : 'Only you can see this draft.';
    $('unpublish-post').hidden = !published;
    $<HTMLButtonElement>('delete-post').disabled = !current;
  };
  const load = (draft?: Draft) => {
    clearTimeout(timer); current = draft; version = 0; savedVersion = 0; slugEdited = Boolean(draft);
    fields.title.value = draft?.title || ''; fields.excerpt.value = draft?.excerpt || ''; fields.slug.value = draft?.slug || ''; fields.tags.value = draft?.tags.join(', ') || ''; fields.content.value = draft?.content || '';
    fields.image.value = draft?.image || ''; fields.imageAlt.value = draft?.imageAlt || '';
    history.replaceState(null, '', draft ? `/blog/editor?id=${encodeURIComponent(draft.id)}` : '/blog/editor');
    $('editor-error').hidden = true;
    status(draft ? 'All changes saved' : 'Ready to write');
    try {
      const recovery = localStorage.getItem(backupKey());
      if (recovery) {
        const recovered = JSON.parse(recovery);
        if (recovered.revision !== draft?.revision && draft) { error(new Error('A recovery copy exists from an older version. Your latest saved draft is shown. The recovery copy is still in this browser.')); }
        else { for (const key of Object.keys(fields) as (keyof typeof fields)[]) if (typeof recovered[key] === 'string') fields[key].value = recovered[key]; version++; status('Unsaved text recovered'); }
      }
    } catch { /* Disk saving still works if browser storage is unavailable. */ }
    richEditor?.commands.setContent(fields.content.value, { contentType: 'markdown', emitUpdate: false });
    refreshPreview(); renderRail(); updateToolbar();
  };
  const save = async (): Promise<Draft | undefined> => {
    clearTimeout(timer);
    const task = saveQueue.then(async () => {
      if (version === savedVersion && current) return current;
      if (!current && !Object.values(values()).some(Boolean)) return undefined;
      const savingVersion = version;
      const previousKey = backupKey();
      status('Saving…');
      const post = await api<Draft>('save', { ...values(), id: current?.id, revision: current?.revision });
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
    try { const result = await task; return version !== savedVersion && result ? await save() : result; } catch (value) { error(value); throw value; }
  };
  const changed = () => {
    version++; status('Unsaved changes');
    try { localStorage.setItem(backupKey(), JSON.stringify({ ...values(), revision: current?.revision })); } catch { /* Autosave remains available. */ }
    refreshPreview(); clearTimeout(timer); timer = setTimeout(() => { void save().catch(() => {}); }, 1000);
  };
  const setBusy = (value: boolean) => {
    busy = value;
    ['save-draft', 'open-preview', 'publish-post', 'unpublish-post', 'new-post', 'delete-post', 'post-selector'].forEach(id => { $<HTMLButtonElement>(id).disabled = value; });
    Object.values(fields).forEach(field => { if (field instanceof HTMLSelectElement) field.disabled = value; else field.readOnly = value; });
    richEditor?.setEditable(!value, false);
    $<HTMLButtonElement>('remove-picture').disabled = value;
    $<HTMLButtonElement>('insert-demo').disabled = value;
    document.querySelectorAll<HTMLButtonElement>('[data-format]').forEach(button => { button.disabled = value; });
    if (!value) $<HTMLButtonElement>('delete-post').disabled = !current;
  };
  Object.entries(fields).forEach(([key, field]) => field.addEventListener('input', () => {
    if (key === 'slug') slugEdited = true;
    if (key === 'title' && !slugEdited) fields.slug.value = slugify(fields.title.value);
    changed();
  }));
  $('editor-picture-preview').addEventListener('error', () => { $('editor-picture-preview').hidden = true; $('editor-picture-error').hidden = false; });
  $('editor-picture-preview').addEventListener('load', () => { $('editor-picture-preview').hidden = false; $('editor-picture-error').hidden = true; });
  $('remove-picture').addEventListener('click', () => { fields.image.value = ''; fields.imageAlt.value = ''; changed(); });
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
  $('save-draft').addEventListener('click', async () => { setBusy(true); try { await save(); toast('Draft saved.'); } catch { /* Error is visible above the editor. */ } finally { setBusy(false); } });
  $('open-preview').addEventListener('click', async () => {
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    setBusy(true);
    try { const post = await save(); if (!post) throw new Error('Write something before opening a preview.'); const href = `/blog/post?draft=${encodeURIComponent(post.id)}`; if (tab) tab.location.href = href; else { toast('Your browser blocked the preview tab. Allow pop-ups for this site, or use the Preview view below.'); } }
    catch (value) { tab?.close(); error(value); }
    finally { setBusy(false); }
  });
  $('publish-post').addEventListener('click', async () => {
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
    if (!current || !confirm('Remove this post’s GitHub file? Your draft is kept. Commit and push the removal to take it off the live site.')) return;
    setBusy(true);
    try { const post = await save(); const result = await api<Draft>('unpublish', { id: post!.id, revision: post!.revision }); drafts[drafts.findIndex(draft => draft.id === result.id)] = result; current = result; renderRail(); toast('GitHub file removed. Commit and push to unpublish.'); }
    catch (value) { error(value); } finally { setBusy(false); }
  });
  $('delete-post').addEventListener('click', async () => {
    if (!current || !confirm('Permanently delete this draft and remove its GitHub file? Live changes still require a commit and push.')) return;
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
    if (!sourceMode && richEditor) {
      const chain = richEditor.chain().focus();
      switch (button.dataset.format) {
        case 'heading': chain.toggleHeading({ level: 2 }).run(); break;
        case 'bold': chain.toggleBold().run(); break;
        case 'italic': chain.toggleItalic().run(); break;
        case 'code': chain.toggleCodeBlock().run(); break;
        case 'list': chain.toggleBulletList().run(); break;
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
    const format: Record<string, string> = { heading: `\n## ${selection || 'Heading'}\n`, bold: `**${selection || 'bold text'}**`, italic: `*${selection || 'italic text'}*`, link: `[${selection || 'link text'}](https://example.com)`, code: `\n\`\`\`python\n${selection || '# Your code here'}\n\`\`\`\n`, list: `\n- ${selection || 'List item'}\n` };
    fields.content.setRangeText(format[button.dataset.format!], start, end, 'select'); fields.content.focus(); changed();
  }));
  window.addEventListener('beforeunload', event => { if (version !== savedVersion) event.preventDefault(); });
  window.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key === 's') { event.preventDefault(); if (!busy) void save().then(() => toast('Draft saved.')).catch(() => {}); } });
  window.addEventListener('resize', refreshPreview);
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
  } catch (value) { showError('editor-error', value); setBusy(true); }
}
