import { parseDemoConfig } from '../lib/blog-demos';

/** Only explicit fenced demo blocks become embeds. Raw HTML remains sanitized. */
export function mountDemos(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('pre > code.language-demo').forEach(code => {
    const block = code.parentElement!;
    try {
      const config = parseDemoConfig(code.textContent || '');
      const figure = document.createElement('figure'); figure.className = 'blog-demo';
      const frame = document.createElement('iframe');
      frame.title = config.title; frame.height = String(config.height);
      frame.sandbox.add('allow-scripts');
      frame.loading = 'lazy'; frame.referrerPolicy = 'no-referrer';
      frame.src = config.src;
      const caption = document.createElement('figcaption'); caption.textContent = config.title;
      const link = document.createElement('a'); link.href = config.src; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open demo';
      caption.append(link); figure.append(frame, caption); block.replaceWith(figure);
    } catch (error) {
      const message = document.createElement('p'); message.className = 'demo-error'; message.setAttribute('role', 'alert');
      message.textContent = `Demo could not load. ${error instanceof Error ? error.message : 'Check the demo settings.'}`;
      block.before(message);
    }
  });
}
