import { useEffect, useRef, useState } from 'react';

const EDGE_COPIES = 2;
const GLOW_LAYERS = [
  { blur: 8, opacity: 0.5, reach: 0.3 },
  { blur: 15, opacity: 0.3, reach: 0.6 },
  { blur: 57, opacity: 0.18, reach: 1 },
];
const MAX_GLOW_BLUR = Math.max(...GLOW_LAYERS.map(layer => layer.blur));
const MAX_GLOW_REACH = 36;
const ARC_SAMPLES = 24;
const MIN_ARC = 0.015;
const SLOWEST_CYCLE = 30;
const FASTEST_CYCLE = 4;
const SLOWEST_STEP = 3;
const FASTEST_STEP = 0.35;
const STEP_EASE = [0.72, 0.16, 0.18, 1.05];
const GLIDE_EASE = [0.65, 0, 0.35, 1];

const BAND_MASK = {
  WebkitMaskImage: 'linear-gradient(#fff 0 0), linear-gradient(#fff 0 0)',
  WebkitMaskClip: 'content-box, border-box',
  WebkitMaskComposite: 'xor',
  maskImage: 'linear-gradient(#fff 0 0), linear-gradient(#fff 0 0)',
  maskClip: 'content-box, border-box',
  maskComposite: 'exclude',
};

function withAlpha(input, alpha) {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const value = typeof input === 'string' ? input.trim() : '';
  const hex = value.match(/^#([0-9a-f]{3,8})$/i);

  if (hex) {
    let normalized = hex[1];
    if (normalized.length === 3 || normalized.length === 4) {
      normalized = normalized.split('').map(character => character + character).join('');
    }
    const number = parseInt(normalized.slice(0, 6), 16);
    if (Number.isFinite(number)) {
      return `rgba(${(number >> 16) & 255},${(number >> 8) & 255},${number & 255},${safeAlpha})`;
    }
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)/i);
  if (rgb) {
    const parts = rgb[1].split(',').map(item => parseFloat(item));
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite)) {
      return `rgba(${parts[0]},${parts[1]},${parts[2]},${safeAlpha})`;
    }
  }

  return `rgba(0,0,0,${safeAlpha})`;
}

function perimeterPoint(progress, width, height) {
  const distance = (((progress % 1) + 1) % 1) * 2 * (width + height);
  if (distance < width) return [distance, 0];
  if (distance < width + height) return [width, distance - width];
  if (distance < width * 2 + height) return [width - (distance - width - height), height];
  return [0, height - (distance - width * 2 - height)];
}

function cornerLap(index, width, height) {
  const perimeter = 2 * (width + height);
  const corners = [0, width / perimeter, (width + height) / perimeter, (width * 2 + height) / perimeter];
  return Math.floor(index / 4) + corners[((index % 4) + 4) % 4];
}

function perimeterAngle(progress, width, height) {
  const [x, y] = perimeterPoint(progress, width, height);
  return (Math.atan2(x - width / 2, height / 2 - y) * 180) / Math.PI;
}

function buildArc(lap, lengthPercent, width, height, color) {
  const safeWidth = width > 0 ? width : 100;
  const safeHeight = height > 0 ? height : 100;
  const length = Math.max(0, Math.min(100, lengthPercent));
  const span = Math.max(MIN_ARC, (length / 100) * 0.5);
  const solidThreshold = length / 100;
  const stops = [];
  let base = 0;
  let previous = 0;
  let accumulated = 0;

  for (let index = 0; index <= ARC_SAMPLES; index += 1) {
    const fraction = index / ARC_SAMPLES;
    const angle = perimeterAngle(lap + (fraction - 0.5) * span, safeWidth, safeHeight);
    if (index === 0) {
      base = angle;
    } else {
      let delta = angle - previous;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      accumulated += delta;
    }
    previous = angle;

    const edgeDistance = Math.abs(fraction - 0.5) * 2;
    const strength = solidThreshold >= 1
      ? 1
      : edgeDistance <= solidThreshold
        ? 1
        : 1 - (edgeDistance - solidThreshold) / (1 - solidThreshold);
    stops.push(`${withAlpha(color, strength * strength * (3 - 2 * strength))} ${accumulated.toFixed(2)}deg`);
  }

  const end = accumulated.toFixed(2);
  stops.push(`${withAlpha(color, 0)} ${end}deg`, `${withAlpha(color, 0)} 360deg`);
  return `conic-gradient(from ${base.toFixed(2)}deg at 50% 50%, ${stops.join(', ')})`;
}

function makeEaseFunction(points) {
  const [x1, y1, x2, y2] = points;
  const bezier = (a, b, position) => {
    const inverse = 1 - position;
    return 3 * inverse * inverse * position * a + 3 * inverse * position * position * b + position * position * position;
  };

  return (time) => {
    const x = Math.max(0, Math.min(1, time));
    let position = x;
    for (let index = 0; index < 8; index += 1) {
      const error = bezier(x1, x2, position) - x;
      const inverse = 1 - position;
      const derivative = 3 * inverse * inverse * x1 + 6 * inverse * position * (x2 - x1) + 3 * position * position * (1 - x2);
      if (Math.abs(derivative) < 1e-6) break;
      position = Math.max(0, Math.min(1, position - error / derivative));
    }
    return bezier(y1, y2, position);
  };
}

const stepEase = makeEaseFunction(STEP_EASE);
const glideEase = makeEaseFunction(GLIDE_EASE);

export function NeonBorder({
  color = '#CC9149',
  rounded = 50,
  thickness = 3,
  borderSize = 42,
  glow = 70,
  movement = 'continuous',
  speed = 15,
  className = '',
  style,
}) {
  const rootRef = useRef(null);
  const groupARef = useRef(null);
  const groupBRef = useRef(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const liveRef = useRef({ speed, movement, borderSize, color });
  const [size, setSize] = useState({ width: 0, height: 0 });
  liveRef.current = { speed, movement, borderSize, color };

  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      if (rect.width === sizeRef.current.width && rect.height === sizeRef.current.height) return;
      sizeRef.current = { width: rect.width, height: rect.height };
      setSize(sizeRef.current);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;

    let frameId = 0;
    let lastTime = performance.now();
    let corner = 0;
    let stepTime = 0;

    const frame = (now) => {
      const deltaTime = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      const current = liveRef.current;
      const safeSpeed = Math.max(0, Math.min(20, current.speed));

      if (safeSpeed > 0) {
        const isStepped = current.movement === 'step';
        const beat = isStepped
          ? SLOWEST_STEP + ((FASTEST_STEP - SLOWEST_STEP) * (safeSpeed - 1)) / 19
          : (SLOWEST_CYCLE + ((FASTEST_CYCLE - SLOWEST_CYCLE) * (safeSpeed - 1)) / 19) / 4;
        stepTime += deltaTime / beat;
        while (stepTime >= 1) {
          stepTime -= 1;
          corner += 1;
        }

        const eased = isStepped ? stepEase(Math.min(1, stepTime * 2)) : glideEase(stepTime);
        const { width, height } = sizeRef.current;
        const safeWidth = width > 0 ? width : 100;
        const safeHeight = height > 0 ? height : 100;
        const from = cornerLap(corner, safeWidth, safeHeight);
        const to = cornerLap(corner + 1, safeWidth, safeHeight);
        const lap = from + (to - from) * eased;

        groupARef.current?.style.setProperty('--neon-arc', buildArc(lap, current.borderSize, width, height, current.color));
        groupBRef.current?.style.setProperty('--neon-arc', buildArc(lap + 0.5, current.borderSize, width, height, current.color));
      }

      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const safeThickness = Math.max(1, Math.min(10, thickness));
  const radius = (Math.max(0, Math.min(100, rounded)) / 100) * (Math.min(size.width, size.height) / 2);
  const glowAmount = Math.max(0, Math.min(100, glow)) / 100;
  const glowOuter = 10 + MAX_GLOW_REACH + MAX_GLOW_BLUR * 2;
  const ringAt = share => safeThickness + glowAmount * MAX_GLOW_REACH * share;

  const band = (ring, offset = 0) => (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: offset - ring,
        boxSizing: 'border-box',
        padding: ring,
        borderRadius: radius > 0 ? radius + ring : 0,
        background: 'var(--neon-arc)',
        ...BAND_MASK,
      }}
    />
  );

  const glowGroup = (start, reference) => (
    <span
      ref={reference}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        pointerEvents: 'none',
        '--neon-arc': buildArc(start, borderSize, size.width, size.height, color),
      }}
    >
      {glowAmount > 0 && GLOW_LAYERS.map((layer, index) => (
        <span
          key={`glow-${index}`}
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: -glowOuter,
            boxSizing: 'border-box',
            padding: glowOuter,
            borderRadius: radius > 0 ? radius + glowOuter : 0,
            opacity: layer.opacity,
            mixBlendMode: 'plus-lighter',
            filter: `blur(${layer.blur.toFixed(1)}px)`,
            WebkitFilter: `blur(${layer.blur.toFixed(1)}px)`,
            ...BAND_MASK,
          }}
        >
          {band(ringAt(layer.reach), glowOuter)}
        </span>
      ))}
      {Array.from({ length: EDGE_COPIES }).map((_, index) => (
        <span key={`edge-${index}`} aria-hidden="true" style={{ position: 'absolute', inset: 0, mixBlendMode: 'plus-lighter' }}>
          {band(safeThickness)}
        </span>
      ))}
    </span>
  );

  return (
    <span
      ref={rootRef}
      aria-hidden="true"
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', flexShrink: 0, borderRadius: radius, ...style }}
    >
      {glowGroup(0, groupARef)}
      {glowGroup(0.5, groupBRef)}
    </span>
  );
}
