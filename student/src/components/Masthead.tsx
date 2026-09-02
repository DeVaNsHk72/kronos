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
        fontFamily="'Ubuntu Mono', monospace"
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
      {/* A plain bar on the same grid as the page, not a floating pill. The
          pill was the one element that sat on a different geometry from
          everything below it. */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-[1400px] items-center px-6">
          <NavLink to="/" className="text-ink">
            <Wordmark />
          </NavLink>

          <div className="ml-auto flex items-center gap-1 text-[13px]">
            {TABS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 transition-colors duration-150 ${
                    isActive ? "text-ink font-medium" : "text-ink-2 hover:text-ink"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}

            <button
              onClick={() => setCmdkOpen(true)}
              className="ml-3 flex items-center gap-1 rounded-md border border-line bg-paper-2 px-2 py-1 text-[11px] text-ink-2 transition-colors duration-150 hover:border-ink-2 hover:text-ink"
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
