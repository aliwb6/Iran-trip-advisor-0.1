import { createContext, useContext, useEffect, useId, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';

const MotionContext = createContext(false);
const spring = { type: 'spring', bounce: 0.2, duration: 0.6 };
const contentTransition = { duration: 0.3, ease: [0.23, 1, 0.32, 1] };

// Motion values from the locally installed useLayouts Bento Card. Scope shared
// layout IDs per dashboard and keep desktop motion out of the mobile nav.
export function BentoDashboardMotion({ children }) {
  const id = useId();
  const initialReducedMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setEnabled(desktop.matches && !reduced.matches);
    update();
    desktop.addEventListener('change', update);
    reduced.addEventListener('change', update);
    return () => {
      desktop.removeEventListener('change', update);
      reduced.removeEventListener('change', update);
    };
  }, [initialReducedMotion]);
  return (
    <MotionContext.Provider value={enabled}>
      <LayoutGroup id={id}>{children}</LayoutGroup>
    </MotionContext.Provider>
  );
}

export function BentoSidebarIndicator({ active }) {
  const enabled = useContext(MotionContext);
  if (!active) return null;
  return (
    <>
      <motion.span aria-hidden="true" layoutId={enabled ? 'backgroundIndicator' : undefined} className="bento-nav-highlight" transition={enabled ? spring : { duration: 0 }} />
      <motion.span aria-hidden="true" layoutId={enabled ? 'sidebar-pill' : undefined} className="bento-nav-pill" transition={enabled ? spring : { duration: 0 }} />
    </>
  );
}

export function BentoDashboardContent({ section, renderSection }) {
  const enabled = useContext(MotionContext);
  const [visited, setVisited] = useState([section]);
  // Remember only visited sections, without mounting or fetching unused views.
  // Updating this component's own state during render avoids an empty frame.
  if (!visited.includes(section)) setVisited([...visited, section]);
  return (
    <div className="bento-content-deck">
      {visited.map(id => {
        const active = id === section;
        return (
          <motion.div
            key={id}
            data-bento-section={id}
            aria-hidden={!active}
            inert={active ? undefined : ''}
            initial={enabled ? { opacity: 0, y: 8, filter: 'blur(4px)' } : false}
            animate={active ? {
              opacity: 1, y: 0, filter: 'blur(0px)',
              // Clear the filter so existing fixed dialogs stay viewport-based.
              transitionEnd: { filter: 'none' },
            } : {
              opacity: 0, y: enabled ? 8 : 0, filter: enabled ? 'blur(4px)' : 'blur(0px)',
            }}
            transition={enabled && active ? contentTransition : { duration: 0 }}
            // Keep the active content in normal flow. Inactive panels stay
            // mounted for draft retention without occupying document space.
            style={{ display: active ? 'block' : 'none', width: '100%' }}
          >
            {renderSection(id)}
          </motion.div>
        );
      })}
    </div>
  );
}
