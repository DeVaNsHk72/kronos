import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import type { NavEntry } from "./nav";

export default function NavItem({
  entry,
  onNavigate,
}: {
  entry: NavEntry;
  onNavigate?: () => void;
}) {
  const { to, label, Icon, end } = entry;
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative mx-1.5 flex items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 py-2 text-[0.8125rem] transition-[color,background-color] duration-150 ${
          isActive
            ? "bg-surface-active text-ink"
            : "text-ink-2 hover:bg-surface-hover hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active-bar"
              className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-accent-blue"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
          <Icon size={15} weight="regular" className={`shrink-0 transition-colors duration-150 ${isActive ? "text-accent-blue" : ""}`} />
          <span className={isActive ? "font-medium" : undefined}>{label}</span>
        </>
      )}
    </NavLink>
  );
}
