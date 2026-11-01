import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/scripts/contribution-skyline.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText.replace(/export \{\};?/, '');
const days = Array.from({ length: 365 }, (_, index) => ({
  date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
  count: index % 8, level: Math.min(4, index % 8),
}));

// Exercise the shipped event handlers and animation frames without a browser.
// Real-browser appearance and native pointer feel still require manual QA.
async function setup({ width = 1000, height = 330, reduce = false, fetchDay = async date => ({ date, pullRequests: [], commits: [], reviews: [], issues: [], limited: false }) } = {}) {
  let now = 0, nextId = 1, paths = [], resize;
  const frames = new Map(), timers = new Map(), observers = [];
  function element() {
    const handlers = new Map();
    return {
      dataset: {}, hidden: false, textContent: '', offsetWidth: 220,
      style: { values: {}, setProperty(name, value) { this.values[name] = value; } }, attrs: {}, children: [], focused: false,
      setAttribute(key, value) { this.attrs[key] = value; },
      replaceChildren(...items) { this.children = items; }, append(...items) { this.children.push(...items); },
      addEventListener(key, handler) { handlers.set(key, [...(handlers.get(key) ?? []), handler]); },
      fire(key, event = {}) { for (const handler of handlers.get(key) ?? []) handler({ timeStamp: now, preventDefault() {}, ...event }); },
      focus() { this.focused = true; },
      animate(keyframes, options) {
        const animation = { keyframes, options, cancelled: false, cancel() { this.cancelled = true; } };
        this.animation = animation;
        return animation;
      },
    };
  }
  const ctx = {
    clearRect() { paths = []; }, fill(path) { paths.push(path); }, stroke() {}, fillText() {}, setTransform() {},
    isPointInPath(path, px, py) {
      const x = px / 2, y = py / 2;
      let inside = false;
      for (let i = 0, j = path.points.length - 1; i < path.points.length; j = i++) {
        const [xi, yi] = path.points[i], [xj, yj] = path.points[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    },
  };
  const canvas = Object.assign(element(), {
    getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0 }),
    setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {},
  });
  const stage = Object.assign(element(), { clientWidth: width, clientHeight: height });
  const views = ['2d', '3d'].map(view => Object.assign(element(), { dataset: { view } }));
  const palettes = ['blue', 'green', 'amber', 'rose', 'teal', 'violet', 'black'].map(palette => Object.assign(element(), { dataset: { palette } }));
  const keys = ['.skyline-status', '.skyline-tooltip', '.skyline-detail', '#skyline-help', '.day-summary', '.skyline-workspace', '[data-reset]', '[data-close-summary]', '.skyline-stats', '[data-stat="total"]', '[data-stat="busiest"]', '[data-stat="streak"]', '[data-day-date]', '[data-day-count]', '[data-day-unit]', '[data-day-link]', '[data-day-history]', '[data-featured]', '[data-featured-list]', '[data-cycle-countdown]', '[data-cycle-progress]'];
  const nodes = new Map(keys.map(key => [key, element()]));
  nodes.set('canvas', canvas); nodes.set('.skyline-stage', stage);
  const panel = nodes.get('.day-summary'); panel.hidden = true;
  panel.popoverOpen = false;
  panel.matches = () => panel.popoverOpen;
  panel.showPopover = () => { panel.popoverOpen = true; panel.fire('toggle', { newState: 'open' }); };
  panel.hidePopover = () => { panel.popoverOpen = false; panel.fire('toggle', { newState: 'closed' }); };
  panel.getBoundingClientRect = () => ({ width: 360, height: 380 });
  panel.querySelector = key => nodes.get(key);
  nodes.get('.skyline-workspace').classList = {
    add() { if (width > 640) { stage.clientWidth = width - 256; resize(); } },
    remove() { stage.clientWidth = width; resize(); },
  };
  const root = Object.assign(element(), {
    querySelector: key => nodes.get(key),
    querySelectorAll: key => key === '[data-view]' ? views : palettes,
  });
  const document = Object.assign(element(), { hidden: false, querySelectorAll: () => [root], createTextNode: x => x, createElement: element });
  const media = Object.assign(element(), { matches: reduce });
  const sandbox = {
    console, AbortSignal, AbortController, performance: { now: () => now }, document,
    window: Object.assign(element(), { devicePixelRatio: 2, innerWidth: 1280, innerHeight: 800, matchMedia: () => media }),
    Path2D: class { points = []; moveTo(x, y) { this.points.push([x, y]); } lineTo(x, y) { this.points.push([x, y]); } closePath() {} },
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() { resize(); } },
    IntersectionObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() {} },
    requestAnimationFrame(fn) { const id = nextId++; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(fn, delay) { const id = nextId++; timers.set(id, { fn, due: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async url => {
      if (url === '/api/contributions') return { ok: true, json: async () => ({ days }) };
      const date = new URL(url, 'https://example.test').searchParams.get('date');
      return { ok: true, json: async () => date ? await fetchDay(date) : { pullRequests: [] } };
    },
  };
  vm.runInNewContext(source, sandbox);
  observers.forEach(observer => observer.fn([{ isIntersecting: true }]));
  await new Promise(resolve => setImmediate(resolve));
  function advance(ms) {
    for (let elapsed = 0; elapsed < ms; elapsed += 16) {
      now += 16;
      for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.fn(); }
      const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now));
    }
  }
  function bounds() {
    assert.ok(paths.length >= days.length);
    for (const path of paths) for (const [x, y] of path.points) {
      assert.ok(Number.isFinite(x) && x >= 0 && x <= stage.clientWidth && y >= 0 && y <= height, `Clipped vertex ${x},${y}`);
    }
  }
  return { root, canvas, stage, nodes, panel, views, palettes, document, media, observers, frames, advance, bounds,
    paths: () => paths,
    clickPath(index = 100) {
      const path = paths[index];
      const clientX = path.points.reduce((sum, point) => sum + point[0], 0) / path.points.length;
      const clientY = path.points.reduce((sum, point) => sum + point[1], 0) / path.points.length;
      canvas.fire('pointerdown', { clientX, clientY, button: 0, pointerId: 1 });
      canvas.fire('pointerup', { clientX, clientY, pointerId: 1 });
      canvas.fire('click', { clientX, clientY });
    },
  };
}

test('starts as grid, morphs the same cells, reverses, and stops requesting idle frames', async () => {
  const app = await setup(); app.advance(32);
  assert.equal(app.root.dataset.view, '2d');
  assert.equal(app.paths().length, days.length);
  app.advance(3000); assert.equal(app.root.dataset.view, '2d', 'Grid remains visible before the first eight-second cycle');
  app.views[1].fire('click');
  app.advance(1500); app.bounds();
  assert.equal(app.root.dataset.view, '3d');
  assert.ok(app.paths().length > days.length);
  app.advance(2500); assert.equal(app.frames.size, 0);
  app.views[0].fire('click'); app.advance(1400);
  assert.equal(app.paths().length, days.length);
  app.bounds(); assert.equal(app.frames.size, 0);
});

test('click pins exact day data; hover and palettes preserve it; close returns focus', async () => {
  const app = await setup(); app.advance(32); app.clickPath(); app.advance(32);
  assert.equal(app.panel.hidden, false);
  const link = app.nodes.get('[data-day-link]').href;
  const date = new URL(link).searchParams.get('from');
  const day = days.find(day => day.date === date);
  assert.equal(app.nodes.get('[data-day-count]').textContent, String(day.count));
  assert.equal(new URL(link).searchParams.get('to'), date);
  app.canvas.fire('pointerleave'); app.palettes[1].fire('click'); app.advance(32);
  assert.equal(app.panel.hidden, false); assert.equal(app.nodes.get('[data-day-link]').href, link);
  app.bounds(); app.nodes.get('[data-close-summary]').fire('click'); app.advance(32);
  assert.equal(app.panel.hidden, true); assert.equal(app.canvas.focused, true);
  app.advance(3000); assert.equal(app.root.dataset.view, '2d', 'Clicking a day does not change the view');
});

test('keyboard Enter opens a summary and Escape dismisses it', async () => {
  const app = await setup(); app.advance(32);
  app.canvas.fire('keydown', { key: 'ArrowLeft' }); app.canvas.fire('keydown', { key: 'Enter' }); app.advance(32);
  assert.equal(app.panel.hidden, false);
  assert.ok(app.nodes.get('[data-day-date]').textContent);
  app.panel.fire('keydown', { key: 'Escape' });
  assert.equal(app.panel.hidden, true); assert.equal(app.canvas.focused, true);
});

test('anchored popover preserves skyline geometry and light-dismiss does not steal focus', async () => {
  const app = await setup(); app.advance(32);
  const geometry = JSON.stringify(app.paths().map(path => path.points));
  const size = [app.stage.clientWidth, app.stage.clientHeight, app.canvas.width, app.canvas.height];
  app.clickPath(); app.advance(32);
  assert.equal(app.panel.popoverOpen, true);
  assert.deepEqual([app.stage.clientWidth, app.stage.clientHeight, app.canvas.width, app.canvas.height], size);
  assert.equal(JSON.stringify(app.paths().map(path => path.points)), geometry);
  assert.ok(parseFloat(app.panel.style.left) >= 12);
  assert.ok(parseFloat(app.panel.style.left) + 360 <= 1280 - 12);
  app.panel.hidePopover(); // The native auto popover emits toggle on an outside click.
  assert.equal(app.panel.popoverOpen, false);
  assert.equal(app.panel.hidden, true);
  assert.equal(app.canvas.focused, false);
});

test('opens after the completed click and ignores a stale closed toggle for a currently open popover', async () => {
  const app = await setup(); app.advance(32);
  const path = app.paths()[100];
  const clientX = path.points.reduce((sum, point) => sum + point[0], 0) / path.points.length;
  const clientY = path.points.reduce((sum, point) => sum + point[1], 0) / path.points.length;
  app.canvas.fire('pointerdown', { clientX, clientY, button: 0, pointerId: 1 });
  app.canvas.fire('pointerup', { clientX, clientY, pointerId: 1 });
  assert.equal(app.panel.hidden, true, 'Opening on pointerup would immediately light-dismiss on the same click');
  app.canvas.fire('click', { clientX, clientY });
  assert.equal(app.panel.popoverOpen, true);
  app.panel.fire('toggle', { newState: 'closed' });
  assert.equal(app.panel.hidden, false);
  assert.equal(app.panel.popoverOpen, true);
});

test('black palette preserves cell geometry, busiest day is an actual date, and the date-range caption is gone', async () => {
  const app = await setup(); app.advance(32);
  const geometry = JSON.stringify(app.paths().map(path => path.points));
  const black = app.palettes.find(button => button.dataset.palette === 'black');
  black.fire('click'); app.advance(32);
  assert.equal(black.attrs['aria-pressed'], 'true');
  assert.equal(app.root.style.values['--skyline-0'], '#15171b');
  assert.equal(app.root.style.values['--skyline-4'], '#a7afb9');
  assert.equal(JSON.stringify(app.paths().map(path => path.points)), geometry);
  const expected = new Date('2025-12-26T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  assert.equal(app.nodes.get('[data-stat="busiest"]').textContent, expected);
  assert.equal(app.nodes.get('[data-stat="busiest"]').title, '7 contributions');
  assert.equal(app.nodes.get('.skyline-detail').textContent, '');
});

test('orbit has damping and inertia, never opens a summary on drag, and stays in bounds', async () => {
  for (const [width, height] of [[1000, 330], [326, 260]]) {
    const app = await setup({ width, height }); app.views[1].fire('click'); app.advance(2800);
    for (const [dx, dy] of [[300, -200], [-700, 400], [1100, -400]]) {
      app.canvas.fire('pointerdown', { clientX: 20, clientY: 20, button: 0, pointerId: 1 });
      app.advance(16); app.canvas.fire('pointermove', { clientX: dx, clientY: dy });
      app.advance(16); app.bounds();
      const before = JSON.stringify(app.paths()[0].points);
      app.canvas.fire('pointerup', { clientX: dx, clientY: dy, pointerId: 1 });
      app.canvas.fire('click', { clientX: dx, clientY: dy });
      app.advance(64); assert.notEqual(JSON.stringify(app.paths()[0].points), before);
      app.advance(2400); app.bounds(); assert.equal(app.frames.size, 0);
      assert.equal(app.panel.hidden, true);
    }
  }
});

test('reduced motion keeps the grid until chosen and skips spatial animation and inertia', async () => {
  const app = await setup({ reduce: true }); app.advance(3000);
  assert.equal(app.root.dataset.view, '2d');
  app.views[1].fire('click'); app.advance(16);
  assert.ok(app.paths().length > days.length); assert.equal(app.frames.size, 0); app.bounds();
});

test('hiding the tab or scrolling away cancels scheduled animation', async () => {
  const app = await setup(); app.views[1].fire('click'); app.advance(400);
  app.document.hidden = true; app.document.fire('visibilitychange');
  assert.equal(app.frames.size, 0);
  app.document.hidden = false; app.document.fire('visibilitychange'); app.advance(1600);
  app.observers[1].fn([{ isIntersecting: false }]); assert.equal(app.frames.size, 0);
});

test('views alternate every eight seconds, pause for a pinned day, and resume after closing', async () => {
  const app = await setup(); app.advance(32);
  const progress = app.nodes.get('[data-cycle-progress]');
  const firstAnimation = progress.animation;
  assert.equal(firstAnimation.options.duration, 8000);
  assert.equal(firstAnimation.keyframes[1].transform, 'scaleX(0)');
  assert.equal(app.nodes.get('[data-cycle-countdown]').hidden, false);
  app.advance(7952); assert.equal(app.root.dataset.view, '2d');
  app.advance(32); assert.equal(app.root.dataset.view, '3d');
  assert.equal(firstAnimation.cancelled, true);
  assert.notEqual(progress.animation, firstAnimation);
  app.advance(8000); assert.equal(app.root.dataset.view, '2d');
  app.advance(1200); app.clickPath(); app.advance(12000);
  assert.equal(app.panel.hidden, false); assert.equal(app.root.dataset.view, '2d');
  assert.equal(app.nodes.get('[data-cycle-countdown]').hidden, true);
  app.nodes.get('[data-close-summary]').fire('click');
  assert.equal(app.nodes.get('[data-cycle-countdown]').hidden, false);
  app.advance(7984); assert.equal(app.root.dataset.view, '2d');
  app.advance(32); assert.equal(app.root.dataset.view, '3d');
});

test('automatic cycling stays paused offscreen, in a hidden tab, and for reduced motion', async () => {
  const app = await setup(); app.advance(32);
  app.observers[1].fn([{ isIntersecting: false }]); app.advance(12000);
  assert.equal(app.root.dataset.view, '2d');
  app.observers[1].fn([{ isIntersecting: true }]);
  app.document.hidden = true; app.document.fire('visibilitychange'); app.advance(12000);
  assert.equal(app.root.dataset.view, '2d');
  app.document.hidden = false; app.document.fire('visibilitychange'); app.advance(8016);
  assert.equal(app.root.dataset.view, '3d');
  const reduced = await setup({ reduce: true }); reduced.advance(15000);
  assert.equal(reduced.root.dataset.view, '2d');
});

const historyText = node => [node.textContent ?? '', ...(node.children ?? []).map(child => typeof child === 'string' ? child : historyText(child))].join(' ');
const dayResponse = (date, title) => ({ date, limited: false, reviews: [], issues: [],
  pullRequests: [{ title, url: 'https://github.com/example/project/pull/42', repository: 'example/project', number: 42, state: 'MERGED', date, actions: ['Merged by JD'], comments: 6, reviews: 2, reactions: 3, files: 5, additions: 123, deletions: 9, reasons: ['6 comments'] }],
  commits: [{ repository: 'example/project', count: 2, url: 'https://github.com/example/project/commits' }],
});

test('day panel renders fetched PRs, merge actions, discussion and diff data as text and caches repeat reads', async () => {
  let calls = 0;
  const app = await setup({ fetchDay: async date => { calls++; return dayResponse(date, '<img src=x onerror=alert(1)>'); } });
  app.advance(32); app.canvas.fire('keydown', { key: 'ArrowLeft' }); app.canvas.fire('keydown', { key: 'Enter' });
  await new Promise(resolve => setImmediate(resolve));
  const visible = historyText(app.nodes.get('[data-day-history]'));
  for (const expected of ['<img src=x onerror=alert(1)>', 'Merged by JD', '6 comments', '3 reactions', '+123', '−9', '2 commits']) assert.ok(visible.includes(expected), expected);
  app.canvas.fire('keydown', { key: 'Enter' }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
});

test('a slow response for the previous day cannot replace the selected day history', async () => {
  const pending = new Map();
  const app = await setup({ fetchDay: date => new Promise(resolve => pending.set(date, resolve)) });
  app.advance(32); app.canvas.fire('keydown', { key: 'ArrowLeft' }); app.canvas.fire('keydown', { key: 'Enter' });
  await new Promise(resolve => setImmediate(resolve));
  const first = [...pending.keys()][0];
  app.canvas.fire('keydown', { key: 'ArrowLeft' }); app.canvas.fire('keydown', { key: 'Enter' });
  await new Promise(resolve => setImmediate(resolve));
  const second = [...pending.keys()][1];
  pending.get(second)(dayResponse(second, 'Latest selected day')); await new Promise(resolve => setImmediate(resolve));
  pending.get(first)(dayResponse(first, 'Stale previous day')); await new Promise(resolve => setImmediate(resolve));
  const visible = historyText(app.nodes.get('[data-day-history]'));
  assert.ok(visible.includes('Latest selected day')); assert.ok(!visible.includes('Stale previous day'));
});
