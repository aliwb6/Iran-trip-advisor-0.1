"use client";

import { useId, useState, useRef, useLayoutEffect, useEffect } from "react";
import { Link } from "react-router-dom";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";

/**
 * @typedef {{ id: string, label: string, to?: string, icon: import('react').ComponentType<{className?: string}>, onSelect?: () => void, destructive?: boolean, dividerBefore?: boolean }} SmoothDropdownItem
 */

/** @type {[number, number, number, number]} */
const easeOutQuint = [0.23, 1, 0.32, 1];
const surfaceSpring = { type: /** @type {const} */ ("spring"), damping: 34, stiffness: 380, mass: 0.8 };
const indicatorSpring = { type: /** @type {const} */ ("spring"), damping: 30, stiffness: 520, mass: 0.8 };

// Adapted from the installed useLayouts Smooth Dropdown. Retains its resizing
// surface, staggered item reveal, shared indicator/bar, and original springs.
// Native ResizeObserver replaces the demo's uninstalled react-use-measure.
/**
 * @param {{ trigger: (open: boolean) => import('react').ReactNode, triggerLabel: string, triggerClassName?: string, triggerRef?: import('react').RefObject<HTMLButtonElement>, items: SmoothDropdownItem[], header?: import('react').ReactNode, activeId?: string, dir?: string }} props
 */
export default function SmoothDropdown({
  trigger, triggerLabel, triggerClassName = "", triggerRef: externalTriggerRef,
  items, header = null, activeId, dir = "ltr",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [bounds, setBounds] = useState({ width: 288, height: 40, availableHeight: 600 });
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const internalTriggerRef = useRef(null);
  const triggerRef = externalTriggerRef || internalTriggerRef;
  const initialFocus = useRef(0);
  const menuId = useId();
  const reducedMotion = useReducedMotion();

  const close = (restoreFocus = false) => {
    setIsOpen(false);
    setHoveredItem(null);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const open = (index = 0) => {
    initialFocus.current = index;
    setVisible(true);
    setIsOpen(true);
  };

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;
    const measure = () => {
      const rect = content.getBoundingClientRect();
      const bottom = containerRef.current?.getBoundingClientRect().bottom || 0;
      // Include the surface's 1px borders so they do not introduce scrollbars.
      setBounds({ width: rect.width + 2, height: Math.ceil(rect.height) + 2, availableHeight: Math.max(40, window.innerHeight - bottom - 16) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useLayoutEffect(() => {
    if (isOpen) {
      const links = contentRef.current?.querySelectorAll('[role="menuitem"]');
      links?.[initialFocus.current]?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
        setHoveredItem(null);
      }
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [isOpen]);

  const onMenuKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === "Tab") { close(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const links = Array.from(contentRef.current.querySelectorAll('[role="menuitem"]'));
    const index = links.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1
      : (index + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
    links[next]?.focus();
  };

  return (
    <LayoutGroup id={menuId}>
      <div
        ref={containerRef}
        className="relative"
        dir={dir}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) close();
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          className={`${triggerClassName} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2`}
          aria-label={triggerLabel}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={menuId}
          onClick={() => isOpen ? close() : open()}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              open(event.key === "ArrowUp" ? items.length - 1 : 0);
            } else if (event.key === "Escape") close();
          }}
        >
          {trigger(isOpen)}
        </button>
        <motion.div
          initial={false}
          animate={{
            width: isOpen ? bounds.width : 40,
            height: isOpen ? Math.min(bounds.height, bounds.availableHeight) : 40,
            borderRadius: isOpen ? 16 : 12,
            opacity: isOpen ? 1 : 0,
          }}
          transition={reducedMotion ? { duration: 0 } : surfaceSpring}
          onAnimationComplete={() => { if (!isOpen) setVisible(false); }}
          className="absolute end-0 top-full mt-2 bg-popover border border-border/60 shadow-2xl overflow-hidden z-[60]"
          style={{ visibility: visible ? "visible" : "hidden", pointerEvents: isOpen ? "auto" : "none", transformOrigin: dir === "rtl" ? "top left" : "top right" }}
          aria-hidden={!isOpen}
        >
          <div className="h-full overflow-y-auto overscroll-contain">
            <div ref={contentRef} style={{ width: "min(18rem, calc(100vw - 2rem))" }}>
              {header}
              <motion.div
                initial={false}
                animate={{ opacity: isOpen ? 1 : 0 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.2, delay: isOpen ? 0.08 : 0 }}
                className="p-2"
                onMouseLeave={() => setHoveredItem(null)}
              >
                <ul id={menuId} role="menu" aria-label={triggerLabel} onKeyDown={onMenuKeyDown} className="flex flex-col gap-0.5 m-0 p-0 list-none">
                  {items.map((item, index) => {
                    const isActive = item.id === activeId;
                    const showIndicator = hoveredItem ? hoveredItem === item.id : isActive;
                    const Icon = item.icon;
                    /** @type {import('react').HTMLAttributes<HTMLElement>} */
                    const itemProps = {
                      role: "menuitem",
                      tabIndex: -1,
                      "aria-current": isActive && item.to ? "page" : undefined,
                      onFocus: () => setHoveredItem(item.id),
                      onMouseEnter: () => setHoveredItem(item.id),
                      onClick: () => { close(true); item.onSelect?.(); },
                      className: `relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start font-body text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${item.destructive ? "text-destructive" : "text-foreground"}`,
                    };
                    const content = (
                      <>
                        {showIndicator && (
                          <>
                            <motion.div layoutId="activeIndicator" aria-hidden="true" className={`absolute inset-0 rounded-lg ${item.destructive ? "bg-destructive/10" : "bg-accent/10"}`} transition={reducedMotion ? { duration: 0 } : indicatorSpring} />
                            <motion.div layoutId="leftBar" aria-hidden="true" className={`absolute start-0 inset-y-0 my-auto w-[3px] h-5 rounded-full ${item.destructive ? "bg-destructive" : "bg-accent"}`} transition={reducedMotion ? { duration: 0 } : indicatorSpring} />
                          </>
                        )}
                        <Icon className="w-[18px] h-[18px] relative z-10 shrink-0" />
                        <span className="font-medium relative z-10">{item.label}</span>
                      </>
                    );
                    return (
                      <motion.li
                        key={item.id}
                        role="none"
                        initial={false}
                        animate={{ opacity: isOpen ? 1 : 0, x: isOpen || reducedMotion ? 0 : dir === "rtl" ? -8 : 8 }}
                        transition={reducedMotion ? { duration: 0 } : { delay: isOpen ? 0.06 + index * 0.02 : 0, duration: item.destructive ? 0.12 : 0.15, ease: easeOutQuint }}
                        className={item.dividerBefore ? "mt-1.5 border-t border-border/40 pt-1.5" : ""}
                      >
                        {item.to ? <Link {...itemProps} to={item.to}>{content}</Link> : <button {...itemProps} type="button">{content}</button>}
                      </motion.li>
                    );
                  })}
                </ul>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </LayoutGroup>
  );
}
