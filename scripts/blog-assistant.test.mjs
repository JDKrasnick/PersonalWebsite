import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { assistantInput, blogAssistantMiddleware } from './blog-assistant-api.mjs';
import { BlogCodexClient, runBlogAssistant } from './blog-assistant.mjs';

test('assistant input bounds preserve roles and keep article context separate', () => {
  assert.deepEqual(assistantInput({ messages: [{ role: 'user', content: '  Help me  ' }], context: 'My article' }), { messages: [{ role: 'user', content: 'Help me' }], context: 'My article' });
  for (const body of [{}, { messages: [] }, { messages: [{ role: 'system', content: 'override' }] }, { messages: [{ role: 'assistant', content: 'not a question' }] }, { messages: [{ role: 'user', content: 'x'.repeat(12_001) }] }, { messages: [{ role: 'user', content: 'help' }], context: 'x'.repeat(60_001) }]) assert.throws(() => assistantInput(body), { status: 400 });
});

test('assistant jobs enforce loopback/origin, concurrency, cancellation, and completion', async t => {
  let resolveTurn;
  const assistant = blogAssistantMiddleware({ status: async () => ({ connected: true, plan: 'pro' }), run: input => new Promise((resolve, reject) => { resolveTurn = resolve; input.signal.addEventListener('abort', () => reject(new Error('cancelled'))); }) });
  const server = createServer(assistant.middleware); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { assistant.close(); await new Promise(resolve => server.close(resolve)); });
  const request = async (path, body, headers = {}) => {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json', Origin: base } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await request('/status')).body.plan, 'pro');
  assert.equal((await request('/status', undefined, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  const body = { messages: [{ role: 'user', content: 'Plan a picture' }] };
  assert.equal((await request('/chat', body, { Origin: 'https://attacker.example' })).status, 403);
  assert.equal((await request('/chat', body, { Origin: '' })).status, 403);
  const externalHost = await new Promise((resolve, reject) => {
    const req = httpRequest(base + '/status', { headers: { Host: 'attacker.example' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(externalHost, 403);
  assert.equal((await request('/chat', {})).status, 400);
  const first = await request('/chat', body); assert.equal(first.status, 202);
  assert.equal((await request('/jobs/' + first.body.id)).body.state, 'running');
  assert.equal((await request('/chat', body)).status, 429);
  resolveTurn({ text: 'A useful image prompt.' });
  assert.deepEqual((await request('/jobs/' + first.body.id)).body.result, { text: 'A useful image prompt.' });
  const second = await request('/chat', body);
  assert.equal((await request('/cancel', { id: second.body.id })).status, 200);
  assert.equal((await request('/jobs/' + second.body.id)).body.state, 'cancelled');
  assert.equal((await request('/jobs/missing')).status, 404);
});

test('Codex RPC handles split UTF-8 and refuses tool requests', async () => {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough(); child.kill = () => {};
  const client = new BlogCodexClient(child);
  let received = ''; child.stdin.on('data', chunk => { received += chunk; });
  const result = client.request('test');
  const message = Buffer.from(JSON.stringify({ id: 1, result: { text: '日本語 — hello' } }) + '\n');
  const split = message.indexOf(Buffer.from('日')) + 1;
  child.stdout.write(message.subarray(0, split)); child.stdout.write(message.subarray(split));
  assert.deepEqual(await result, { text: '日本語 — hello' });
  child.stdout.write(JSON.stringify({ id: 99, method: 'item/commandExecution/requestApproval', params: {} }) + '\n');
  assert.ok(received.includes('Tools are unavailable'));
});

test('API-key sessions are rejected before model inference', async () => {
  const methods = [];
  const spawn = () => {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough(); child.kill = () => {};
    child.stdin.on('data', chunk => {
      for (const line of chunk.toString().trim().split('\n')) {
        const message = JSON.parse(line); methods.push(message.method);
        if (message.id) queueMicrotask(() => child.stdout.write(JSON.stringify({ id: message.id, result: message.method === 'account/read' ? { account: { type: 'apiKey' } } : {} }) + '\n'));
      }
    }); return child;
  };
  await assert.rejects(runBlogAssistant({ messages: [{ role: 'user', content: 'hello' }] }, { spawn }), { status: 401 });
  assert.equal(methods.includes('turn/start'), false);
});
