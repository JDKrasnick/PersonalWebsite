import type { Editor } from '@tiptap/core';
import { $, toast } from './blog';
import { documentMatches, textMatches } from '../lib/blog-editor-search';

export function initEditorFind(options: { editor: () => Editor | undefined; source: () => boolean; field: HTMLTextAreaElement; changed: () => void; busy: () => boolean }) {
  const panel = $('editor-find');
  const query = $<HTMLInputElement>('find-query');
  const replacement = $<HTMLInputElement>('find-replacement');
  const matchCase = $<HTMLInputElement>('find-case');
  const matches = (): { from: number; to: number }[] => options.source() ? textMatches(options.field.value, query.value, matchCase.checked) : options.editor() ? documentMatches(options.editor()!.state.doc, query.value, matchCase.checked) : [];
  const selection = () => options.source() ? { from: options.field.selectionStart, to: options.field.selectionEnd } : (options.editor()?.state.selection ?? { from: 0, to: 0 });
  const refresh = () => {
    if (panel.hidden) return;
    const found = matches(), selected = selection();
    const index = found.findIndex(match => match.from === selected.from && match.to === selected.to);
    $('find-count').textContent = query.value ? `${index < 0 ? found.length : `${index + 1} of ${found.length}`} match${found.length === 1 ? '' : 'es'}` : 'Search article text';
    ['find-next', 'find-previous', 'replace-all'].forEach(id => { $<HTMLButtonElement>(id).disabled = options.busy() || !found.length; });
    $<HTMLButtonElement>('replace-match').disabled = options.busy() || index < 0;
  };
  const select = (match: { from: number; to: number }) => {
    if (options.source()) { options.field.focus(); options.field.setSelectionRange(match.from, match.to); }
    else options.editor()?.chain().focus().setTextSelection(match).scrollIntoView().run();
    refresh();
  };
  const next = (back = false) => {
    const found = matches(); if (!found.length || options.busy()) return;
    const selected = selection();
    select(back ? ([...found].reverse().find(match => match.from < selected.from) ?? found[found.length - 1]) : (found.find(match => match.from >= selected.to && (match.from !== selected.from || match.to !== selected.to)) ?? found[0]));
  };
  const close = () => { panel.hidden = true; $('find-toggle').setAttribute('aria-expanded', 'false'); };
  const toggle = () => {
    if (!panel.hidden) { close(); $('find-toggle').focus(); return; }
    panel.hidden = false; $('find-toggle').setAttribute('aria-expanded', 'true');
    const selected = selection();
    const text = options.source() ? options.field.value.slice(selected.from, selected.to) : options.editor()?.state.doc.textBetween(selected.from, selected.to);
    if (text && text.length < 200 && !text.includes('\n')) query.value = text;
    refresh(); query.focus(); query.select();
  };
  const replace = (all: boolean) => {
    if (options.busy()) return;
    const selected = selection();
    const found = matches().filter(match => all || (match.from === selected.from && match.to === selected.to));
    if (!found.length) return;
    if (options.source()) {
      for (const match of [...found].reverse()) options.field.setRangeText(replacement.value, match.from, match.to, 'end');
      options.changed();
    } else {
      const editor = options.editor()!;
      const tr = editor.state.tr;
      for (const match of [...found].reverse()) tr.insertText(replacement.value, match.from, match.to);
      editor.view.dispatch(tr);
    }
    if (all) toast(`Replaced ${found.length} match${found.length === 1 ? '' : 'es'}.`);
    else next();
    refresh();
  };
  $('find-toggle').addEventListener('click', toggle);
  $('find-close').addEventListener('click', () => { close(); $('find-toggle').focus(); });
  $('find-next').addEventListener('click', () => next());
  $('find-previous').addEventListener('click', () => next(true));
  $('replace-match').addEventListener('click', () => replace(false));
  $('replace-all').addEventListener('click', () => replace(true));
  query.addEventListener('input', refresh); matchCase.addEventListener('change', refresh);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.target === query || event.target === replacement)) { event.preventDefault(); next(event.shiftKey); }
    if (event.key === 'Escape') { event.preventDefault(); close(); $('find-toggle').focus(); }
  });
  options.field.addEventListener('select', refresh);
  return { refresh, toggle, close };
}
