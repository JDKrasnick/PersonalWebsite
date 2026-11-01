import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/lib/logo-alignment.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { textInkBottom, logoBottomOffset } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('Order.co aligns at the ink baseline; University includes the y descender', () => {
  assert.equal(textInkBottom(100, 20, 14, 4, 0), 115);
  assert.equal(textInkBottom(100, 20, 14, 4, 3), 118);
});

test('transparent pixels and contain scaling do not leave the painted logo above the text', () => {
  const target = 118, slotBottom = 124, padding = 4, scale = 0.5;
  const bottom = logoBottomOffset(slotBottom, target, padding, scale);
  assert.equal(slotBottom - bottom - padding * scale, target);
  assert.equal(bottom, 4);
});

test('a tall logo has no bottom letterbox gap when object-position is bottom', () => {
  const scale = Math.min(30 / 100, 30 / 200);
  const target = 135.25, slotBottom = 140, padding = 1;
  const bottom = logoBottomOffset(slotBottom, target, padding, scale);
  assert.equal(slotBottom - bottom - padding * scale, target);
});
