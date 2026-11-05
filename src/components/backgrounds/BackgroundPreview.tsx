import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { backgrounds, type BackgroundVariant } from '../../lib/backgrounds';
import './background-preview.css';

const AeroShards = lazy(() => import('./react-bits/AeroShards'));
const PatternWaves = lazy(() => import('./react-bits/PatternWaves'));
const GradientASCII = lazy(() => import('./react-bits/GradientASCII'));
const GhostFibers = lazy(() => import('./react-bits/GhostFibers'));
const PixelBlast = lazy(() => import('./react-bits/PixelBlast'));
const Particles = lazy(() => import('./react-bits/Particles'));

class EffectBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Scene({ variant, paused, mobile, onError }: {
  variant: BackgroundVariant; paused: boolean; mobile: boolean; onError: () => void;
}) {
  const dpr = mobile ? 1 : 1.25;
  switch (variant) {
    case 'aero-shards':
      return <AeroShards shardColor="#8ba5ff" accentColor="#b7a1ff" count={mobile ? 350 : 650}
        speed={0.22} shardSize={0.85} placement="full" glow={0.08} grain={0} markers="none"
        intro={false} dpr={dpr} paused={paused} mouseInteraction={!paused} mouseStrength={0.15} pulseOnClick={false}
        holdToGather={false} onError={onError} />;
    case 'pattern-waves':
      return <PatternWaves preset="silk" color="#849bff" backgroundColor="transparent"
        spacing={10} speed={0.12} fade="none" intro={false} paused={paused} interactive={false} />;
    case 'gradient-ascii':
      return <GradientASCII colors={['#233c91', '#809bff', '#b1a5e5', '#487ca8']}
        shape="horizon" cellSize={mobile ? 16 : 19} gradientOpacity={0.12} glyphOpacity={0.65}
        density={0.5} glow={0.03} grain={0} speed={paused ? 0 : 0.16} flicker={0}
        mouseInteraction={false} clickEffect="none" intro={false} dpr={dpr} paused={paused} />;
    case 'ghost-fibers':
      return <GhostFibers glowColor="#7c91ff" lineColor="#a9beff" secondaryColor="#b5a4e6"
        speed={0.14} threads={80} layers={1} grain={0} glow={0.3} brightness={1.1}
        spread={1.25} twist={0.75} waves={0.7} foldGlow={0.55} sparkle={0.15} particles={0}
        intro={false} paused={paused} mouseInteraction={!paused} mouseStrength={0.25} pulseOnClick={false} dpr={0.75} maxFps={30} />;
    case 'pixel-blast':
      return <PixelBlast color="#829cff" accentColor="#bba7ed" pixelSize={mobile ? 3 : 3.5}
        patternScale={2.5} patternDensity={0.65} speed={paused ? 0 : 0.14} drift={paused ? 0 : 0.06}
        twinkle={paused ? 0 : 0.04} glow={0.03} edgeFade={0.35} intro={false} noiseAmount={0}
        hoverEffect="none" enableRipples={false} dpr={dpr} />;
    case 'particles':
      return <Particles particleColors={['#8da9ff', '#b9b0e5', '#d1dcff']}
        particleCount={mobile ? 120 : 220} particleSpread={10} particleBaseSize={75} speed={0}
        alphaParticles glow={0.15} twinkle={0} moveParticlesOnHover={false} clickBurst={false}
        disableRotation scrollDisturbance
        intro={false} paused={paused} pixelRatio={dpr} />;
  }
}

export default function BackgroundPreview({ variant, showControls = true }: {
  variant: BackgroundVariant; showControls?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [motionOverride, setMotionOverride] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState(false);
  const [error, setError] = useState(false);
  const [coveredByHero, setCoveredByHero] = useState(true);
  const paused = motionOverride ?? reducedMotion;
  const current = backgrounds.find((item) => item.slug === variant)!;

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>('#hero');
    if (!hero) { setCoveredByHero(false); return; }
    let revealStart = 0;
    const syncCoverage = () => setCoveredByHero(window.scrollY + window.innerHeight <= revealStart + 1);
    const measureCoverage = () => {
      const heroEnd = hero.getBoundingClientRect().bottom + window.scrollY;
      const trackStart = (track.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
      // Keep the full hero clear; share only a narrow blend at its bottom edge.
      revealStart = heroEnd - 40;
      track.current?.style.setProperty('--background-reveal-start', `${revealStart - trackStart}px`);
      track.current?.style.setProperty('--background-reveal-end', `${heroEnd + 40 - trackStart}px`);
      syncCoverage();
    };
    // The background mask hides the scene until the very end of the hero.
    // Keep one static frame there instead of running two full-screen animations.
    const observer = new ResizeObserver(measureCoverage);
    observer.observe(hero);
    window.addEventListener('scroll', syncCoverage, { passive: true });
    window.addEventListener('resize', measureCoverage);
    measureCoverage();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', syncCoverage);
      window.removeEventListener('resize', measureCoverage);
    };
  }, []);

  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const narrow = matchMedia('(max-width: 700px)');
    const syncMedia = () => { setReducedMotion(motion.matches); setMobile(narrow.matches); };
    const syncHidden = () => setHidden(document.hidden);
    syncMedia();
    syncHidden();
    motion.addEventListener('change', syncMedia);
    narrow.addEventListener('change', syncMedia);
    document.addEventListener('visibilitychange', syncHidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        const active = entry.isIntersecting && entry.intersectionRect.height > 0;
        setVisible(active);
        if (active) setInitialized(true);
      },
      { threshold: [0, 0.001] },
    );
    if (track.current) observer.observe(track.current);
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', syncMedia);
      narrow.removeEventListener('change', syncMedia);
      document.removeEventListener('visibilitychange', syncHidden);
    };
  }, []);

  // Keep the same place in the portfolio when comparing another variation.
  const rememberPosition = () => {
    try { sessionStorage.setItem('background-preview-scroll', JSON.stringify({ y: scrollY, at: Date.now() })); }
    catch { /* Navigation still works if storage is disabled. */ }
  };
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('background-preview-scroll');
      sessionStorage.removeItem('background-preview-scroll');
      if (!saved) return;
      const { y, at } = JSON.parse(saved);
      if (typeof y === 'number' && Date.now() - at < 15_000) scrollTo({ top: y, behavior: 'instant' });
    } catch { /* Use the route's ordinary scroll position. */ }
  }, []);

  return <>
    <div ref={track} className={`background-track background-track--${variant}`} aria-hidden="true">
      <div className="background-sticky">
        <div className="background-effect" data-background={variant} data-paused={paused} data-covered-by-hero={coveredByHero}>
          {!error && ((visible && !hidden) || (variant === 'ghost-fibers' && initialized)) && <EffectBoundary onError={() => setError(true)}>
            <Suspense fallback={null}>
              <Scene variant={variant} paused={paused || coveredByHero || !visible || hidden} mobile={mobile} onError={() => setError(true)} />
            </Suspense>
          </EffectBoundary>}
        </div>
        <div className="background-shade" />
      </div>
    </div>

    {showControls && <nav className="background-switcher" aria-label="Background variations">
      {error && <p className="background-error" role="status">
        {variant === 'aero-shards' ? 'Aero Shards needs WebGPU in this browser.' : 'This background could not start.'} Choose another below.
      </p>}
      <div className="background-switcher-row">
        <span className="background-switcher-label">Background</span>
        <div className="background-options">
          {backgrounds.map(({ slug, name }, index) => <a key={slug}
            href={`/backgrounds/${slug}/#about`} aria-current={slug === variant ? 'page' : undefined}
            onClick={rememberPosition}>
            <span className="background-option-number">{index + 1}</span>{name}
          </a>)}
        </div>
        <select className="background-select" aria-label="Choose background" value={variant}
          onChange={(event) => { rememberPosition(); location.assign(`/backgrounds/${event.target.value}/#about`); }}>
          {backgrounds.map(({ slug, name }, index) => <option key={slug} value={slug}>{index + 1}. {name}</option>)}
        </select>
        <button className="background-motion" type="button" aria-label={paused ? 'Play background animation' : 'Pause background animation'}
          aria-pressed={paused} onClick={() => setMotionOverride(!paused)} title={paused ? 'Play animation' : 'Pause animation'}>
          {paused
            ? <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 2.5v11L13 8z" /></svg>
            : <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 3h3v10H4zm5 0h3v10H9z" /></svg>}
        </button>
        <a className="background-original" href="/#about" title="Back to homepage">Home</a>
        <a className="background-source" href={`https://reactbits.dev/backgrounds/${variant}`} target="_blank" rel="noopener noreferrer"
          aria-label={`${current.name} on React Bits`} title="View on React Bits">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
        </a>
      </div>
    </nav>}
  </>;
}
