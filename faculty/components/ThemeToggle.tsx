"use client";
import { useEffect, useState } from "react";

/**
 * Three states, not two: light, dark, and "follow the system". Forcing a binary
 * choice means a viewer whose OS switches at dusk gets stuck on whichever they
 * last picked.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<"system" | "light" | "dark">("system");
  useEffect(() => {
    const saved = (localStorage.getItem("kronos-theme") as typeof mode) || "system";
    setMode(saved); apply(saved);
  }, []);
  function apply(m: typeof mode) {
    const el = document.documentElement;
    if (m === "system") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", m);
  }
  function cycle() {
    const next = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(next); apply(next);
    try { localStorage.setItem("kronos-theme", next); } catch {}
  }
  return (
    <button onClick={cycle} title={`Theme: ${mode}`}
      className="mono text-[10px] uppercase tracking-widest text-ink-2 hover:text-ink px-2 py-1">
      {mode === "system" ? "auto" : mode}
    </button>
  );
}
