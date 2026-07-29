import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";

/**
 * A labelled dropdown button. Shows the active value inline so the whole
 * filter state is readable without opening anything.
 */
export default function Popover({
  label,
  value,
  active,
  children,
  width = "w-64",
}: {
  label: string;
  value?: string | null;
  active?: boolean;
  children: (close: () => void) => ReactNode;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex max-w-[15rem] items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-[colors,transform] duration-150 ease-out active:scale-[0.98] ${
          active
            ? "border-ink/30 bg-paper-2 text-ink"
            : "border-line bg-paper-2 text-ink-2 hover:border-ink-2/50 hover:text-ink"
        }`}
      >
        <span className={`shrink-0 ${active ? "text-ink-2" : ""}`}>{label}</span>
        {active && value && (
          <span className="min-w-0 truncate font-medium text-ink">{value}</span>
        )}
        <CaretDown
          size={14}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <Panel width={width} onClose={() => setOpen(false)}>
          {children}
        </Panel>
      )}
    </div>
  );
}

/** Mount-flip so the entry transition actually runs. React inserts the DOM
 *  node with the settled style already applied, which defeats @starting-style;
 *  flipping `data-mounted` on the second frame after mount gives the browser
 *  a starting frame it can transition FROM. The double rAF matters: a single
 *  rAF fires in the same paint tick as the insertion, so the browser never
 *  sees the "before" state. */
function Panel({
  width,
  children,
  onClose,
}: {
  width: string;
  children: (close: () => void) => ReactNode;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setMounted(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div
      data-mounted={mounted ? "true" : undefined}
      className={`popover-panel absolute left-0 top-full z-30 mt-1.5 ${width} rounded-md border border-line bg-paper-2 p-1 shadow-lg shadow-ink/5`}
    >
      {children(onClose)}
    </div>
  );
}
