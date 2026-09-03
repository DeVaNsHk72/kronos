import * as React from "react";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { NavLink, useLocation } from "react-router-dom";
import { List } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { NavEntry } from "../shell/nav";

const EXPAND_SCROLL_THRESHOLD = 80;

const containerVariants = {
  expanded: {
    y: 0,
    opacity: 1,
    width: "auto",
    transition: {
      y: { type: "spring", damping: 18, stiffness: 250 },
      opacity: { duration: 0.3 },
      type: "spring",
      damping: 20,
      stiffness: 300,
      staggerChildren: 0.07,
      delayChildren: 0.2,
    },
  },
  collapsed: {
    y: 0,
    opacity: 1,
    width: "3rem",
    transition: {
      type: "spring",
      damping: 20,
      stiffness: 300,
      when: "afterChildren",
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const itemVariants = {
  expanded: { opacity: 1, x: 0, scale: 1, transition: { type: "spring", damping: 15 } },
  collapsed: { opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.2 } },
};

const collapsedIconVariants = {
  expanded: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
  collapsed: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", damping: 15, stiffness: 300, delay: 0.15 },
  },
};

export function FloatingNav({ items }: { items: NavEntry[] }) {
  const [isExpanded, setExpanded] = React.useState(true);
  const loc = useLocation();

  const { scrollY } = useScroll();
  const lastScrollY = React.useRef(0);
  const scrollPositionOnCollapse = React.useRef(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = lastScrollY.current;
    if (isExpanded && latest > previous && latest > 150) {
      setExpanded(false);
      scrollPositionOnCollapse.current = latest;
    } else if (!isExpanded && latest < previous && scrollPositionOnCollapse.current - latest > EXPAND_SCROLL_THRESHOLD) {
      setExpanded(true);
    }
    lastScrollY.current = latest;
  });

  const handleNavClick = (e: React.MouseEvent) => {
    if (!isExpanded) {
      e.preventDefault();
      setExpanded(true);
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={isExpanded ? "expanded" : "collapsed"}
        variants={containerVariants}
        whileHover={!isExpanded ? { scale: 1.1 } : {}}
        whileTap={!isExpanded ? { scale: 0.95 } : {}}
        onClick={handleNavClick}
        className={cn(
          "flex items-center overflow-hidden rounded-full border border-line bg-paper/85 shadow-lg backdrop-blur-md h-11",
          !isExpanded && "cursor-pointer justify-center",
        )}
      >
        {/* Nav items */}
        <motion.div
          className={cn(
            "flex items-center gap-0.5 px-1.5",
            !isExpanded && "pointer-events-none",
          )}
        >
          {items.map((item) => {
            const isActive =
              item.end
                ? loc.pathname === item.to
                : loc.pathname.startsWith(item.to);

            return (
              <motion.div key={item.to} variants={itemVariants}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "text-ink"
                      : "text-ink-2 hover:text-ink",
                  )}
                >
                  {isActive && (
                    <motion.span
                      className="absolute inset-0 rounded-full bg-paper-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                      layoutId="floating-nav-pill"
                      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                    />
                  )}
                  <item.Icon size={15} weight={isActive ? "fill" : "regular"} className="relative" />
                  <span className="relative">{item.label}</span>
                </NavLink>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Collapsed icon */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            variants={collapsedIconVariants}
            animate={isExpanded ? "expanded" : "collapsed"}
          >
            <List size={20} weight="bold" className="text-ink" />
          </motion.div>
        </div>
      </motion.nav>
    </div>
  );
}
