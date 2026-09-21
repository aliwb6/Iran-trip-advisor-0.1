import { useState } from 'react';
import { BreathingGlow } from '@/components/ui/BreathingGlow';

/**
 * Image wrapper that shows a muted, pulsing placeholder (matching the app's
 * existing Skeleton aesthetic) until the source loads, then fades the real
 * image in. Purely visual — no change to layout, content, or behavior.
 *
 * Spread any extra <img> props (className, alt, onClick, etc.) through.
 */
export default function BlurImage({ src, alt = '', className = '', imgClassName = '', ...rest }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-muted/40 ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/40" aria-hidden="true">
          <BreathingGlow className="w-8 h-8" label="Loading image" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-500 ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${imgClassName}`}
        {...rest}
      />
    </div>
  );
}
