import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTheme } from '@/lib/ThemeContext.jsx';

const RAYS = [
  [12, 2, 12, 4.25],
  [12, 19.75, 12, 22],
  [2, 12, 4.25, 12],
  [19.75, 12, 22, 12],
  [4.95, 4.95, 6.55, 6.55],
  [17.45, 17.45, 19.05, 19.05],
  [4.95, 19.05, 6.55, 17.45],
  [17.45, 6.55, 19.05, 4.95],
];

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const maskId = `theme-toggle-mask-${useId().replace(/:/g, '')}`;
  const isDark = theme === 'dark';

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: 'spring', stiffness: 260, damping: 20, mass: 0.7 };

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      whileHover={reduceMotion ? undefined : { scale: 1.05 }}
      whileTap={reduceMotion ? undefined : { scale: 0.94 }}
      transition={spring}
      className="relative w-9 h-9 rounded-full flex items-center justify-center border border-border/50 hover:border-accent/60 transition-colors duration-300 bg-background/50 backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <motion.svg
        viewBox="0 0 24 24"
        className="w-[18px] h-[18px] text-foreground"
        fill="none"
        aria-hidden="true"
        initial={false}
        animate={{ rotate: isDark ? -35 : 0 }}
        transition={spring}
      >
        <defs>
          <mask id={maskId}>
            <rect width="24" height="24" fill="black" />
            <circle cx="12" cy="12" r="4.5" fill="white" />
            <motion.circle
              r="4.7"
              fill="black"
              initial={false}
              animate={{
                cx: isDark ? 14.3 : 20.2,
                cy: isDark ? 9.7 : 3.8,
              }}
              transition={spring}
            />
          </mask>
        </defs>

        <motion.g
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          initial={false}
          animate={{
            opacity: isDark ? 0 : 1,
            scale: isDark ? 0.45 : 1,
            rotate: isDark ? 25 : 0,
          }}
          transition={spring}
          style={{ transformOrigin: '12px 12px' }}
        >
          {RAYS.map(([x1, y1, x2, y2], index) => (
            <line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
          ))}
        </motion.g>

        <motion.circle
          cx="12"
          cy="12"
          r="4.5"
          fill="currentColor"
          mask={`url(#${maskId})`}
          initial={false}
          animate={{ scale: isDark ? 1.12 : 1 }}
          transition={spring}
          style={{ transformOrigin: '12px 12px' }}
        />
      </motion.svg>
    </motion.button>
  );
}
