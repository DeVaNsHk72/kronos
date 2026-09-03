import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowUp, Sparkle } from "@phosphor-icons/react";

const spring = { type: "spring" as const, bounce: 0, duration: 0.35 };

export default function GlobalComposer({ onAsk }: { onAsk: (q: string) => void }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  function send() {
    const q = value.trim();
    if (!q) return;
    setValue("");
    onAsk(q);
  }

  const active = focused || !!value.trim();

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 lg:pl-[14.25rem]">
      <div className="composer-glass pb-4 pt-8">
        <div className="page">
          <motion.div
            layout
            transition={spring}
            className={`mx-auto flex items-center gap-2 rounded-[var(--r-lg)] border bg-paper-2/80 px-3 py-2 shadow-[0_-2px_16px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-colors duration-150 ${
              active ? "max-w-[880px] border-ink/20" : "max-w-[520px] border-line"
            }`}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          >
            <Sparkle size={15} weight="regular" className="shrink-0 text-ink-2" />
            <input
              ref={ref}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask Kronos — it writes the SQL and shows you"
              aria-label="Ask Kronos"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none"
            />
            <kbd className="label-cap hidden select-none border border-line px-1.5 py-1 sm:block">
              /
            </kbd>
            <button
              onClick={send}
              disabled={!value.trim()}
              aria-label="Ask"
              className="btn-primary h-8 w-8 shrink-0 !p-0"
            >
              <ArrowUp size={15} weight="bold" />
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
