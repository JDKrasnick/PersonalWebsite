import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { COMMENT_LIMITS as limits, commentError } from './comments.mjs';

export async function localComments(directory = '.local') {
  const root = resolve(directory); const filename = resolve(root, 'comments.json');
  await mkdir(root, { recursive: true });
  const keyFile = resolve(root, 'comments-secret');
  try { await writeFile(keyFile, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const secret = await readFile(keyFile, 'utf8');
  let queue = Promise.resolve();
  const load = async () => {
    try { return JSON.parse(await readFile(filename, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; return { comments: [], rates: [], reads: [] }; }
  };
  const mutate = fn => {
    const task = queue.then(async () => {
      const data = await load(); const result = fn(data);
      const temp = `${filename}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 }); await rename(temp, filename); return result;
    });
    queue = task.catch(() => {}); return task;
  };
  const store = {
    list: (postId, cursor, clientKey, now) => mutate(data => {
      data.reads = data.reads.filter(item => item.at > now - 60_000);
      if (data.reads.filter(item => item.key === clientKey).length >= 120) throw commentError(429, 'Too many comment requests. Please wait a minute.', 60);
      data.reads.push({ key: clientKey, at: now });
      const all = data.comments.filter(c => c.postId === postId).sort((a, b) => b.id.localeCompare(a.id));
      const page = all.filter(c => !cursor || c.id < cursor).slice(0, limits.pageSize + 1);
      const more = page.length > limits.pageSize; if (more) page.pop();
      return { comments: page, count: all.length, cursor: more ? page.at(-1).id : null };
    }),
    add: input => mutate(data => {
      data.rates = data.rates.filter(item => item.at > input.now - limits.dayMs);
      const personal = data.rates.filter(item => item.key === input.clientKey);
      const recent = personal.filter(item => item.at > input.now - limits.windowMs);
      if (personal.length >= limits.perDay || recent.length >= limits.perWindow) throw commentError(429, 'You have reached the comment limit. Please try again later.', personal.length >= limits.perDay ? 86_400 : 600);
      const last = personal.at(-1);
      if (last && input.now - last.at < limits.cooldownMs) throw commentError(429, 'Please wait before posting another comment.', Math.ceil((limits.cooldownMs - (input.now - last.at)) / 1000));
      if (data.rates.filter(item => item.postId === input.postId && item.at > input.now - limits.postWindowMs).length >= limits.perPostWindow) throw commentError(429, 'This discussion is receiving many comments. Please try again in a minute.', 60);
      if (data.rates.some(item => item.fingerprint === input.fingerprint)) throw commentError(409, 'That comment has already been posted.');
      data.comments.push(input.comment);
      data.rates.push({ key: input.clientKey, postId: input.postId, at: input.now, fingerprint: input.fingerprint });
    }),
    remove: (postId, id) => mutate(data => { data.comments = data.comments.filter(c => !(c.postId === postId && c.id === id)); }),
  };
  return { store, secret };
}
