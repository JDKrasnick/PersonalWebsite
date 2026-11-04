import { $, api, escape, toast, type Draft } from './blog';
import { renderHistoryPreview } from './blog-history-preview';

type Version = Pick<Draft, 'title' | 'slug' | 'excerpt' | 'content' | 'tags' | 'image' | 'imageAlt' | 'icon' | 'revision'> & { id: string; savedAt: string; archivedAt?: string };
const timestamp = (entry: Version) => new Date(entry.savedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });

export function initVersionHistory(options: {
  save: () => Promise<Draft | undefined>;
  restored: (post: Draft) => void;
  locked: () => boolean;
  setBusy: (value: boolean) => void;
  opening: () => void;
}) {
  const panel = $('version-history'), list = $('history-selection');
  const restore = $<HTMLButtonElement>('restore-history');
  let entries: Version[] = [], selectedId = '', working = false;
  let editorScroll = 0;
  const preview = () => {
    const index = entries.findIndex(item => item.id === selectedId);
    const entry = entries[index], previous = entries[index + 1];
    const showChanges = $<HTMLInputElement>('history-show-changes').checked;
    restore.disabled = !entry || working;
    list.querySelectorAll<HTMLButtonElement>('[data-version]').forEach(button => {
      const selected = button.dataset.version === selectedId;
      button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
    });
    $('history-selected-date').textContent = entry ? `${timestamp(entry)} · Version ${entry.revision}` : '';
    $('history-comparison').textContent = !entry ? 'Select a version to review.' : !previous ? 'First saved version' : showChanges ? `Changes since ${timestamp(previous)} · Version ${previous.revision}` : 'Viewing saved version · Changes hidden';
    document.querySelector<HTMLElement>('.history-legend')!.hidden = !showChanges || !previous;
    if (entry) renderHistoryPreview($('history-preview'), entry, showChanges ? previous : undefined);
    else $('history-preview').innerHTML = '<p class="history-empty">No saved versions yet. Write something to start version history.</p>';
  };
  const render = (history: Version[]) => {
    entries = [...history].reverse(); selectedId = entries[0]?.id || '';
    list.innerHTML = entries.map((entry, index) => `<button type="button" role="option" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-version="${escape(entry.id)}" class="history-version"><time datetime="${escape(entry.savedAt)}">${escape(timestamp(entry))}</time><span>Version ${entry.revision}${index === 0 ? ' · Latest saved' : ''}${entry.archivedAt ? ' · Archived' : ''}</span></button>`).join('');
    $('history-status').textContent = `${entries.length} saved ${entries.length === 1 ? 'version' : 'versions'}`;
    preview();
  };
  const run = async (action: (post: Draft) => Promise<void>) => {
    if (working || options.locked()) return;
    working = true; options.setBusy(true);
    panel.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach(control => { control.disabled = true; });
    try {
      const post = await options.save();
      if (!post) { $('history-status').textContent = 'Write something to start version history.'; return; }
      await action(post);
    } catch (error) { $('history-status').textContent = error instanceof Error ? error.message : 'Could not load history. Try again.'; }
    finally {
      working = false; options.setBusy(false);
      panel.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach(control => { control.disabled = false; });
      restore.disabled = !entries.length;
      $<HTMLButtonElement>('archive-history').disabled = !entries.some(entry => !entry.archivedAt);
      $<HTMLButtonElement>('delete-archived-history').disabled = !entries.some(entry => entry.archivedAt);
    }
  };
  const close = () => {
    if (working) return;
    panel.hidden = true; $('open-history').setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: editorScroll, behavior: 'instant' }); $('open-history').focus({ preventScroll: true });
  };
  $('open-history').addEventListener('click', () => {
    if (working || options.locked()) return;
    editorScroll = window.scrollY; options.opening();
    panel.hidden = false; $('open-history').setAttribute('aria-expanded', 'true');
    render([]); $('history-status').textContent = 'Loading saved versions…';
    window.scrollTo({ top: 0, behavior: 'instant' });
    void run(async post => { render(await api<Version[]>(`history?id=${encodeURIComponent(post.id)}`)); list.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true }); });
  });
  $('close-history').addEventListener('click', close);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(); } });
  list.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-version]');
    if (!button || working) return;
    selectedId = button.dataset.version!; preview();
  });
  list.addEventListener('keydown', event => {
    if (working || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = entries.findIndex(entry => entry.id === selectedId);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : Math.max(0, Math.min(entries.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    if (!entries[next]) return;
    selectedId = entries[next].id; preview(); list.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  });
  $('history-show-changes').addEventListener('change', preview);
  restore.addEventListener('click', () => {
    const entry = entries.find(item => item.id === selectedId); if (!entry) return;
    void run(async post => {
      const restored = await api<Draft>('restore-history', { id: post.id, revision: post.revision, versionId: entry.id });
      options.restored(restored); panel.hidden = false; $('open-history').setAttribute('aria-expanded', 'true');
      render(await api<Version[]>(`history?id=${encodeURIComponent(post.id)}`));
      toast('Version restored. Your previous text is kept in history.');
    });
  });
  for (const action of ['archive-history', 'delete-archived-history']) $(action).addEventListener('click', () => {
    if (action === 'delete-archived-history' && !confirm('Permanently delete all archived versions of this post? Your current draft and active versions will be kept.')) return;
    void run(async post => { render(await api<Version[]>(action, { id: post.id, revision: post.revision })); toast(action === 'archive-history' ? 'History archived on this computer.' : 'Archived versions deleted.'); });
  });
}
