import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { hashEditorPassword } from './blog-auth.mjs';

const directory = resolve('.local');
const filename = resolve(directory, 'blog-owner.json');
await mkdir(directory, { recursive: true, mode: 0o700 });
let credentials;
try { credentials = JSON.parse(await readFile(filename, 'utf8')); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const password = randomBytes(24).toString('base64url');
  credentials = { password, passwordHash: await hashEditorPassword(password), sessionSecret: randomBytes(48).toString('base64url') };
  await writeFile(filename, JSON.stringify(credentials, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
}
await writeFile(resolve(directory, 'blog-editor-access.txt'), `Private blog editor\nhttps://www.jdkrasnick.com/blog/editor\n\nPassword: ${credentials.password}\n\nSaving keeps posts private. The hosted editor does not publish posts.\n`, { mode: 0o600 });
console.log('Owner credentials are saved in .local/blog-owner.json and .local/blog-editor-access.txt. These files must stay private and are excluded from Git and deployment uploads.');
