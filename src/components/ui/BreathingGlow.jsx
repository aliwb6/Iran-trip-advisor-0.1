import { cn } from '@/lib/utils';
import ParticleSurge from '@/components/ui/ParticleSurge';

function cleanLoaderClassName(className = '') {
  return className
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token !== 'animate-spin')
    .join(' ');
}

/**
 * Global Particle Surge loading animation for Iran Trip Advisor.
 * Existing loading call sites keep their current dimensions while sharing
 * the exact Originkit particle renderer.
 */
export function BreathingGlow({
  className = 'w-12 h-12',
  label = 'Loading',
  ...props
}) {
  const normalizedClassName = cleanLoaderClassName(className);

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center align-middle',
        normalizedClassName || 'w-12 h-12',
      )}
      role="status"
      aria-label={label}
      {...props}
    >
      <ParticleSurge
        style={{
          minWidth: '100%',
          minHeight: '100%',
          pointerEvents: 'none',
        }}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function LoadingState({
  className,
  label = 'Loading',
  fullScreen = false,
  loaderClassName = 'w-12 h-12',
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        fullScreen ? 'fixed inset-0 z-[100] bg-background' : 'min-h-[12rem]',
        className,
      )}
    >
      <BreathingGlow className={loaderClassName} label={label} />
    </div>
  );
}

export default BreathingGlow;
