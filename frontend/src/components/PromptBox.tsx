import { useRef, useEffect, useCallback } from "react";
import { ArrowUp } from "@phosphor-icons/react";

interface PromptBoxProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  disabled?: boolean;
  footnote?: string;
  placeholder?: string;
}

const MAX_H = 160;

export default function PromptBox({
  value,
  onChange,
  onSubmit,
  disabled,
  footnote,
  placeholder = "ask about a subject…",
}: PromptBoxProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_H)}px`;
  }, []);

  useEffect(resize, [value, resize]);

  function send() {
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
  }

  const hasContent = value.trim().length > 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 pt-10 sm:px-6"
      style={{ background: "linear-gradient(to top, var(--color-paper) 60%, transparent)" }}
    >
      <div className="mx-auto max-w-[860px]">
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-paper-2 px-4 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.07)] transition-all focus-within:border-ink/30 focus-within:shadow-[0_4px_28px_rgba(0,0,0,0.11)]">
          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={disabled}
            placeholder={placeholder}
            className="max-h-40 min-h-[28px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-2/50"
          />
          <div className="mb-0.5 flex items-center gap-2">
            <kbd className="hidden select-none text-[10px] tracking-wide text-ink-2/40 sm:block">
              {hasContent ? "⏎" : ""}
            </kbd>
            <button
              onClick={send}
              disabled={!hasContent || disabled}
              aria-label="Send"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-paper transition-all hover:bg-ink/85 disabled:opacity-15"
            >
              <ArrowUp size={16} weight="bold" />
            </button>
          </div>
        </div>
        {footnote && (
          <p className="mt-2 text-center font-mono text-[10px] tracking-wide text-ink-2/40">
            {footnote}
          </p>
        )}
      </div>
    </div>
  );
}
