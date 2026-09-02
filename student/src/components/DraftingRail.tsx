import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ChatCircleText,
  MagnifyingGlass,
  ListChecks,
  BookOpen,
  ChartBar,
  DownloadSimple,
  Gauge,
  FilePlus,
  Archive,
  List as ListIcon,
  X,
  Command as CommandIcon,
} from "@phosphor-icons/react";
import CommandK from "./CommandK";
import { fmt } from "@/lib/utils";

/**
 * The margin of the drawing.
 *
 * Every engineering drawing carries its navigation in the same two places: a
 * ruled margin down one edge, and a title block stamped in the corner saying
 * what the sheet is, what revision it is at, and who is answerable for it. So
 * the app's chrome is not a bar floating above the content — it is the frame
 * the content is drawn inside, and the title block at the bottom carries the
 * archive's real dimensions rather than a logo.
 *
 * This is deliberately not the thread rail the category ships. A list of past
 * conversation titles would say what you asked; this says what the archive is,
 * which is the thing a student actually needs before they know what to ask.
 */

const STUDENT = [
  { to: "/ask", label: "Ask", Icon: ChatCircleText, end: true },
  { to: "/ask/search", label: "Search", Icon: MagnifyingGlass },
  { to: "/ask/practice", label: "Practice", Icon: ListChecks },
  { to: "/ask/notes", label: "Notes", Icon: BookOpen },
  { to: "/stats", label: "Patterns", Icon: ChartBar },
  { to: "/download", label: "Papers", Icon: DownloadSimple },
];

const FACULTY = [
  { to: "/faculty", label: "Dashboard", Icon: Gauge, end: true },
  { to: "/faculty/generate", label: "Set a paper", Icon: FilePlus },
  { to: "/faculty/bank", label: "Question bank", Icon: Archive },
];

function RailLink({
  to,
  label,
  Icon,
  end,
  onNavigate,
}: {
  to: string;
  label: string;
  Icon: typeof ChatCircleText;
  end?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors duration-150 ${
          isActive ? "text-ink" : "text-ink-2 hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* The station mark: on a drawing, the active position on a rule is
              ticked, not highlighted. */}
          <span
            aria-hidden
            className={`absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 transition-[background-color,height] duration-150 ${
              isActive ? "bg-ink" : "bg-transparent group-hover:bg-line"
            }`}
          />
          <Icon size={15} weight={isActive ? "fill" : "regular"} className="shrink-0" />
          <span className={isActive ? "font-medium" : undefined}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

/** The stamp in the corner of the sheet. Every number in it is a real one. */
function TitleBlock({ questions, subjects, papers, years }: {
  questions: number | null; subjects: number | null; papers: number | null;
  years: [number, number] | null;
}) {
  const cells: [string, string][] = [
    ["Subjects", fmt(subjects)],
    // Measured, never written by hand: the span the data actually covers.
    ["Years", years ? `${years[0]}\u2013${years[1]}` : "\u2014"],
    ["Questions", fmt(questions)],
    ["Papers", fmt(papers)],
  ];
  return (
    <div className="border-t border-line">
      <div className="grid grid-cols-2">
        {cells.map(([k, v], i) => (
          <div
            key={k}
            className={`px-3 py-2 ${i % 2 === 0 ? "border-r border-line" : ""} ${
              i < 2 ? "border-b border-line" : ""
            }`}
          >
            <div className="label-cap">{k}</div>
            <div className="mt-1 font-mono text-[12px] tabular-nums leading-none text-ink">{v}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-3 py-2">
        <div className="label-cap">Source</div>
        <div className="draft-note mt-0.5">B.M.S. College of Engineering</div>
      </div>
    </div>
  );
}

export default function DraftingRail({
  questions,
  subjects,
  papers,
  years,
}: {
  questions: number | null;
  subjects: number | null;
  papers: number | null;
  years: [number, number] | null;
}) {
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();

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

  // A route change closes the drawer; leaving it open over the new screen is
  // the single most common mobile-nav defect. Adjusted during render rather
  // than in an effect, so back/forward navigation closes it too and it never
  // paints once in the wrong state.
  const [drawerAt, setDrawerAt] = useState(loc.pathname);
  if (drawerAt !== loc.pathname) {
    setDrawerAt(loc.pathname);
    if (drawer) setDrawer(false);
  }

  const body = (
    <>
      <div className="flex items-center gap-2 border-b border-line px-3 py-3">
        <NavLink to="/welcome" className="wordmark text-[13px] text-ink">
          Kronos
        </NavLink>
        <span aria-hidden className="ml-auto h-[7px] w-[7px] bg-ink-2" />
      </div>

      <nav className="flex-1 overflow-y-auto thin-scroll py-3">
        <div className="label-cap px-3 pb-1.5">Studying</div>
        {STUDENT.map((l) => (
          <RailLink key={l.to} {...l} onNavigate={() => setDrawer(false)} />
        ))}

        <div className="label-cap mt-5 px-3 pb-1.5">Teaching</div>
        {FACULTY.map((l) => (
          <RailLink key={l.to} {...l} onNavigate={() => setDrawer(false)} />
        ))}
      </nav>

      <button
        onClick={() => setCmdkOpen(true)}
        className="mx-3 mb-3 flex items-center gap-2 border border-line px-2.5 py-1.5 text-[11px] text-ink-2 transition-colors duration-150 hover:border-ink-2 hover:text-ink"
      >
        <CommandIcon size={12} weight="bold" />
        <span className="font-mono">K</span>
        <span className="ml-auto">Jump to…</span>
      </button>

      <TitleBlock questions={questions} subjects={subjects} papers={papers} years={years} />
    </>
  );

  return (
    <>
      {/* Desktop: the margin is part of the sheet, so it is a fixed column with
          a single rule down its edge — not a panel with a shadow. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[228px] flex-col border-r border-line bg-paper/92 backdrop-blur-sm lg:flex">
        {body}
      </aside>

      {/* Mobile: the same margin, folded away. */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-13 items-center gap-3 border-b border-line bg-paper/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <button
          onClick={() => setDrawer(true)}
          aria-label="Open navigation"
          className="grid h-8 w-8 place-items-center text-ink"
        >
          <ListIcon size={18} />
        </button>
        <NavLink to="/welcome" className="wordmark text-[12px] text-ink">
          Kronos
        </NavLink>
        <button
          onClick={() => setCmdkOpen(true)}
          aria-label="Open command palette"
          className="ml-auto grid h-8 w-8 place-items-center text-ink-2"
        >
          <CommandIcon size={15} weight="bold" />
        </button>
      </header>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-[#04101c]/70"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[262px] flex-col border-r border-line bg-paper">
            <button
              onClick={() => setDrawer(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-2.5 grid h-8 w-8 place-items-center text-ink-2"
            >
              <X size={16} />
            </button>
            {body}
          </aside>
        </div>
      )}

      <CommandK open={cmdkOpen} onOpenChange={setCmdkOpen} />
    </>
  );
}
