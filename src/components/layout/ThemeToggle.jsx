import { motion, useReducedMotion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext.jsx';
import IconSwap from '@/components/ui/IconSwap';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const reduceMotion = useReducedMotion();
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
      <IconSwap
        active={isDark}
        className="text-foreground"
        a={<Sun className="h-[18px] w-[18px]" />}
        b={<Moon className="h-[18px] w-[18px]" />}
      />
    </motion.button>
  );
}
