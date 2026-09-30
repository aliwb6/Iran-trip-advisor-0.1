import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Keep icon layers in one grid cell. Expensive action loaders are retained only
// during their exit transition, rather than running invisibly inside buttons.
export default function IconSwap({ active, a, b, className = '', keepMounted = true }) {
  const [retained, setRetained] = useState(active ? 'b' : 'a');
  useEffect(() => {
    if (keepMounted) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const value = getComputedStyle(document.documentElement).getPropertyValue('--icon-swap-dur').trim();
    const duration = reduced ? 0 : (parseFloat(value) || 250) * (value.endsWith('ms') ? 1 : 1000);
    const timer = window.setTimeout(() => setRetained(active ? 'b' : 'a'), duration);
    return () => window.clearTimeout(timer);
  }, [active, keepMounted]);

  return (
    <span className={cn('t-icon-swap shrink-0 align-middle', className)} data-state={active ? 'b' : 'a'} aria-hidden="true">
      <span className="t-icon inline-flex items-center justify-center" data-icon="a">
        {keepMounted || !active || retained === 'a' ? a : null}
      </span>
      <span className="t-icon inline-flex items-center justify-center" data-icon="b">
        {keepMounted || active || retained === 'b' ? b : null}
      </span>
    </span>
  );
}
