"use client";
import { useState } from "react";
import { cn } from "@/lib/util";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded", className)} />;
}

export function Tile({
  label, value, sub, tone = "normal", onClick,
}: {
  label: string; value: string | number; sub?: string;
  tone?: "normal" | "warn"; onClick?: () => void;
}) {
  const Cmp = onClick ? "button" : "div";
  return (
    <Cmp onClick={onClick}
      className={cn(
        "text-left border rounded-lg bg-paper-2 px-4 py-3 flex flex-col gap-1",
        onClick && "hover:border-ink-2 transition-colors cursor-pointer")}>
      <span className="text-[11px] uppercase tracking-wider text-ink-2">{label}</span>
      <span className={cn("mono text-2xl leading-none",
        tone === "warn" ? "text-mark" : "text-ink")}>{value}</span>
      {sub && <span className="text-[11px] text-ink-2 leading-snug">{sub}</span>}
    </Cmp>
  );
}

/** Every number in the console can show the statement that produced it. */
export function SqlToggle({ sql, ms, backend }: { sql: string; ms?: number; backend?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)}
        className="mono text-[10px] uppercase tracking-widest text-ink-2 hover:text-mark">
        {open ? "hide sql" : "show sql"}
        {ms !== undefined && <span className="ml-2 normal-case">· {ms}ms · {backend}</span>}
      </button>
      {open && (
        <pre className="mt-2 p-3 rounded border bg-paper text-[11px] leading-relaxed
                        overflow-x-auto mono text-ink-2 whitespace-pre">{sql.trim()}</pre>
      )}
    </div>
  );
}

export function Banner({ tone = "warn", children }: {
  tone?: "warn" | "info"; children: React.ReactNode;
}) {
  return (
    <div className={cn(
      "border-l-2 pl-3 py-2 text-[13px] leading-relaxed rounded-r",
      tone === "warn"
        ? "border-mark bg-mark/[0.06] text-ink"
        : "border-ink-2 bg-line-2/50 text-ink-2")}>
      {children}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed rounded-lg py-12 text-center">
      <p className="serif text-lg text-ink">{title}</p>
      {hint && <p className="text-[13px] text-ink-2 mt-1 max-w-md mx-auto">{hint}</p>}
    </div>
  );
}
