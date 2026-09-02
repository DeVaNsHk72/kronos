import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/ask", label: "Ask", end: true },
  { to: "/ask/search", label: "Search" },
  { to: "/ask/practice", label: "Practice" },
  { to: "/ask/notes", label: "Notes & papers" },
];

/** One home for the student side. Ask leads because it is the primary verb;
 *  the rest are ways of reaching the same corpus. */
export default function StudyTabs() {
  return (
    <nav className="flex gap-1 flex-wrap border-b border-line px-6 pt-4 max-w-[1100px] mx-auto">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end}
          className={({ isActive }) => cn(
            "px-3 py-2 text-[13px] rounded-t-md -mb-px border-b-2 transition-colors duration-150",
            isActive ? "border-mark text-ink font-medium"
                     : "border-transparent text-ink-2 hover:text-ink")}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
