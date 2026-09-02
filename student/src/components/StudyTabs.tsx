import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/ask", label: "Ask", end: true },
  { to: "/ask/search", label: "Search" },
  { to: "/ask/practice", label: "Practice" },
  { to: "/ask/notes", label: "Notes" },
];

/** The student side's four destinations, for the widths where the drafting
 *  rail is folded away. From lg up the rail lists these already, and showing
 *  both put the same four links on screen twice. */
export default function StudyTabs() {
  return (
    <div className="border-b border-line lg:hidden">
      <nav className="tabstrip page">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => cn("tab", isActive && "tab-on")}>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
