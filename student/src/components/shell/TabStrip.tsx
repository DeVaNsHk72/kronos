import { NavLink, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export type Tab = { to: string; label: string; end?: boolean };

export default function TabStrip({
  tabs,
  bordered = false,
}: {
  tabs: Tab[];
  bordered?: boolean;
}) {
  const loc = useLocation();

  const strip = (
    <nav className="tabstrip page relative">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn(
              "tab relative z-10",
              isActive && "tab-on",
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  className="absolute inset-0 rounded-[calc(var(--r-sm))] bg-paper-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  layoutId="tab-pill"
                  transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                />
              )}
              <span className="relative">{t.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
  return bordered ? <div className="border-b border-line">{strip}</div> : strip;
}
