import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { Command as CommandIcon } from "@phosphor-icons/react";
import CommandK from "./CommandK";

const TABS = [
  { to: "/", label: "Home" },
  { to: "/ask", label: "Study" },
  { to: "/faculty", label: "Intelligence" },
];

function Wordmark() {
  return (
    <svg
      viewBox="0 0 92 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-[13px] w-auto"
      aria-label="Kronos"
    >
      <text
        x="0"
        y="12"
        fill="currentColor"
        fontFamily="'Departure Mono', monospace"
        fontSize="13"
        fontWeight="400"
        letterSpacing="0.08em"
      >
        KRONOS
      </text>
      <circle cx="88" cy="11" r="2.5" fill="var(--color-mark)" />
    </svg>
  );
}

export default function Masthead() {
  const [cmdkOpen, setCmdkOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-4">
        <nav className="flex h-12 w-full max-w-4xl items-center rounded-full border border-line bg-paper px-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] backdrop-blur-lg">
          <NavLink to="/home" className="text-ink">
            <Wordmark />
          </NavLink>

          <div className="ml-auto flex items-center gap-1 text-[13px] font-medium">
            {TABS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-full px-3.5 py-1.5 transition-colors ${
                    isActive
                      ? "bg-ink text-paper"
                      : "text-ink-2 hover:text-ink"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}

            <button
              onClick={() => setCmdkOpen(true)}
              className="ml-2 flex items-center gap-1 rounded-md border border-line bg-paper-2 px-2 py-1 text-[11px] text-ink-2 transition-colors hover:border-ink/25 hover:text-ink"
              aria-label="Open command palette"
            >
              <CommandIcon size={12} weight="bold" />
              <span className="font-mono">K</span>
            </button>
          </div>
        </nav>
      </header>
      <CommandK open={cmdkOpen} onOpenChange={setCmdkOpen} />
    </>
  );
}
