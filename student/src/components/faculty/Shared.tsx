import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { CaretDown } from "@phosphor-icons/react";
import { runQuery, type Subject } from "../../facultyApi";
import { archiveError, cn } from "../../lib/utils";

/** Semesters 1-4 of the CSE track, and nothing else.
 *
 *  `dim_subject.branch` cannot carry this on its own: semesters 1-2 are the
 *  common first year (branch "Common") and the sem 3-4 CS core is stored under
 *  the AI&ML scheme it was digitised from. Semester is therefore the reliable
 *  bound, with the branch check only there to keep a later non-CS import from
 *  appearing. Everything from semester 5 up is out of scope. */
const CS_BRANCH = /computer|information|common|artificial intelligence/i;

export function subjectsInScope(rows: Subject[]): Subject[] {
  return rows
    .filter((s) => {
      const sem = Number(s.semester);
      return sem >= 1 && sem <= 4 && CS_BRANCH.test(s.branch ?? "");
    })
    .sort((a, b) =>
      Number(a.semester) - Number(b.semester) ||
      a.subject_name.localeCompare(b.subject_name));
}

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    runQuery("subjects")
      .then((r) => setSubjects(subjectsInScope(r.rows as unknown as Subject[])))
      .catch((e) => setErr(e?.response?.data?.detail ?? archiveError(e)));
  }, []);
  return { subjects, err };
}

export function SubjectPicker({ subjects, value, onChange, failed }: {
  subjects: Subject[] | null; value: string; onChange: (v: string) => void;
  /** The request finished and did not answer. Distinct from `subjects === null`,
   *  which means it is still in flight — a picker that says "Loading…" forever
   *  after a failure is telling the user to keep waiting for nothing. */
  failed?: boolean;
}) {
  const empty = failed || subjects?.length === 0;
  return (
    /* A native select renders the platform's own arrow and menu chrome, which
       on this sheet is the one control that belongs to no design system. The
       glyph is drawn here and the select laid transparently over it. */
    <div className="relative w-[280px] max-w-full">
      <select
        aria-label="Subject"
        value={value}
        disabled={empty}
        onChange={(e) => onChange(e.target.value)}
        className="field w-full appearance-none bg-paper-2 pr-8 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {failed && <option>Not answered</option>}
        {!failed && !subjects && <option>Loading…</option>}
        {!failed && subjects?.length === 0 && <option>No subjects in scope</option>}
        {!failed && subjects?.map((s) => (
          <option key={s.subject_key} value={s.subject_key}>
            Sem {s.semester} · {s.subject_name}
          </option>
        ))}
      </select>
      <CaretDown
        size={13}
        weight="bold"
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-2"
      />
    </div>
  );
}

export function Tile({ label, value, tone = "normal" }: {
  label: string; value: string | number; tone?: "normal" | "warn";
}) {
  return (
    /* A cell in a ruled block, not a card in a row: the borders belong to the
       grid the tiles sit in (see TileRow), so five figures read as one
       measured strip the way a title block does. */
    <div className="flex flex-col gap-1.5 border-b border-r border-line px-4 py-3">
      <span className="label-cap">{label}</span>
      <span className={cn("font-mono text-2xl leading-none tabular-nums",
        tone === "warn" ? "text-warn" : "text-ink")}>{value}</span>
    </div>
  );
}

/** The block the tiles are ruled into. Owns the outer top and left rules so
 *  the cells only ever draw their own bottom and right. */
export function TileRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 border-l border-t border-line md:grid-cols-5">
      {children}
    </div>
  );
}

/** The one panel wrapper. Every bordered box on every screen is this, so the
 *  radius, ground and padding cannot drift apart screen by screen. */
export function Panel({ title, children, className }: {
  title?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("card p-5", className)}>
      {title && <h2 className="title-section mb-4">{title}</h2>}
      {children}
    </section>
  );
}

/** Every number can show the statement that produced it. */
export function SqlToggle({ sql, ms, engine, fallbackReason }: {
  sql?: string; ms?: number; engine?: string; fallbackReason?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!sql) return null;
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)}
        className="font-mono text-[10px] uppercase tracking-widest text-ink-2 hover:text-mark">
        {open ? "hide sql" : "show the sql genie wrote"}
        {ms !== undefined && <span className="ml-2">· {(ms / 1000).toFixed(1)}s</span>}
        {engine && <span className="ml-2">· {engine === "genie" ? "genie" : "sql fallback"}</span>}
      </button>
      {fallbackReason && (
        <p className="text-[10px] text-warn mt-1">Genie unavailable: {fallbackReason}</p>
      )}
      <div className="disclosure" data-open={open}>
        <div>
          <pre className="mt-2 p-3 rounded border border-line bg-paper text-[11px]
            leading-relaxed overflow-x-auto font-mono text-ink-2 whitespace-pre">{sql.trim()}</pre>
        </div>
      </div>
    </div>
  );
}

export function Banner({ children }: { children: React.ReactNode }) {
  return <div className="border-l border-mark bg-mark/[0.06] pl-3 py-2 text-[13px]
    leading-relaxed rounded-r text-ink">{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-line-2 rounded", className)} />;
}

export function Empty({ title }: { title: string }) {
  return (
    <div className="border border-dashed border-line rounded-sm py-12 text-center">
      <p className="text-[14px] text-ink-2">{title}</p>
    </div>
  );
}

const FACULTY_TABS = [
  { to: "/faculty", label: "Overview", end: true },
  { to: "/faculty/generate", label: "Generate" },
  { to: "/faculty/practice", label: "Practice" },
  { to: "/faculty/bank", label: "Bank" },
];

/** Same shape as the student side's tab strip, so the two halves of the app
 *  navigate identically. */
export function FacultyNav() {
  return (
    <nav className="tabstrip page no-print">
      {FACULTY_TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end}
          className={({ isActive }) => cn("tab", isActive && "tab-on")}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Title left, controls right. No blurb slot: a paragraph explaining a screen
 *  above every screen is read once and skipped forever after. */
export function PageHead({ title, right }: {
  title: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 flex-wrap mb-6">
      <h1 className="title-page">{title}</h1>
      {right}
    </div>
  );
}
