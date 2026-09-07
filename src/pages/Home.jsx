import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import HeroSection from '@/components/home/HeroSection';

const ExperiencePhilosophy = lazy(() => import('@/components/home/ExperiencePhilosophy'));
const HowItWorks = lazy(() => import('@/components/HowItWorks'));
const TestimonialsSection = lazy(() => import('@/components/home/TestimonialsSection'));
const SpotlightDestinations = lazy(() => import('@/components/SpotlightDestinations'));
const PopularPackages = lazy(() => import('@/components/home/PopularPackages'));

function getDeferredRootMargin() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const effectiveType = connection?.effectiveType || '';
  const constrainedNetwork = connection?.saveData || effectiveType === 'slow-2g' || effectiveType === '2g';
  if (constrainedNetwork) return '100px 0px';
  if (window.matchMedia('(max-width: 767px)').matches) return '280px 0px';
  return '700px 0px';
}

function DeferredSection({ children, minHeight = 560 }) {
  const rootRef = useRef(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || !('IntersectionObserver' in window)) {
      setShouldRender(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setShouldRender(true);
      observer.disconnect();
    }, { rootMargin: getDeferredRootMargin() });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className="mobile-content-visibility"
      style={shouldRender ? undefined : { minHeight }}
    >
      {shouldRender ? <Suspense fallback={<div style={{ minHeight }} />}>{children}</Suspense> : null}
    </div>
  );
}

export default function Home() {
  return (
    <div>
      <HeroSection />
      <DeferredSection><ExperiencePhilosophy /></DeferredSection>
      <DeferredSection minHeight={760}><HowItWorks /></DeferredSection>
      <DeferredSection><TestimonialsSection /></DeferredSection>
      <DeferredSection minHeight={820}><SpotlightDestinations /></DeferredSection>
      <DeferredSection><PopularPackages /></DeferredSection>
    </div>
  );
}
