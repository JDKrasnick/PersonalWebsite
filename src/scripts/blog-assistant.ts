import { $, renderMarkdown, showError, toast } from './blog';

type Message = { role: 'user' | 'assistant'; content: string };
export function initBlogAssistant(context: () => string, selection: () => string) {
  const hosted = document.querySelector<HTMLElement>('[data-blog-editor]')?.dataset.hosted === 'true';
  const storageKey = hosted ? 'jd-blog-chatgpt-handoff' : 'jd-blog-assistant-chat';
  let messages: Message[] = [];
  let jobId: string | undefined;
  let connected = false, working = false;
  let polling: AbortController | undefined;
  const prompt = $<HTMLTextAreaElement>('assistant-prompt');
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    if (Array.isArray(saved.messages)) messages = saved.messages.filter((m: Message) => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-30);
    if (typeof saved.jobId === 'string') jobId = saved.jobId;
  } catch { /* An in-memory chat remains available. */ }
  const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify({ messages, jobId })); } catch { /* Chat still works when browser storage is full. */ } };
  const render = () => {
    const log = $('assistant-messages'); log.replaceChildren();
    if (!messages.length) { const p = document.createElement('p'); p.className = 'assistant-empty'; p.textContent = hosted ? 'Write your request below, then open ChatGPT. Ask for an editable image script that saves a PNG, and drop the result into your post.' : 'What would you like to work on?'; log.append(p); }
    for (const message of messages) {
      const article = document.createElement('div'); article.className = `assistant-message ${message.role}`;
      const label = document.createElement('p'); label.className = 'assistant-message-author'; label.textContent = message.role === 'user' ? 'You' : 'ChatGPT';
      const body = document.createElement('div'); body.className = 'assistant-message-body'; body.innerHTML = renderMarkdown(message.content, { media: false });
      article.append(label, body);
      body.querySelectorAll('pre').forEach(pre => {
        const code = pre.querySelector('code'); if (!code) return;
        const copyCode = document.createElement('button'); copyCode.type = 'button'; copyCode.className = 'text-button assistant-copy-code'; copyCode.textContent = 'Copy code';
        copyCode.addEventListener('click', () => { void copyText(code.textContent ?? '', code); });
        pre.after(copyCode);
      });
      if (message.role === 'assistant') {
        const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'text-button'; copy.textContent = 'Copy reply';
        copy.addEventListener('click', () => { void copyText(message.content, body); }); article.append(copy);
      }
      log.append(article);
    }
    log.scrollTop = log.scrollHeight;
  };
  const setWorking = (value: boolean) => {
    working = value;
    $<HTMLButtonElement>('assistant-send').disabled = value || !connected || Boolean(jobId);
    $('assistant-stop').hidden = !value && !jobId; $('assistant-progress').hidden = !value;
    $('assistant-messages').setAttribute('aria-busy', String(value));
  };
  async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`/api/blog/assistant/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: signal ?? AbortSignal.timeout(30_000), cache: 'no-store' });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The assistant needs the localhost development server. Restart npm run dev and reconnect.');
    const data = await response.json(); if (!response.ok) throw Object.assign(new Error(data.error || 'Could not connect to ChatGPT.'), { status: response.status }); return data;
  }
  const reconnect = async () => {
    if (hosted) {
      connected = true;
      $('assistant-connection').textContent = 'Opens in your ChatGPT window';
      $('assistant-reconnect').hidden = true;
      $('assistant-new-chat').hidden = true;
      $('assistant-send').textContent = 'Copy & open ChatGPT';
      document.querySelector<HTMLElement>('.assistant-help')!.textContent = 'Use your ChatGPT subscription for writing and editable image scripts. Your request opens in a separate window.';
      setWorking(false); return;
    }
    $('assistant-connection').textContent = 'Checking connection…';
    $<HTMLButtonElement>('assistant-reconnect').disabled = true;
    try {
      const status = await request<{ connected: boolean; plan: string | null }>('status'); connected = status.connected;
      $('assistant-connection').textContent = connected ? `Connected · ChatGPT ${status.plan ? status.plan.charAt(0).toUpperCase() + status.plan.slice(1) : 'subscription'}` : 'Run codex login, choose ChatGPT, then reconnect.';
      if (connected) $('assistant-error').hidden = true;
      if (connected && jobId && !working) void poll(jobId);
    } catch (error) { connected = false; $('assistant-connection').textContent = 'Not connected'; showError('assistant-error', error); }
    finally { $<HTMLButtonElement>('assistant-reconnect').disabled = false; setWorking(working); }
  };
  async function poll(id: string) {
    polling?.abort(); const controller = new AbortController(); polling = controller; setWorking(true);
    let terminal = false;
    try {
      while (!controller.signal.aborted) {
        const job = await request<{ state: string; error?: string; result?: { text: string } }>(`jobs/${encodeURIComponent(id)}`, undefined, AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]));
        if (controller.signal.aborted) break;
        if (job.state === 'completed') { if (job.result?.text) messages.push({ role: 'assistant', content: job.result.text }); terminal = true; break; }
        if (job.state === 'failed') { terminal = true; throw new Error(job.error || 'ChatGPT did not complete this response.'); }
        if (job.state === 'cancelled') { terminal = true; break; }
        await new Promise<void>(resolve => {
          const finish = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve(); };
          const timer = setTimeout(finish, 800); controller.signal.addEventListener('abort', finish, { once: true });
        });
      }
    } catch (error) {
      if ((error as { status?: number }).status === 404) terminal = true;
      if (!controller.signal.aborted) showError('assistant-error', terminal ? error : new Error('Connection interrupted. Reconnect to retrieve the response, or Stop to cancel it.'));
    }
    finally {
      if (polling === controller) { polling = undefined; jobId = terminal || controller.signal.aborted ? undefined : id; persist(); render(); setWorking(false); }
    }
  }
  const toggle = (open: boolean) => {
    $('blog-assistant').hidden = !open; $('editor-workspace').classList.toggle('assistant-open', open);
    $('assistant-toggle').setAttribute('aria-expanded', String(open));
    window.dispatchEvent(new Event('resize'));
    if (open) { void reconnect(); if (jobId && !working) void poll(jobId); prompt.focus(); }
    else {
      document.querySelectorAll<HTMLElement>('.editor-document, .editor-bar, .blog-header, .blog-footer').forEach(element => { element.inert = false; });
      $('assistant-toggle').focus();
    }
    dock();
  };
  let dockFrame = 0;
  function dock() {
    cancelAnimationFrame(dockFrame);
    dockFrame = requestAnimationFrame(() => {
      const panel = $('blog-assistant');
      const modal = !panel.hidden && !matchMedia('(min-width: 1101px)').matches;
      document.querySelectorAll<HTMLElement>('.editor-document, .editor-bar, .blog-header, .blog-footer').forEach(element => { element.inert = modal; });
      if (modal) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); }
      else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); }
      if (matchMedia('(min-width: 1101px)').matches) {
        const top = document.querySelector('.editor-bar')!.getBoundingClientRect().bottom;
        panel.style.top = `${top}px`; panel.style.height = `calc(100dvh - ${top}px)`;
      } else { panel.style.removeProperty('top'); panel.style.removeProperty('height'); }
    });
  }
  window.addEventListener('resize', dock);
  window.addEventListener('scroll', () => { if (!$('blog-assistant').hidden) dock(); }, { passive: true });
  $('assistant-toggle').addEventListener('click', () => toggle($('blog-assistant').hidden));
  $('assistant-image-script').addEventListener('click', () => {
    if (!prompt.value.trim()) prompt.value = 'Write a complete, reproducible Python/Pillow script that creates a simple, hand-drawn-style illustration for this post and saves a high-resolution PNG. Use minimal labels and a fixed random seed. The image should show: ';
    prompt.focus(); prompt.setSelectionRange(prompt.value.length, prompt.value.length);
  });
  $('assistant-close').addEventListener('click', () => toggle(false));
  $('assistant-reconnect').addEventListener('click', () => { void reconnect(); });
  $('blog-assistant').addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); toggle(false); }
    if (event.key === 'Tab' && $('blog-assistant').getAttribute('aria-modal') === 'true') {
      const controls = Array.from($('blog-assistant').querySelectorAll<HTMLElement>('button:not(:disabled), textarea, input, a[href]')).filter(element => element.getClientRects().length);
      if ((event.shiftKey && document.activeElement === controls[0]) || (!event.shiftKey && document.activeElement === controls.at(-1))) { event.preventDefault(); (event.shiftKey ? controls.at(-1) : controls[0])?.focus(); }
    }
  });
  $('assistant-use-selection').addEventListener('click', () => { const text = selection(); if (!text.trim()) { toast('Select a passage in your post first.'); return; } prompt.value = `${prompt.value}${prompt.value ? '\n\n' : ''}Passage:\n${text}`.slice(0, 12_000); prompt.focus(); });
  $('assistant-form').addEventListener('submit', async event => {
    event.preventDefault(); if (working || !connected || !prompt.value.trim()) return;
    if (hosted) { openChatGPT($<HTMLInputElement>('assistant-attach-post').checked ? `${prompt.value.trim()}\n\nArticle context:\n${context()}` : prompt.value.trim()); return; }
    const outgoing: Message = { role: 'user', content: prompt.value.trim() };
    $('assistant-error').hidden = true; setWorking(true);
    try {
      const { id } = await request<{ id: string }>('chat', { messages: [...messages.slice(-11), outgoing], context: $<HTMLInputElement>('assistant-attach-post').checked ? context() : '' });
      messages.push(outgoing); jobId = id;
      if (prompt.value.trim() === outgoing.content) prompt.value = '';
      persist(); render(); await poll(id);
    } catch (error) { showError('assistant-error', error); setWorking(false); }
  });
  prompt.addEventListener('keydown', event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); $<HTMLFormElement>('assistant-form').requestSubmit(); } });
  $('assistant-stop').addEventListener('click', async () => {
    const id = jobId; if (!id) return;
    try { await request('cancel', { id }); polling?.abort(); jobId = undefined; persist(); setWorking(false); } catch (error) { showError('assistant-error', error); }
  });
  $('assistant-new-chat').addEventListener('click', async () => {
    try {
      if (jobId) await request('cancel', { id: jobId });
      polling?.abort(); jobId = undefined; messages = []; prompt.value = ''; persist(); render(); setWorking(false); $('assistant-error').hidden = true; prompt.focus();
    } catch (error) { showError('assistant-error', error); }
  });
  async function copyText(text: string, source?: HTMLElement) {
    try { await navigator.clipboard.writeText(text); toast('Copied.'); }
    catch {
      if (!source && prompt.value.trim() === text) { prompt.focus(); prompt.select(); }
      else {
        const target = source ?? Array.from(document.querySelectorAll<HTMLElement>('.assistant-message.assistant .assistant-message-body')).at(-1);
        if (target) { const range = document.createRange(); range.selectNodeContents(target); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); target.scrollIntoView({ block: 'nearest' }); }
        else { const fallback = $<HTMLTextAreaElement>('assistant-manual-copy'); fallback.value = text; fallback.hidden = false; fallback.focus(); fallback.select(); }
      }
      toast('Clipboard unavailable. Press Cmd/Ctrl+C to copy the selected text.');
    }
  }
  function openChatGPT(text: string) {
    const tab = window.open('https://chatgpt.com/', 'jd-blog-image-chat', 'popup,width=720,height=900');
    if (tab) tab.opener = null;
    if (text) void copyText(text);
    else toast('Describe the image in your ChatGPT window, then drop it into your post.');
    if (!tab) { $('assistant-error').hidden = false; $('assistant-error').textContent = 'Allow popups for this site to open the image chat, or open chatgpt.com in another window.'; }
  }
  $('assistant-image-chat').addEventListener('click', () => openChatGPT(prompt.value.trim() || messages.filter(message => message.role === 'assistant').at(-1)?.content || ''));
  render(); setWorking(false);
}
