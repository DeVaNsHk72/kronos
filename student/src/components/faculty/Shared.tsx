import { useEffect, useState } from "react";
import { runQuery, type Subject } from "../../facultyApi";
import { cn } from "../../lib/utils";

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    runQuery("subjects")
      .then((r) => setSubjects(r.rows as unknown as Subject[]))
      .catch((e) => setErr(e?.response?.data?.detail ?? String(e)));
  }, []);
  return { subjects, err };
}

export function SubjectPicker({ subjects, value, onChange }: {
  subjects: Subject[] | null; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="subj" className="text-[11px] uppercase tracking-wider text-ink-2">Subject</label>
      <select id="subj" value={value} onChange={(e) => onChange(e.target.value)}
        className="border border-line rounded-md bg-paper-2 px-3 py-1.5 text-[14px] text-ink min-w-[260px]">
        {!subjects && <option>Loading…</option>}
        {subjects?.map((s) => (
          <option key={s.subject_key} value={s.subject_key}>
            {s.subject_name} — {s.questions.toLocaleString()}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Tile({ label, value, sub, tone = "normal" }: {
  label: string; value: string | number; sub?: string; tone?: "normal" | "warn";
}) {
  return (
    <div className="border border-line rounded-lg bg-paper-2 px-4 py-3 flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-ink-2">{label}</span>
      <span className={cn("font-mono text-2xl leading-none tabular-nums",
        tone === "warn" ? "text-mark" : "text-ink")}>{value}</span>
      {sub && <span className="text-[11px] text-ink-2 leading-snug">{sub}</span>}
    </div>
  );
}

/** Every number can show the statement that produced it. */
export function SqlToggle({ sql, ms }: { sql?: string; ms?: number }) {
  const [open, setOpen] = useState(false);
  if (!sql) return null;
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)}
        className="font-mono text-[10px] uppercase tracking-widest text-ink-2 hover:text-mark">
        {open ? "hide sql" : "show sql"}{ms !== undefined && <span className="ml-2">· {ms}ms</span>}
      </button>
      {open && <pre className="mt-2 p-3 rounded border border-line bg-paper text-[11px]
        leading-relaxed overflow-x-auto font-mono text-ink-2 whitespace-pre">{sql.trim()}</pre>}
    </div>
  );
}

export function Banner({ children }: { children: React.ReactNode }) {
  return <div className="border-l-2 border-mark bg-mark/[0.06] pl-3 py-2 text-[13px]
    leading-relaxed rounded-r text-ink">{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-line-2 rounded", className)} />;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border border-dashed border-line rounded-lg py-12 text-center">
      <p className="serif text-lg text-ink">{title}</p>
      {hint && <p className="text-[13px] text-ink-2 mt-1 max-w-md mx-auto">{hint}</p>}
    </div>
  );
}

export function PageHead({ title, blurb, right }: {
  title: string; blurb?: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
      <div>
        <h1 className="serif-display text-4xl text-ink">{title}</h1>
        {blurb && <p className="text-[13px] text-ink-2 mt-2 max-w-2xl">{blurb}</p>}
      </div>
      {right}
    </div>
  );
}
