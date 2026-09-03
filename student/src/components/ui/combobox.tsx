import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled,
  className,
  ...props
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pick = useCallback(
    (v: string) => {
      onChange(v);
      setOpen(false);
      setQuery("");
    },
    [onChange],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); setQuery(""); }
    if (e.key === "Enter" && filtered.length === 1) pick(filtered[0].value);
  };

  return (
    <div ref={containerRef} className={cn("relative w-[280px] max-w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-label={props["aria-label"]}
        onClick={() => {
          setOpen(!open);
          if (!open) setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="field flex w-full items-center justify-between bg-paper-2 pr-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selected ? "text-ink" : "text-ink-2"}>
          {selected?.label ?? placeholder}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0 text-ink-2">
          <path d="M3 5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="absolute z-50 mt-1 w-full rounded-[var(--r-md)] border border-line bg-paper shadow-lg"
          >
            <div className="p-1.5">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search…"
                className="w-full rounded-[var(--r-sm)] bg-surface-hover px-2.5 py-1.5 text-[0.8125rem] text-ink outline-none placeholder:text-ink-2"
              />
            </div>
            <div className="max-h-[200px] overflow-y-auto thin-scroll p-1">
              {filtered.length === 0 && (
                <div className="px-2.5 py-2 text-[0.8125rem] text-ink-2">No results</div>
              )}
              {filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => pick(o.value)}
                  className={cn(
                    "flex w-full items-center rounded-[var(--r-sm)] px-2.5 py-1.5 text-left text-[0.8125rem] transition-colors duration-100",
                    o.value === value
                      ? "bg-surface-active text-ink font-medium"
                      : "text-ink-2 hover:bg-surface-hover hover:text-ink",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
