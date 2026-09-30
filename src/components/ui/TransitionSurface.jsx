import { forwardRef, useEffect, useState } from 'react';
import * as React from 'react';
import { AnimatePresence, usePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// CSS owns the motion; Presence keeps exiting surfaces mounted until it ends.
export function TransitionPresence({ children }) {
  return <AnimatePresence>{children}</AnimatePresence>;
}

export const TransitionSurface = forwardRef(function TransitionSurface(/** @type {React.HTMLAttributes<HTMLDivElement> & { kind?: 'dropdown' | 'modal' | 'backdrop' }} */ {
  kind = 'dropdown', className = '', children, style = undefined, ...props
}, ref) {
  const [isPresent, safeToRemove] = usePresence();
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!isPresent) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(`--${kind === 'backdrop' ? 'modal' : kind}-close-dur`).trim();
      const duration = reduced ? 0 : (parseFloat(value) || 150) * (value.endsWith('ms') ? 1 : 1000);
      const timer = window.setTimeout(() => safeToRemove?.(), duration);
      return () => window.clearTimeout(timer);
    }
    // Give the resting state a paint before applying the open-state hooks.
    let nextFrame;
    const frame = window.requestAnimationFrame(() => {
      nextFrame = window.requestAnimationFrame(() => setOpened(true));
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(nextFrame);
    };
  }, [isPresent, kind, safeToRemove]);

  return (
    <div
      {...props}
      ref={ref}
      className={cn(`t-${kind}`, isPresent ? opened && 'is-open' : 'is-closing', className)}
      style={style}
      aria-hidden={!isPresent || undefined}
    >
      {children}
    </div>
  );
});
