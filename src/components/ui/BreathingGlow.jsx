import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

function cleanLoaderClassName(className = '') {
  return className
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token !== 'animate-spin')
    .join(' ');
}

/**
 * Global loading animation for Iran Trip Advisor.
 *
 * The default dimensions match the approved 48px Breathing Glow exactly.
 * Existing compact loading indicators can pass width/height utility classes
 * and the two circles keep the same 2/3 and 1/2 proportions automatically.
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
      <motion.div
        aria-hidden="true"
        className="absolute h-2/3 w-2/3 rounded-full bg-blue-500 blur-md"
        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        aria-hidden="true"
        className="relative h-1/2 w-1/2 rounded-full bg-white shadow-sm"
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
