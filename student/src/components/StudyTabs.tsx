import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/ask", label: "Ask", end: true },
  { to: "/ask/search", label: "Search" },
  { to: "/ask/practice", label: "Practice" },
  { to: "/ask/notes", label: "Notes" },
];

/** One home for the student side. Shares `.tabstrip` with the Intelligence
 *  nav, so both halves of the app navigate the same way. */
export default function StudyTabs() {
  return (
    <div className="border-b border-line">
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
