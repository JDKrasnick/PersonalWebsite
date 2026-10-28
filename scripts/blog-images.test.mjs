import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postImage } from '../src/lib/blog-images.js';

test('optional post images normalize missing metadata for existing posts', () => {
  assert.deepEqual(postImage(), { image: '', imageAlt: '' });
  assert.deepEqual(postImage('', 'Unused description'), { image: '', imageAlt: '' });
  assert.deepEqual(postImage(' /images/experiment.png ', ' Results '), { image: '/images/experiment.png', imageAlt: 'Results' });
});

test('post images accept HTTPS and reject executable or ambiguous sources', () => {
  assert.equal(postImage('https://images.example.com/a.png?size=1200').image, 'https://images.example.com/a.png?size=1200');
  for (const source of ['javascript:alert(1)', 'data:image/png;base64,abc', '//evil.test/a', '/\\evil.test/a', '/a\n.jpg', 'https://user:secret@example.com/a', 'http://example.com/a']) assert.throws(() => postImage(source));
});
