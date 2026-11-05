import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { aboutEffects, type AboutEffectVariant } from '../../lib/about-effects';
import { ditherArt, type DitherArtVariant } from '../../lib/dither-art';
import './about-effects.css';

const CrystalizedBall = lazy(() => import('./react-bits/CrystalizedBall'));
const DitherVeil = lazy(() => import('./react-bits/DitherVeil'));
const LaserFlow = lazy(() => import('./react-bits/LaserFlow'));

class ArtBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function AboutEffect({ variant, imageOption = 'neural-loom', showControls = false }: {
  variant: AboutEffectVariant; imageOption?: DitherArtVariant; showControls?: boolean;
}) {
  const art = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [override, setOverride] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [flowStarted, setFlowStarted] = useState(false);
  const paused = override ?? reduced;
  const current = aboutEffects.find((item) => item.slug === variant)!;
  const image = ditherArt.find((item) => item.slug === imageOption) ?? ditherArt[0];

  useEffect(() => {
    surface.current = art.current?.closest('.about-side')?.querySelector<HTMLElement>('.spec-sheet') ?? null;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const syncMedia = () => setReduced(media.matches);
    const syncVisibility = () => setHidden(document.hidden);
    syncMedia();
    syncVisibility();
    media.addEventListener('change', syncMedia);
    document.addEventListener('visibilitychange', syncVisibility);
    const observer = new IntersectionObserver(([entry]) => {
      const active = entry.isIntersecting && entry.intersectionRect.height > 0;
      setVisible(active);
    },
      { rootMargin: variant === 'laser-flow' ? '160px 0px' : '0px' });
    if (art.current) observer.observe(art.current);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', syncMedia);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);

  useEffect(() => {
    if (variant !== 'laser-flow') return;
    const hero = document.querySelector<HTMLElement>('#hero');
    const panel = surface.current;
    const heading = document.querySelector<HTMLElement>('#about .section-title');
    if (!hero || !panel || !heading) return;
    let started = false;
    const onScroll = () => {
      if (started || window.scrollY <= 0 || document.hidden) return;
      const box = panel.getBoundingClientRect();
      if (heading.getBoundingClientRect().top > window.innerHeight * 0.85 || box.top > window.innerHeight * 0.9 || box.bottom <= 0) return;
      // Scrolling starts the original timed pour; stopping to read never stops it.
      started = true;
      setFlowStarted(true);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    const observer = new ResizeObserver(onScroll);
    observer.observe(hero);
    observer.observe(panel);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [variant]);

  const revealImage = () => {
    const target = art.current?.querySelector('.dither-veil');
    if (!target || paused) return;
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      pointerType: 'mouse', button: 0, bubbles: true,
    }));
    target.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
  };

  return <>
    <div ref={art} className={`about-art about-art--${variant}`} data-about-effect={variant} data-paused={paused}
      style={variant === 'laser-flow' ? { opacity: flowStarted ? 1 : 0 } : undefined}
      data-flow-started={variant === 'laser-flow' ? flowStarted : undefined}
      data-dither-image={variant === 'dither-veil' ? image.slug : undefined}>
      <div className="about-art-stage" role="img" aria-label={variant === 'dither-veil'
        ? image.alt
        : variant === 'crystalized-ball' ? 'An interactive glass sphere with an electric rim and drifting light'
          : 'A beam of blue light landing on the profile details and flowing over its corners'}>
        {!failed && ((visible && !hidden) || (variant === 'laser-flow' && flowStarted)) && <ArtBoundary onError={() => setFailed(true)}>
          <Suspense fallback={<div className="about-art-loading" aria-hidden="true" />}>
            {variant === 'crystalized-ball' && <CrystalizedBall preset="frost" color="#91abff" size={0.82}
              speed={0.45} particleCount={650} dustSpeed={0.2} crackle={0.3} flares={0.3} sparks={0.25}
              glow={0.65} haze={0.18} interactive={!paused} hoverStrength={0.45} intro={false} paused={paused} />}
            {variant === 'dither-veil' && <DitherVeil src={image.image} fit="contain"
              pattern="bayer" pixelSize={2} levels={2} inkColor="#080a15" paperColor="#9daedc"
              contrast={1.15} revealRadius={100} softness={0.65} linger={1.2} rimColor="#91a9ff"
              rim={0.15} wander={false} clickBurst={!paused} paused={paused} />}
            {variant === 'laser-flow' && flowStarted && <LaserFlow surfaceRef={surface} paused={paused || !visible || hidden}
              surfacePosition={0.86} liquidity={0.9} beamWidth={0.85} intensity={1.2}
              flare={0.95} spread={0.95} spill={0.65} fog={0.1} dust={0.12} dots={0} streaks={0.65}
              mouseInteraction={!paused && visible && !hidden} dpr={2} maxFps={30} />}
          </Suspense>
        </ArtBoundary>}
        {failed && <p className="about-art-error" role="status">This effect could not start in this browser.</p>}
      </div>
      {variant !== 'laser-flow' && <div className="about-art-caption">
        <span>{variant === 'dither-veil' ? 'Hover or tap to reveal the image.'
          : 'Move or tap to stir the light.'}</span>
        {variant === 'dither-veil' && <button type="button" disabled={paused} onClick={revealImage}>Reveal image</button>}
      </div>}
      {showControls && variant === 'dither-veil' && <div className="dither-image-options" role="group" aria-label="Dither Veil image options">
        {ditherArt.map(({ slug, label, name }) => <a key={slug}
          href={`/about-effects/dither-veil/${slug}/#about`} title={name}
          aria-current={slug === image.slug ? 'page' : undefined}>{label}</a>)}
      </div>}
    </div>

    {showControls && createPortal(<nav className="about-effect-switcher" aria-label="About section variations">
      <span className="about-effect-label">About effect</span>
      <div className="about-effect-options">
        {aboutEffects.map(({ slug, name }) => <a key={slug} href={`/about-effects/${slug}/#about`}
          aria-current={slug === variant ? 'page' : undefined}>{name}</a>)}
      </div>
      <select className="about-effect-select" aria-label="Choose About effect" value={variant}
        onChange={(event) => location.assign(`/about-effects/${event.target.value}/#about`)}>
        {aboutEffects.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>)}
      </select>
      <button type="button" className="about-effect-motion" aria-pressed={paused}
        aria-label={paused ? 'Play About animation' : 'Pause About animation'} onClick={() => setOverride(!paused)}>
        {paused ? 'Play' : 'Pause'}
      </button>
      <a className="about-effect-home" href="/#about">Home</a>
      <a className="about-effect-source" href={`https://reactbits.dev/animations/${variant}`} target="_blank" rel="noopener noreferrer"
        aria-label={`${current.name} on React Bits`} title="View on React Bits">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
      </a>
    </nav>, document.body)}
  </>;
}
