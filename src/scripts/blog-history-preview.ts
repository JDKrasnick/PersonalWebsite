import { escape, renderMarkdown, type Draft } from './blog';
import { diffSequence, wordDiff } from '../lib/blog-history-diff';

type DocumentVersion = Pick<Draft, 'title' | 'excerpt' | 'content' | 'image' | 'imageAlt'>;

function highlightText(element: HTMLElement, before: string) {
  const changes: { type: string; value: string; start: number; end: number }[] = [];
  let offset = 0;
  for (const part of wordDiff(before, element.textContent || '')) {
    const end = offset + (part.type === 'removed' ? 0 : part.value.length);
    if (part.type !== 'equal') {
      const last = changes.at(-1);
      if (last && last.type === part.type && last.end === offset) { last.value += part.value; last.end = end; }
      else changes.push({ ...part, start: offset, end });
    }
    offset = end;
  }
  const position = (offset: number): [Node, number] => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (offset <= (node.textContent || '').length) return [node, offset];
      offset -= (node.textContent || '').length;
    }
    const empty = document.createTextNode(''); element.append(empty); return [empty, 0];
  };
  for (const change of changes.reverse()) {
    const range = document.createRange();
    range.setStart(...position(change.start)); range.setEnd(...position(change.end));
    const mark = document.createElement(change.type === 'added' ? 'ins' : 'del');
    mark.className = `history-${change.type}`;
    if (change.type === 'added') mark.append(range.extractContents()); else mark.textContent = change.value;
    range.insertNode(mark);
  }
}

function highlightBlocks(root: HTMLElement, previous: string) {
  const old = document.createElement('div'); old.innerHTML = renderMarkdown(previous);
  const oldBlocks = [...old.children] as HTMLElement[], nextBlocks = [...root.children] as HTMLElement[];
  const changes = diffSequence(oldBlocks.map(node => node.outerHTML), nextBlocks.map(node => node.outerHTML));
  const result = document.createDocumentFragment();
  let i = 0, j = 0;
  for (let k = 0; k < changes.length; k++) {
    const change = changes[k];
    if (change.type === 'equal') { result.append(nextBlocks[j++], '\n'); i++; continue; }
    if (change.type === 'removed' && changes[k + 1]?.type === 'added' && oldBlocks[i].tagName === nextBlocks[j].tagName && /^(P|H[1-6]|PRE)$/.test(nextBlocks[j].tagName)) {
      const next = nextBlocks[j++], prior = oldBlocks[i++];
      if (next.textContent === prior.textContent) { next.classList.add('history-format-changed'); next.setAttribute('aria-label', 'Formatting changed'); }
      else highlightText(next, prior.textContent || '');
      result.append(next, '\n'); k++; continue;
    }
    const node = change.type === 'removed' ? oldBlocks[i++] : nextBlocks[j++];
    node.classList.add(change.type === 'removed' ? 'history-removed-block' : 'history-added-block');
    result.append(node, '\n');
  }
  root.replaceChildren(result);
}

export function renderHistoryPreview(root: HTMLElement, entry: DocumentVersion, previous?: DocumentVersion) {
  root.innerHTML = `<header class="article-header"><h1>${escape(entry.title || 'Untitled post')}</h1><p class="article-description"${!entry.excerpt && !previous?.excerpt ? ' hidden' : ''}>${escape(entry.excerpt)}</p></header>${entry.image ? `<figure class="article-picture"><img src="${escape(entry.image)}" alt="${escape(entry.imageAlt || '')}" /></figure>` : ''}<div class="prose">${renderMarkdown(entry.content)}</div>`;
  if (!previous) return;
  highlightText(root.querySelector('h1')!, previous.title || 'Untitled post');
  highlightText(root.querySelector('.article-description')!, previous.excerpt);
  if (entry.image !== previous.image || entry.imageAlt !== previous.imageAlt) {
    const figure = root.querySelector('figure'); figure?.classList.add('history-added-block');
    const note = document.createElement('p'); note.className = 'history-picture-change';
    note.textContent = !entry.image ? 'Cover picture removed' : !previous.image ? 'Cover picture added' : 'Cover picture updated';
    root.querySelector('.article-header')!.after(note);
  }
  highlightBlocks(root.querySelector('.prose')!, previous.content);
}
