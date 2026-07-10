export interface HeroHandle {
  start(): void;
  stop(): void;
  drawStaticFrame(): void;
  destroy(): void;
}

export interface HeroOpts {
  reducedMotion: boolean;
  mobile: boolean;
}

export function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function isLowPowerMobile(): boolean {
  return (
    matchMedia('(max-width: 720px)').matches ||
    (navigator.hardwareConcurrency ?? 8) <= 4 ||
    matchMedia('(pointer: coarse)').matches
  );
}

/** DPR-capped, debounced sizing driven off the canvas element's own layout box. */
export function observeCanvasResize(
  canvas: HTMLCanvasElement,
  onResize: (width: number, height: number, dpr: number) => void
): () => void {
  let frame = 0;
  const ro = new ResizeObserver((entries) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      onResize(width, height, dpr);
    });
  });
  ro.observe(canvas);
  return () => {
    cancelAnimationFrame(frame);
    ro.disconnect();
  };
}

/** Wires a HeroHandle to reduced-motion, offscreen, and tab-visibility state. Returns a cleanup fn. */
export function initHeroLifecycle(heroSection: HTMLElement, handle: HeroHandle): () => void {
  const reducedMq = matchMedia('(prefers-reduced-motion: reduce)');
  let isVisible = false;
  let isTabVisible = document.visibilityState === 'visible';

  function sync() {
    if (reducedMq.matches) {
      handle.stop();
      handle.drawStaticFrame();
      return;
    }
    if (isVisible && isTabVisible) {
      handle.start();
    } else {
      handle.stop();
    }
  }

  const io = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (!entry) return;
      isVisible = entry.isIntersecting;
      sync();
    },
    { threshold: 0.05 }
  );
  io.observe(heroSection);

  function onVisibilityChange() {
    isTabVisible = document.visibilityState === 'visible';
    sync();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  function onReducedMotionChange() {
    sync();
  }
  reducedMq.addEventListener('change', onReducedMotionChange);

  sync();

  return () => {
    io.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    reducedMq.removeEventListener('change', onReducedMotionChange);
  };
}
