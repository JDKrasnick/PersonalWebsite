import type { ContributionDay } from '../lib/contributions';
import type { ActivityPR, DayActivity } from '../lib/github-activity';

type Point = [number, number];
const palettes: Record<string, string[]> = {
  blue: ['#202740', '#3d4f8c', '#627ac6', '#8ca1ee', '#c0cdff'],
  green: ['#1b3028', '#0e4429', '#006d32', '#26a641', '#39d353'],
  amber: ['#302a20', '#695127', '#a67a32', '#d9a44c', '#ffcf83'],
  rose: ['#302330', '#70405b', '#ab6185', '#db8bb0', '#ffc1dc'],
  teal: ['#1c3033', '#285e68', '#368d98', '#66bdc8', '#a2e7ed'],
  violet: ['#29233d', '#514278', '#8064b2', '#ab91da', '#d7c3ff'],
  black: ['#15171b', '#2b2e34', '#494e57', '#707782', '#a7afb9'],
};
const lerp = (a: number, b: number, amount: number) => a + (b - a) * amount;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

document.querySelectorAll<HTMLElement>('[data-skyline]').forEach(root => {
  const canvas = root.querySelector('canvas')!;
  const context = canvas.getContext('2d');
  const status = root.querySelector<HTMLElement>('.skyline-status')!;
  const stage = root.querySelector<HTMLElement>('.skyline-stage')!;
  const panel = root.querySelector<HTMLElement>('.day-summary')!;
  const tooltip = root.querySelector<HTMLElement>('.skyline-tooltip')!;
  const detail = root.querySelector<HTMLElement>('.skyline-detail')!;
  const help = root.querySelector<HTMLElement>('#skyline-help')!;
  const countdown = root.querySelector<HTMLElement>('[data-cycle-countdown]')!;
  const progress = root.querySelector<HTMLElement>('[data-cycle-progress]')!;
  const history = root.querySelector<HTMLElement>('[data-day-history]')!;
  const dayCache = new Map<string, DayActivity>();
  let dayRequest: AbortController | null = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!context) {
    status.textContent = 'This browser cannot display the skyline. View activity on GitHub above.';
    stage.setAttribute('aria-busy', 'false');
    return;
  }
  const ctx = context;
  let days: ContributionDay[] = [];
  let colors = palettes.blue;
  let view = '2d';
  let morph = 0;
  let transition: { from: number; to: number; start: number } | null = null;
  let rotation = -0.35, targetRotation = rotation;
  let tilt = 0.5, targetTilt = tilt;
  let velocity = 0;
  let selected = -1, pinned = -1;
  let clickedDay = -1;
  let width = 0, height = 0, frame = 0, lastTime = 0;
  let total = 0, max = 1;
  let visible = false;
  let cycleTimer: ReturnType<typeof setTimeout> | undefined;
  let cycleAnimation: Animation | null = null;
  let dragging: { startX: number; startY: number; x: number; y: number; time: number; moved: boolean } | null = null;
  let shapes: { index: number; path: Path2D; point: Point; roof: boolean }[] = [];
  const dateLabel = (day: ContributionDay, weekday = false) => new Date(`${day.date}T12:00:00Z`).toLocaleDateString(undefined, {
    ...(weekday ? { weekday: 'long' as const } : {}), month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  const description = (day: ContributionDay) => `${day.count.toLocaleString()} contribution${day.count === 1 ? '' : 's'} · ${dateLabel(day)}`;
  root.dataset.view = view;

  function schedule() {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function armCycle() {
    clearTimeout(cycleTimer);
    cycleAnimation?.cancel();
    cycleAnimation = null;
    countdown.hidden = true;
    if (days.length && visible && !document.hidden && pinned < 0 && !dragging && !reducedMotion.matches) {
      countdown.hidden = false;
      cycleAnimation = progress.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: 8000, easing: 'linear', fill: 'forwards' });
      cycleTimer = setTimeout(() => setView(view === '2d' ? '3d' : '2d'), 8000);
    }
  }
  function setView(next: string) {
    view = next;
    velocity = 0;
    root.dataset.view = view;
    const to = view === '3d' ? 1 : 0;
    transition = reducedMotion.matches ? null : { from: morph, to, start: performance.now() };
    if (reducedMotion.matches) morph = to;
    root.querySelectorAll<HTMLElement>('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    root.querySelector<HTMLButtonElement>('[data-reset]')!.disabled = view === '2d';
    help.textContent = view === '2d' ? 'Click a day to explore · Arrow keys + Enter' : 'Drag to orbit · Click a day · Arrow keys + Enter';
    schedule();
    armCycle();
  }
  function polygon(points: Point[], fill: string, alpha = 1) {
    const path = new Path2D();
    points.forEach(([x, y], index) => index ? path.lineTo(x, y) : path.moveTo(x, y));
    path.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.globalAlpha = 1;
    return path;
  }

  function draw(now: number) {
    frame = 0;
    const dt = clamp(now - (lastTime || now - 16), 1, 32);
    lastTime = now;
    if (transition) {
      const t = clamp((now - transition.start) / 1100, 0, 1);
      const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      morph = lerp(transition.from, transition.to, eased);
      if (t === 1) transition = null;
    }
    if (!dragging && !reducedMotion.matches) {
      targetRotation += velocity * dt;
      velocity *= Math.exp(-dt / 160);
      if (Math.abs(velocity) < 0.000015) velocity = 0;
    }
    const damping = reducedMotion.matches ? 1 : 1 - Math.exp(-dt / 55);
    rotation = lerp(rotation, targetRotation, damping);
    tilt = lerp(tilt, targetTilt, damping);
    if (Math.abs(rotation - targetRotation) < 0.0001) rotation = targetRotation;
    if (Math.abs(tilt - targetTilt) < 0.0001) tilt = targetTilt;
    ctx.clearRect(0, 0, width, height);
    shapes = [];
    if (!days.length || !width) return;
    const firstWeekday = new Date(`${days[0].date}T12:00:00Z`).getUTCDay();
    const columns = Math.ceil((days.length + firstWeekday) / 7);
    const cell = Math.min((width - 16) / columns, 17);
    const gap = Math.min(2.5, cell * 0.2);
    const left = (width - columns * cell) / 2;
    const gridTop = (height - cell * 7) / 2;
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    const extent = Math.abs(cos) * columns + Math.abs(sin) * 7;
    const depthExtent = Math.abs(sin) * columns + Math.abs(cos) * 7;
    const maxRise = 4 + Math.min(115, height * 0.34);
    const scale = Math.min((width - 30) / extent, (height - 32 - maxRise) / (depthExtent * tilt), 19);
    const project = (x: number, z: number, elevation = 0): Point => [
      width / 2 + (x * cos - z * sin) * scale,
      (height + maxRise) / 2 + (x * sin + z * cos) * scale * tilt - elevation,
    ];
    const ordered = days.map((day, index) => {
      const offset = index + firstWeekday;
      const column = Math.floor(offset / 7), row = offset % 7;
      const x = column - columns / 2, z = row - 3.5;
      return { day, index, column, row, x, z, depth: x * sin + z * cos };
    }).sort((a, b) => a.depth - b.depth);
    ordered.forEach(({ day, index, column, row, x, z }) => {
      const rise = day.count ? 4 + Math.sqrt(day.count / max) * (maxRise - 4) : 1;
      const grid: Point[] = [[0, 0], [cell - gap, 0], [cell - gap, cell - gap], [0, cell - gap]]
        .map(([a, b]) => [left + column * cell + a, gridTop + row * cell + b]);
      const corners: Point[] = [[x, z], [x + 0.78, z], [x + 0.78, z + 0.78], [x, z + 0.78]];
      const blend = (point: Point, index: number): Point => [lerp(grid[index][0], point[0], morph), lerp(grid[index][1], point[1], morph)];
      const base = corners.map(([a, b], index) => blend(project(a, b), index));
      const roof = corners.map(([a, b], index) => blend(project(a, b, rise), index));
      const point: Point = [roof.reduce((sum, p) => sum + p[0], 0) / 4, Math.min(...roof.map(p => p[1]))];
      const color = colors[day.level];
      if (morph > 0) {
        for (let edge = 0; edge < 4; edge++) {
          const next = (edge + 1) % 4;
          if (base[next][0] < base[edge][0]) {
            const path = polygon([base[edge], base[next], roof[next], roof[edge]], color, edge % 2 ? 0.55 : 0.75);
            shapes.push({ index, path, point, roof: false });
          }
        }
      }
      shapes.push({ index, path: polygon(roof, color), point, roof: true });
    });
    if (morph < 1) {
      ctx.globalAlpha = 1 - morph;
      ctx.fillStyle = '#a5aabd';
      ctx.font = '11px Inter, sans-serif';
      let previousMonth = '', previousX = -100;
      days.forEach((day, index) => {
        const month = day.date.slice(0, 7), column = Math.floor((index + firstWeekday) / 7);
        const x = left + column * cell;
        if (month !== previousMonth && x - previousX > 27 && column < columns - 2) {
          ctx.fillText(new Date(`${day.date}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }), x, gridTop - 12);
          previousMonth = month; previousX = x;
        }
      });
      ctx.globalAlpha = 1;
    }
    for (const index of new Set([pinned, selected])) {
      const shape = shapes.findLast(shape => shape.index === index && shape.roof);
      if (shape) {
        ctx.strokeStyle = index === pinned ? '#ffffff' : '#c0cdff';
        ctx.lineWidth = index === pinned ? 2 : 1;
        ctx.stroke(shape.path);
      }
    }
    const hover = shapes.findLast(shape => shape.index === selected && shape.roof);
    tooltip.hidden = !hover || !!dragging?.moved || panel.matches(':popover-open');
    if (hover && !tooltip.hidden) {
      tooltip.textContent = description(days[selected]);
      const half = tooltip.offsetWidth / 2 + 8;
      tooltip.style.left = `${clamp(hover.point[0], half, Math.max(half, width - half))}px`;
      tooltip.style.top = `${Math.max(45, hover.point[1] - 10)}px`;
    }
    positionPopover();
    if (transition || velocity || rotation !== targetRotation || tilt !== targetTilt) schedule();
  }

  const resize = new ResizeObserver(() => {
    const nextWidth = stage.clientWidth, nextHeight = stage.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (width !== nextWidth || height !== nextHeight || canvas.width !== Math.round(nextWidth * ratio)) {
      width = nextWidth; height = nextHeight;
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      schedule();
    }
    positionPopover();
  });
  resize.observe(stage);
  resize.observe(panel);
  function select(index: number) {
    selected = index;
    detail.textContent = days[index] ? description(days[index]) : pinned >= 0 ? description(days[pinned]) : '';
    schedule();
  }
  function hit(event: PointerEvent) {
    const bounds = canvas.getBoundingClientRect(), ratio = canvas.width / width;
    const x = (event.clientX - bounds.left) * ratio, y = (event.clientY - bounds.top) * ratio;
    return shapes.findLast(shape => ctx.isPointInPath(shape.path, x, y))?.index ?? -1;
  }
  function positionPopover() {
    if (pinned < 0 || panel.hidden || !panel.matches(':popover-open')) return;
    const shape = shapes.findLast(shape => shape.index === pinned && shape.roof);
    if (!shape) return;
    const bounds = canvas.getBoundingClientRect();
    const x = bounds.left + shape.point[0], y = bounds.top + shape.point[1];
    const viewportWidth = document.documentElement?.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (x < 0 || x > viewportWidth || y < 0 || y > viewportHeight) { closeDay(); return; }
    const box = panel.getBoundingClientRect(), edge = 12, gap = 12;
    let left: number, top: number;
    if (x + gap + box.width <= viewportWidth - edge) {
      left = x + gap; top = y - 24;
    } else if (x - gap - box.width >= edge) {
      left = x - gap - box.width; top = y - 24;
    } else {
      left = x - box.width / 2;
      top = y + gap + box.height <= viewportHeight - edge ? y + gap : y - gap - box.height;
    }
    panel.style.left = `${clamp(left, edge, Math.max(edge, viewportWidth - box.width - edge))}px`;
    panel.style.top = `${clamp(top, edge, Math.max(edge, viewportHeight - box.height - edge))}px`;
  }
  function openDay(index: number, keyboard = false) {
    if (!days[index]) return;
    pinned = index;
    armCycle();
    const day = days[index];
    panel.querySelector('[data-day-date]')!.textContent = dateLabel(day, true);
    panel.querySelector('[data-day-count]')!.textContent = day.count.toLocaleString();
    panel.querySelector('[data-day-unit]')!.textContent = day.count === 1 ? 'contribution' : 'contributions';
    panel.querySelector<HTMLAnchorElement>('[data-day-link]')!.href = `https://github.com/JDKrasnick?tab=overview&from=${day.date}&to=${day.date}`;
    panel.hidden = false;
    if (!panel.matches(':popover-open')) panel.showPopover();
    positionPopover();
    if (keyboard) panel.querySelector<HTMLButtonElement>('[data-close-summary]')!.focus({ preventScroll: true });
    tooltip.hidden = true;
    detail.textContent = description(day);
    void loadDay(day.date);
    schedule();
  }
  function closeDay(returnFocus = false) {
    dayRequest?.abort();
    panel.hidden = true; pinned = -1;
    if (panel.matches(':popover-open')) panel.hidePopover();
    armCycle();
    if (returnFocus) canvas.focus({ preventScroll: true });
    select(-1);
  }
  function text<K extends keyof HTMLElementTagNameMap>(tag: K, value: string, className = '') {
    const node = document.createElement(tag);
    node.textContent = value;
    node.className = className;
    return node;
  }
  function loadingGhost(kind: 'calendar' | 'history') {
    const wrapper = document.createElement('div');
    wrapper.append(text('span', kind === 'calendar' ? 'Loading GitHub activity…' : 'Loading activity from GitHub…', 'loading-label'));
    const ghost = document.createElement('div');
    ghost.className = `${kind}-ghost loading-ghost`;
    ghost.setAttribute('aria-hidden', 'true');
    if (kind === 'calendar') {
      for (let i = 0; i < 371; i++) ghost.append(document.createElement('span'));
      // Let the skeleton size against the stage instead of its wrapper's content.
      wrapper.style.width = '100%';
      ghost.style.marginInline = 'auto';
    } else {
      for (let i = 0; i < 2; i++) {
        const entry = document.createElement('div'); entry.className = 'ghost-pr';
        for (const size of ['short', 'full', 'medium', 'metrics']) entry.append(text('span', '', `ghost-line ghost-line-${size}`));
        ghost.append(entry);
      }
    }
    wrapper.append(ghost);
    return wrapper;
  }
  function link(label: string, url: string, className = 'activity-title') {
    const node = text('a', label, className);
    node.href = /^https:\/\/github\.com\//.test(url) ? url : 'https://github.com/JDKrasnick';
    node.target = '_blank'; node.rel = 'noopener noreferrer';
    return node;
  }
  function prEntry(pr: ActivityPR) {
    const article = document.createElement('article');
    article.className = 'activity-pr';
    article.append(text('p', `${pr.repository} #${pr.number}`, 'activity-repo'), link(pr.title, pr.url));
    const state = text('span', pr.actions.length ? pr.actions.join(' · ') : pr.state === 'MERGED' ? 'Merged' : pr.state === 'OPEN' ? 'Open' : 'Closed', 'activity-state');
    state.dataset.state = pr.state;
    article.append(state);
    const metrics = document.createElement('div'); metrics.className = 'activity-metrics';
    const metric = (value: number, noun: string) => `${value.toLocaleString()} ${noun}${value === 1 ? '' : 's'}`;
    if (pr.comments) metrics.append(text('span', metric(pr.comments, 'comment')));
    if (pr.reviews) metrics.append(text('span', metric(pr.reviews, 'review')));
    if (pr.reactions) metrics.append(text('span', metric(pr.reactions, 'reaction')));
    if (pr.files !== null) metrics.append(text('span', metric(pr.files, 'file')));
    if (pr.additions !== null) metrics.append(text('span', `+${pr.additions.toLocaleString()}`, 'activity-additions'));
    if (pr.deletions !== null) metrics.append(text('span', `−${pr.deletions.toLocaleString()}`, 'activity-deletions'));
    article.append(metrics);
    if (pr.reasons.length) article.append(text('p', pr.reasons.join(' · '), 'activity-reason'));
    return article;
  }
  function renderDay(data: DayActivity) {
    history.replaceChildren();
    const heading = (title: string) => history.append(text('h5', title, 'activity-group-title'));
    if (data.pullRequests.length) {
      heading(`Pull requests · ${data.pullRequests.length}`);
      data.pullRequests.forEach(pr => history.append(prEntry(pr)));
    }
    if (data.commits.length) {
      heading('Commits');
      data.commits.forEach(commit => {
        const entry = document.createElement('div'); entry.className = 'activity-entry';
        entry.append(link(`${commit.count} commit${commit.count === 1 ? '' : 's'}`, commit.url), text('span', commit.repository, 'activity-repo'));
        history.append(entry);
      });
    }
    if (data.reviews.length) {
      heading(`Reviews · ${data.reviews.length}`);
      data.reviews.forEach(review => {
        const entry = document.createElement('div'); entry.className = 'activity-entry';
        const state = review.state.toLowerCase().replaceAll('_', ' ');
        entry.append(link(review.title, review.url), text('span', `${review.repository} · ${state}`, 'activity-repo'));
        history.append(entry);
      });
    }
    if (data.issues.length) {
      heading('Issues opened');
      data.issues.forEach(issue => {
        const entry = document.createElement('div'); entry.className = 'activity-entry';
        entry.append(link(issue.title, issue.url), text('span', issue.repository, 'activity-repo'));
        history.append(entry);
      });
    }
    if (!data.pullRequests.length && !data.commits.length && !data.reviews.length && !data.issues.length) {
      history.append(text('p', 'GitHub has no public PR, commit, review, or issue records for this date. The profile link below may show other activity.', 'activity-message'));
    }
    if (data.limited) history.append(text('p', 'Showing the available records for this busy day. Open GitHub for the full timeline.', 'activity-message'));
  }
  async function loadDay(date: string) {
    dayRequest?.abort();
    const request = new AbortController(); dayRequest = request;
    history.setAttribute('aria-busy', 'true');
    history.replaceChildren(loadingGhost('history'));
    try {
      let data = dayCache.get(date);
      if (!data) {
        const response = await fetch(`/api/github-activity?date=${encodeURIComponent(date)}`, { signal: request.signal });
        if (!response.ok) throw new Error('GitHub unavailable');
        data = await response.json() as DayActivity;
        if (data.date !== date || !Array.isArray(data.pullRequests) || !Array.isArray(data.commits) || !Array.isArray(data.reviews) || !Array.isArray(data.issues)) throw new Error('Invalid activity');
        dayCache.set(date, data);
      }
      if (!request.signal.aborted && days[pinned]?.date === date) renderDay(data);
    } catch {
      if (request.signal.aborted || days[pinned]?.date !== date) return;
      const retry = text('button', 'Try again'); retry.type = 'button';
      retry.addEventListener('click', () => void loadDay(date), { once: true });
      history.replaceChildren(text('p', 'GitHub activity could not be loaded.', 'activity-message'), retry);
    } finally {
      if (dayRequest === request) history.setAttribute('aria-busy', 'false');
    }
  }
  root.querySelector('[data-close-summary]')!.addEventListener('click', () => closeDay(true));
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); closeDay(true); } });
  panel.addEventListener('toggle', event => {
    if ((event as ToggleEvent).newState === 'closed' && pinned >= 0 && !panel.matches(':popover-open')) closeDay();
  });
  window.addEventListener('scroll', positionPopover, { passive: true });
  window.addEventListener('resize', positionPopover);
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !days.length) return;
    clickedDay = -1;
    velocity = 0; targetRotation = rotation;
    dragging = { startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, time: event.timeStamp, moved: false };
    armCycle();
    if (view === '3d') canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (dragging) {
      const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
      const dt = Math.max(8, event.timeStamp - dragging.time);
      dragging.moved ||= Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY) > 5;
      if (dragging.moved && view === '3d') {
        targetRotation += dx * 0.006;
        targetTilt = clamp(targetTilt + dy * 0.003, 0.22, 0.85);
        velocity = reducedMotion.matches ? 0 : clamp(lerp(velocity, dx * 0.006 / dt, 0.5), -0.012, 0.012);
        selected = -1; root.dataset.dragging = 'true'; schedule();
      }
      dragging.x = event.clientX; dragging.y = event.clientY; dragging.time = event.timeStamp;
    } else if (event.pointerType !== 'touch') select(hit(event));
  });
  canvas.addEventListener('pointerup', event => {
    if (dragging && !dragging.moved) { clickedDay = hit(event); select(clickedDay); }
    if (!dragging?.moved || event.timeStamp - dragging.time > 80) velocity = 0;
    dragging = null; root.dataset.dragging = 'false';
    armCycle();
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    schedule();
  });
  canvas.addEventListener('click', () => {
    // Open after the click's native light-dismiss handling, rather than on pointerup.
    const index = clickedDay;
    clickedDay = -1;
    if (index >= 0) openDay(index);
  });
  const cancelDrag = () => { dragging = null; velocity = 0; root.dataset.dragging = 'false'; armCycle(); };
  canvas.addEventListener('pointercancel', cancelDrag);
  canvas.addEventListener('lostpointercapture', () => { if (dragging) cancelDrag(); });
  canvas.addEventListener('pointerleave', () => { if (!dragging) select(-1); });
  canvas.addEventListener('keydown', event => {
    const steps: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
    if (event.key in steps && days.length) {
      event.preventDefault();
      const current = selected < 0 ? pinned < 0 ? days.length - 1 : pinned : selected;
      select(clamp(current + steps[event.key], 0, days.length - 1));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); openDay(selected < 0 ? days.length - 1 : selected, true);
    } else if (event.key === 'Home') {
      event.preventDefault(); reset();
    } else if (event.key === 'Escape') closeDay();
  });
  function reset() {
    velocity = 0;
    targetRotation = -0.35 + Math.round((rotation + 0.35) / (2 * Math.PI)) * 2 * Math.PI;
    targetTilt = 0.5; select(-1);
  }
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => {
    button.addEventListener('click', () => { if (button.dataset.view !== view) setView(button.dataset.view!); else armCycle(); });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-palette]').forEach(button => {
    button.addEventListener('click', () => {
      colors = palettes[button.dataset.palette!];
      colors.forEach((color, index) => root.style.setProperty(`--skyline-${index}`, color));
      root.querySelectorAll('[data-palette]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      schedule();
    });
  });
  root.querySelector('[data-reset]')!.addEventListener('click', reset);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelDrag();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    } else { lastTime = 0; schedule(); armCycle(); }
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      transition = null; velocity = 0; morph = view === '3d' ? 1 : 0;
    }
    armCycle();
    schedule();
  });
  async function load() {
    status.replaceChildren(loadingGhost('calendar'));
    stage.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('/api/contributions', { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      if (!Array.isArray(data.days) || !data.days.length) throw new Error('Empty calendar');
      days = data.days;
      total = days.reduce((sum, day) => sum + day.count, 0);
      max = Math.max(1, ...days.map(day => day.count));
      let streak = 0, longest = 0;
      days.forEach(day => { streak = day.count ? streak + 1 : 0; longest = Math.max(longest, streak); });
      root.querySelector('[data-stat="total"]')!.textContent = total.toLocaleString();
      const busiest = days.reduce((best, day) => day.count > best.count || (day.count === best.count && day.date > best.date) ? day : best);
      const busiestStat = root.querySelector<HTMLElement>('[data-stat="busiest"]')!;
      busiestStat.textContent = busiest.count > 0 ? dateLabel(busiest) : '—';
      busiestStat.title = `${busiest.count.toLocaleString()} contributions`;
      root.querySelector('[data-stat="streak"]')!.textContent = `${longest} days`;
      root.querySelector<HTMLElement>('.skyline-stats')!.hidden = false;
      detail.textContent = '';
      status.hidden = true; schedule(); armCycle();
    } catch {
      status.replaceChildren(document.createTextNode('GitHub activity is temporarily unavailable.'));
      const retry = document.createElement('button');
      retry.type = 'button'; retry.textContent = 'Try again';
      retry.addEventListener('click', load, { once: true }); status.append(retry);
    } finally { stage.setAttribute('aria-busy', 'false'); }
  }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load(); }
  }, { rootMargin: '300px' });
  observer.observe(root);
  const visibility = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (!visible) {
      cancelDrag();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    } else { lastTime = 0; schedule(); armCycle(); }
  }, { threshold: 0.3 });
  visibility.observe(stage);
});
