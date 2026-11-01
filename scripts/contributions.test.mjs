import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/lib/contributions.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { parseContributions } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function calendar() {
  return Array.from({ length: 365 }, (_, i) => {
    const date = new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10);
    const label = i === 5 ? '1,234 contributions' : i === 6 ? '1 contribution' : 'No contributions';
    return `<td data-level="${i === 5 ? 4 : i === 6 ? 1 : 0}" id="day-${i}" data-date="${date}"></td>` +
      `<tool-tip for="day-${i}">${label} on a date.</tool-tip>`;
  });
}

test('calendar joins counts to dates by ID and sorts weekday-ordered GitHub cells', () => {
  const input = calendar();
  const days = parseContributions(input.reverse().join(''));
  assert.equal(days.length, 365);
  assert.deepEqual(days[0], { date: '2025-01-01', count: 0, level: 0 });
  assert.deepEqual(days[5], { date: '2025-01-06', count: 1234, level: 4 });
  assert.deepEqual(days[6], { date: '2025-01-07', count: 1, level: 1 });
  assert.equal(days.at(-1).date, '2025-12-31');
});

test('upstream errors, changed markup, and duplicated dates fail instead of showing invented activity', () => {
  for (const html of ['', '<html>Rate limit exceeded</html>', calendar().slice(0, 12).join(''),
    calendar().join('').replaceAll('tool-tip', 'changed-tooltip'), [...calendar(), calendar()[0]].join('')]) {
    assert.throws(() => parseContributions(html), /incomplete contribution calendar/);
  }
});
