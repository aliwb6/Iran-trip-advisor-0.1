"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { PulsingBorder } from "https://esm.sh/@paper-design/shaders-react@0.0.61?external=react,react-dom&deps=@paper-design/shaders@0.0.61";

interface PulsatingBorderProps {
  colors?: string[];
  colorBack?: string;
  speed?: number;
  radius?: number;
  thickness?: number;
  softness?: number;
  intensity?: number;
  bloom?: number;
  spotSize?: number;
  spread?: number;
  style?: React.CSSProperties;
}

const DEFAULT_COLORS = ["#F2244F", "#4DA6E6", "#379590"];

const DEFAULTS = {
  colorBack: "rgba(0, 0, 0, 0)",
  speed: 1,
  radius: 35,
  thickness: 5,
  softness: 75,
  intensity: 30,
  bloom: 50,
  spotSize: 60,

  spread: 31,
};

const SPOTS = 3;
const PULSE = 0;
const SMOKE = 0.35;
const SMOKE_SIZE = 0.63;

const GLOW_ROOM = 0.4;

const MAX_ROOM = 480;

export default function PulsatingBorder(props: PulsatingBorderProps) {
  const {
    colorBack = DEFAULTS.colorBack,
    speed = DEFAULTS.speed,
    radius = DEFAULTS.radius,
    thickness = DEFAULTS.thickness,
    softness = DEFAULTS.softness,
    intensity = DEFAULTS.intensity,
    bloom = DEFAULTS.bloom,
    spotSize = DEFAULTS.spotSize,
    spread = DEFAULTS.spread,
    style,
  } = props;

  const colors =
    Array.isArray(props.colors) && props.colors.length
      ? props.colors
      : DEFAULT_COLORS;

  const hostRef = React.useRef<HTMLDivElement>(null);

  const [rect, setRect] = React.useState({ left: 0, top: 0, w: 0, h: 0 });
  const [portalTarget, setPortalTarget] = React.useState<HTMLElement | null>(
    null
  );

  React.useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const r = host.getBoundingClientRect();
      const w = host.clientWidth;
      const h = host.clientHeight;
      setRect((prev) =>
        prev.left === r.left &&
        prev.top === r.top &&
        prev.w === w &&
        prev.h === h
          ? prev
          : { left: r.left, top: r.top, w, h }
      );
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    const ro = new ResizeObserver(schedule);
    ro.observe(host);

    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const worldW = rect.w + spread * 2;
  const worldH = rect.h + spread * 2;
  const marginX = worldW > 0 ? spread / worldW : 0;
  const marginY = worldH > 0 ? spread / worldH : 0;

  const room = Math.min(
    MAX_ROOM,
    Math.ceil(GLOW_ROOM * Math.min(worldW, worldH))
  );
  const bleed = spread + room;
  const canvasW = rect.w + bleed * 2;
  const canvasH = rect.h + bleed * 2;
  const measured = rect.w > 0 && rect.h > 0;

  const escapes = portalTarget !== null;

  const layer = measured ? (
    <PulsingBorder
      colors={colors}
      colorBack={colorBack}
      speed={speed}
      roundness={radius / 100}
      thickness={thickness / 100}
      softness={softness / 100}
      intensity={intensity / 100}
      bloom={bloom / 100}
      spots={SPOTS}

      spotSize={(spotSize / 100) * 0.5}
      pulse={PULSE}
      smoke={SMOKE}
      smokeSize={SMOKE_SIZE}

      worldWidth={worldW}
      worldHeight={worldH}
      fit="none"
      marginLeft={marginX}
      marginRight={marginX}
      marginTop={marginY}
      marginBottom={marginY}
      scale={1}
      rotation={0}
      offsetX={0}
      offsetY={0}
      originX={0.5}
      originY={0.5}
      frame={0}
      style={{
        position: escapes ? "fixed" : "absolute",
        left: escapes ? rect.left - bleed : -bleed,
        top: escapes ? rect.top - bleed : -bleed,
        width: canvasW,
        height: canvasH,

        pointerEvents: "none",
      }}
    />
  ) : null;

  return (
    <div
      ref={hostRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        flexShrink: 0,

        overflow: "visible",
        ...style,
      }}
    >
      {escapes ? createPortal(layer, portalTarget) : layer}
    </div>
  );
}

PulsatingBorder.displayName = "Pulsating Border";

PulsatingBorder.defaultProps = {
  ...DEFAULTS,
  colors: DEFAULT_COLORS,
};