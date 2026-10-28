import { Lexer, marked } from 'marked';

export const exampleDemo = {
  src: '/blog-demos/gradient-descent.html',
  title: 'Gradient descent: try the learning rate',
  height: 420,
};
export const demoFence = config => `\n\`\`\`demo\n${JSON.stringify(config, null, 2)}\n\`\`\`\n`;

export function parseDemoConfig(source) {
  let config;
  try { config = JSON.parse(source); } catch { throw new Error('The demo block needs valid JSON.'); }
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('The demo block needs a JSON object.');
  if (Object.keys(config).some(key => !['src', 'title', 'height'].includes(key))) throw new Error('Demo settings are src, title, and height.');
  if (typeof config.src !== 'string' || !/^\/blog-demos\/[a-z0-9][a-z0-9/_-]*\.html$/i.test(config.src)) throw new Error('Demo src must point to an HTML file under /blog-demos/, such as /blog-demos/gradient-descent.html.');
  if (typeof config.title !== 'string' || !config.title.trim() || config.title.length > 120) throw new Error('Give the demo a title of 1–120 characters.');
  const height = config.height ?? 420;
  if (!Number.isInteger(height) || height < 240 || height > 900) throw new Error('Demo height must be a whole number from 240 to 900.');
  return { src: config.src, title: config.title.trim(), height };
}

export function collectDemos(content) {
  const demos = [];
  marked.walkTokens(Lexer.lex(content), token => {
    if (token.type === 'code' && token.lang === 'demo') demos.push(parseDemoConfig(token.text));
  });
  return demos;
}
