import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkle } from "@phosphor-icons/react";

/**
 * The agent, reachable from anywhere.
 *
 * "The agent is the app" is a claim about reach, not about layout: if the only
 * way to ask is to navigate to the asking screen, the app is a chat page with
 * some other pages beside it. So every screen that is not the thread itself
 * carries the composer along its bottom edge, and asking from the middle of
 * the question bank hands the question to the thread rather than losing it.
 *
 * It is drawn as the sheet's bottom margin — a ruled strip the width of the
 * content, with the caret in the accent — rather than a floating pill, because
 * nothing else in this world floats.
 */
export default function GlobalComposer({ onAsk }: { onAsk: (q: string) => void }) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  // "/" focuses the composer from any screen, the way it does in every tool
  // whose primary verb is asking. Ignored while the user is already typing.
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

  return (
    <div
      className="no-print fixed inset-x-0 bottom-0 z-30 lg:pl-[228px]"
      style={{
        background:
          "linear-gradient(to top, var(--color-paper) 62%, color-mix(in srgb, var(--color-paper) 0%, transparent))",
      }}
    >
      <div className="page pb-4 pt-8">
        <div className="mx-auto flex max-w-[880px] items-center gap-2 border border-line bg-paper-2 px-3 py-2 transition-colors duration-150 focus-within:border-ink">
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
          <kbd className="draft-caps hidden select-none border border-line px-1.5 py-1 sm:block">
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
        </div>
      </div>
    </div>
  );
}
