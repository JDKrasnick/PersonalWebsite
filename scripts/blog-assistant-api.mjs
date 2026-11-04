import { randomUUID } from 'node:crypto';
import { blogAssistantStatus, runBlogAssistant } from './blog-assistant.mjs';

const fail = (status, message) => Object.assign(new Error(message), { status });
export function assistantInput(body) {
  if (!body || !Array.isArray(body.messages) || !body.messages.length || body.messages.length > 16) throw fail(400, 'Send between 1 and 16 chat messages.');
  let length = 0;
  const messages = body.messages.map(message => {
    if (!['user', 'assistant'].includes(message?.role) || typeof message.content !== 'string' || !message.content.trim() || message.content.length > 12_000) throw fail(400, 'Keep each message under 12,000 characters.');
    length += message.content.length; return { role: message.role, content: message.content.trim() };
  });
  if (messages.at(-1).role !== 'user' || length > 60_000) throw fail(400, 'End with your question and keep the conversation under 60,000 characters.');
  if (body.context !== undefined && (typeof body.context !== 'string' || body.context.length > 60_000)) throw fail(400, 'Keep the attached post text under 60,000 characters.');
  return { messages, context: body.context ?? '' };
}

export function blogAssistantMiddleware(options = {}) {
  const jobs = new Map();
  const run = options.run ?? runBlogAssistant;
  const status = options.status ?? blogAssistantStatus;
  let statusPending;
  const close = () => { for (const job of jobs.values()) if (job.state === 'running') job.controller.abort(); };
  const middleware = async (req, res) => {
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const respond = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      const host = req.headers.host ?? '';
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) throw fail(403, 'The assistant is only available in the localhost editor.');
      if (req.headers.origin && req.headers.origin !== `http://${host}`) throw fail(403, 'Cross-origin requests are not allowed.');
      if (req.headers['sec-fetch-site'] === 'cross-site') throw fail(403, 'Use the assistant from the localhost editor.');
      const path = new URL(req.url, `http://${host}`).pathname;
      if (req.method === 'GET' && path === '/status') {
        statusPending ??= Promise.resolve().then(() => status(options)).finally(() => { statusPending = undefined; });
        return respond(200, await statusPending);
      }
      if (req.method === 'GET' && path.startsWith('/jobs/')) {
        const job = jobs.get(path.slice(6));
        if (!job) throw fail(404, 'This chat request expired or the server restarted. Send your message again.');
        return respond(200, { id: job.id, state: job.state, result: job.result, error: job.error });
      }
      if (req.method !== 'POST') throw fail(405, 'Method not allowed.');
      if (req.headers.origin !== `http://${host}`) throw fail(403, 'Use the assistant from the localhost editor.');
      if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'Send JSON content.');
      const chunks = []; let bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 250_000) throw fail(413, 'This message is too large.'); chunks.push(chunk); }
      let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail(400, 'Invalid JSON.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'Invalid request.');
      if (path === '/cancel') {
        const job = jobs.get(body.id);
        if (!job) throw fail(404, 'Chat request not found.');
        if (job.state === 'running') { job.state = 'cancelled'; job.controller.abort(); }
        return respond(200, { cancelled: true });
      }
      if (path !== '/chat') throw fail(404, 'Not found.');
      const input = assistantInput(body);
      if (Array.from(jobs.values()).some(job => job.state === 'running')) throw fail(429, 'A response is already running. Stop it or wait for it to finish.');
      for (const [id, job] of jobs) if (job.state !== 'running' && Date.now() - job.createdAt > 30 * 60_000) jobs.delete(id);
      if (jobs.size >= 20) jobs.delete(jobs.keys().next().value);
      const job = { id: randomUUID(), state: 'running', controller: new AbortController(), createdAt: Date.now() };
      jobs.set(job.id, job);
      void Promise.resolve().then(() => run({ ...input, signal: job.controller.signal }, options)).then(result => {
        if (job.state === 'running') { job.state = 'completed'; job.result = result; }
      }, error => { if (job.state === 'running') { job.state = 'failed'; job.error = error.status ? error.message : 'The ChatGPT connection failed. Reconnect and try again.'; } });
      respond(202, { id: job.id });
    } catch (error) { respond(error.status ?? 503, { error: error.status ? error.message : 'Could not connect to Codex. Make sure it is installed and signed in with ChatGPT.' }); }
  };
  return { middleware, close };
}
