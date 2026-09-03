import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarBlank as CalendarRange,
  ListChecks,
  Repeat as Repeat2,
} from "@phosphor-icons/react";
import { getStats, type ChatResponse, type ChatTurn, type Question, type Stats } from "../api";
import { askGenie } from "../facultyApi";
import QuestionCard from "../components/QuestionCard";
import ChatAnswer from "../components/ChatAnswer";
import ChatIntentPanel from "../components/ChatIntentPanel";
import { computeOverview, ChatStats, ChatAlsoAskedIn } from "../components/ChatOverview";
import { archiveError, fmt } from "@/lib/utils";

const EXAMPLES = [
  {
    icon: Repeat2,
    label: "What repeats most?",
    q: "what repeats in operating systems deadlock questions?",
  },
  { icon: BookOpen, label: "Laplace transform, 2023", q: "laplace transform questions from 2023" },
  {
    icon: ListChecks,
    label: "Plan a revision",
    q: "what should I revise for engineering maths 1?",
  },
  { icon: CalendarRange, label: "Last 3 years, one topic", q: "thermodynamics questions from the last 3 years" },
];

const STEPS = ["Reading your question", "Writing the SQL", "Running it", "Composing an answer"];

interface GenieResult {
  answer: string;
  rows: Question[];
  sql?: string;
}

interface Turn {
  id: number;
  question: string;
  response: ChatResponse | null;
  genie: GenieResult | null;
  asking: boolean;
  error: string | null;
  expanded: boolean;
}

/** Map a Genie row (Databricks columns) to our Question shape. */
function genieRowToQuestion(row: Record<string, any>, i: number): Question {
  return {
    id: row.question_id ? Number(String(row.question_id).replace(/\D/g, "").slice(0, 9)) : 900000 + i,
    sha: String(row.question_id ?? i),
    unit: row.unit_no != null ? Number(row.unit_no) : null,
    qno: null,
    subpart: null,
    question_md: row.question_text ?? "",
    marks: row.marks != null ? Number(row.marks) : null,
    co: null,
    po: null,
    course_code: row.subject_code ?? "",
    course_name: row.subject_name ?? "",
    program: "",
    semester: row.semester != null ? Number(row.semester) : null,
    year: row.exam_year != null ? Number(row.exam_year) : null,
    exam_type: row.exam_type ?? "",
    branch: row.branch ?? "",
    topic: row.topic_name ?? null,
    subtopic: null,
    images: [],
    download_url: "",
    score: undefined,
  };
}

/** Render simple markdown (bold, bullets, line breaks) to JSX. */
function SimpleMd({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];

  function bold(s: string, key: number) {
    // split on **…** and render <strong>
    return s.split(/\*\*(.+?)\*\*/g).map((part, j) =>
      j % 2 === 1 ? <strong key={`${key}-${j}`} className="font-semibold text-ink">{part}</strong> : part
    );
  }

  function flushList() {
    if (!listItems.length) return;
    elements.push(<ul key={`ul-${elements.length}`} className="my-1.5 list-disc space-y-1 pl-5">{listItems}</ul>);
    listItems = [];
  }

  lines.forEach((line, i) => {
    const bullet = line.match(/^[-•]\s+(.*)/);
    if (bullet) {
      listItems.push(<li key={i}>{bold(bullet[1], i)}</li>);
    } else {
      flushList();
      if (line.trim()) elements.push(<p key={i} className="my-1">{bold(line, i)}</p>);
    }
  });
  flushList();

  return <div className="text-[14px] leading-relaxed text-ink-2">{elements}</div>;
}

let nextId = 1;

/** Which resolved-intent fields this question actually matches — real
 *  comparisons against the intent the backend returned, not guesses. */
function matchReasons(q: Question, response: ChatResponse): string[] {
  const { intent } = response;
  const out: string[] = [];
  if (intent.course_code && q.course_code === intent.course_code) out.push("Course");
  if (intent.branch && q.branch === intent.branch) out.push("Branch");
  if (intent.unit != null && q.unit === intent.unit) out.push("Unit");
  if (intent.exam_type && q.exam_type === intent.exam_type) out.push("Exam type");
  if (q.year != null) {
    const lo = intent.year_min ?? -Infinity;
    const hi = intent.year_max ?? Infinity;
    if (q.year >= lo && q.year <= hi && (intent.year_min || intent.year_max)) out.push("Year");
  }
  out.push("Similarity");
  return out;
}

/** Cycles through generic retrieval steps while the single chat request is
 *  in flight. The backend doesn't stream real pipeline state, so this can't
 *  report true intermediate counts — it advances on a timer and holds on the
 *  last step until the response actually lands. */
function RetrievalProgress({ totalQuestions }: { totalQuestions: number | null }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= STEPS.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), 550);
    return () => clearTimeout(t);
  }, [step]);

  const visible = STEPS.slice(0, step + 1);

  return (
    <div className="flex flex-col py-1.5">
      {visible.map((label, i) => {
        const text = i === 1 && totalQuestions ? `Searching ${fmt(totalQuestions)} questions` : label;
        const done = i < step;
        const active = i === step;
        const last = i === visible.length - 1;
        return (
          <div key={label} className="flex gap-2.5">
            {/* dot + connecting line */}
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-sm transition-colors ${
                  done ? "bg-mark" : active ? "animate-pulse bg-mark" : "bg-line"
                }`}
              />
              {!last && (
                <span className="mt-0.5 w-0.5 flex-1 rounded-sm bg-line" />
              )}
            </div>
            <span
              className={`pb-2 text-[13px] transition-opacity ${
                active ? "text-ink-2" : "text-ink-2/50"
              }`}
            >
              {text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Ask() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [dims, setDims] = useState<Stats | null>(null);
  const totalQuestions = dims?.questions ?? null;

  const locState = useLocation().state as { question?: string; ts?: number } | null;
  const lastTs = useRef(0);
  useEffect(() => {
    if (locState?.question && locState.ts && locState.ts !== lastTs.current) {
      lastTs.current = locState.ts;
      submit(locState.question);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locState?.ts]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getStats().then(setDims).catch(() => setDims(null));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function submit(message: string) {
    const text = message.trim();
    if (!text) return;
    setQ("");

    const id = nextId++;

    setTurns((ts) => [
      ...ts,
      { id, question: text, response: null, genie: null, asking: true, error: null, expanded: false },
    ]);

    // Fire Genie only
    let genie: GenieResult | null = null;
    let error: string | null = null;
    try {
      const g: any = await askGenie(text);
      if (g?.rows?.length) {
        const MIN_Q_LEN = 30;
        const rows = (g.rows as Record<string, any>[])
          .map(genieRowToQuestion)
          .filter((q) => q.question_md.length >= MIN_Q_LEN);
        if (rows.length) {
          genie = { answer: g.answer ?? "", rows, sql: g.sql };
        } else {
          genie = { answer: g.answer ?? "", rows: [], sql: g.sql };
        }
      } else {
        error = g?.answer || "Genie returned no results.";
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.message ?? "Unknown error";
      error = `Genie error: ${detail}`;
      console.error("askGenie failed:", e);
    }

    setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, genie, error, asking: false } : t)));
  }

  function jump(turnId: number, n: number) {
    const domId = `cite-t${turnId}-${n}`;
    const el = document.getElementById(domId);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    setFlash(domId);
    window.setTimeout(() => setFlash((f) => (f === domId ? null : f)), 1600);
  }

  function expand(id: number) {
    setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, expanded: true } : t)));
  }

  const empty = turns.length === 0;
  const CARD_LIMIT = 6;

  return (
    <div className="flex min-h-[calc(100svh-56px)] flex-col">
      <div className="page w-full flex-1 pt-8">
        <div className="mx-auto max-w-[860px]">
        {empty ? (
          /* At rest, the sheet shows what it is. The centred column of
             icon-and-label tiles is the arrangement every AI tool ships, and
             it says nothing before you have asked; a drawing at rest shows its
             dimensions, so this one does — measured figures in fixed slots,
             then the openers ruled into the same grid. */
          <div className="pt-6 pb-4">
            <h1 className="title-page">
              What do you need to know?
            </h1>

            {/* The drawing's dimension block. Every figure is measured, every
                slot holds its position whether or not the archive answered. */}
            <dl className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Questions", dims?.questions],
                ["Papers", dims?.papers],
                ["Subjects", dims?.courses],
                ["Topics", dims?.topics],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="label-cap">{label}</dt>
                  <dd className="mt-1.5 font-mono text-[15px] tabular-nums leading-none text-ink">
                    {value != null ? fmt(value) : <span className="inline-block h-4 w-12 animate-pulse rounded bg-line" />}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="label-cap mt-2">
              {dims?.year_range
                ? `${dims.year_range[0]}\u2013${dims.year_range[1]}`
                : <span className="inline-block h-3 w-16 animate-pulse rounded bg-line" />}
            </p>

            <ul className="mt-9 flex flex-col gap-1">
              {EXAMPLES.map(({ icon: Icon, label, q: ex }) => (
                <li key={ex}>
                  <button
                    onClick={() => submit(ex)}
                    className="group flex w-full items-center gap-3 py-3 text-left transition-colors duration-150"
                  >
                    <Icon
                      size={15}
                      weight="regular"
                      className="shrink-0 text-ink-2 transition-colors duration-150 group-hover:text-ink"
                    />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-ink-2 transition-colors duration-150 group-hover:text-ink">
                      {label}
                    </span>
                    <span className="label-cap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      Ask
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {turns.map((t, i) => {
              const cited = t.response?.citations.length ?? 0;
              const results = t.response?.results ?? [];
              const shown = t.expanded ? results : results.slice(0, CARD_LIMIT);
              const overview = t.response ? computeOverview(results) : null;
              const canFollowUp = !t.asking && t.response?.answer;
              const courseCode = t.response?.intent.course_code;

              return (
                <div key={t.id} className="flex flex-col gap-3 border-t border-line pt-8 first:border-t-0 first:pt-0">
                  {/* The question, written on the sheet. A bubble floating to
                      the right is the category's arrangement and it puts the
                      thing being asked furthest from the evidence answering
                      it; here the turn is numbered in the margin the way a
                      question is numbered on a paper, and the question and its
                      answer sit in one column. */}
                  <div className="flex gap-3 sm:gap-5">
                    <div
                      aria-hidden
                      className="draft-dim w-8 shrink-0 pt-[3px] text-right sm:w-10"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <p className="min-w-0 flex-1 text-[17px] font-medium leading-snug text-ink">
                      {t.question}
                    </p>
                  </div>

                  {/* assistant message */}
                  <div className="flex gap-3 sm:gap-5">
                    {/* The margin rule continues down the answer, so the whole
                        turn reads as one measured block. */}
                    <div aria-hidden className="w-8 shrink-0 sm:w-10">
                      <div className="ml-auto h-full w-px bg-line" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {t.asking && <RetrievalProgress totalQuestions={totalQuestions} />}

                      {t.error && (
                        <p className="py-1.5 text-sm text-mark">{t.error}</p>
                      )}

                      {/* Genie results */}
                      {!t.asking && t.genie && (
                        <div className="mt-4">
                          {t.genie.rows.length > 0 && (
                            <p className="label-cap mb-3">From Genie · {t.genie.rows.length} results</p>
                          )}
                          {t.genie.answer && (
                            <div className="mb-3"><SimpleMd text={t.genie.answer} /></div>
                          )}
                          <div className="flex flex-col gap-2.5">
                            {t.genie.rows.slice(0, t.expanded ? undefined : CARD_LIMIT).map((gq) => (
                              <QuestionCard key={gq.sha} q={gq} />
                            ))}
                            {!t.expanded && t.genie.rows.length > CARD_LIMIT && (
                              <button
                                onClick={() => expand(t.id)}
                                className="self-start text-xs font-medium text-ink-2 transition-colors duration-150 hover:text-ink hover:underline"
                              >
                                Show {t.genie.rows.length - CARD_LIMIT} more from Genie
                              </button>
                            )}
                          </div>
                          {t.genie.sql && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-[11px] text-ink-2 hover:text-ink">Show SQL</summary>
                              <pre className="mt-1 overflow-x-auto rounded-[var(--r-sm)] bg-paper-2 p-3 font-mono text-[11px] text-ink-2">{t.genie.sql}</pre>
                            </details>
                          )}
                        </div>
                      )}

                      {canFollowUp && (
                        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
                          <button
                            onClick={() => submit(`${t.question} — Main exams only`)}
                            className="chip hover:border-ink-2/50 hover:text-ink"
                          >
                            Only Main exams
                          </button>
                          <button
                            onClick={() => submit(`${t.question} — from the last 2 years only`)}
                            className="chip hover:border-ink-2/50 hover:text-ink"
                          >
                            Last 2 years only
                          </button>
                          {courseCode && (
                            <button
                              onClick={() => navigate(`/stats?course=${encodeURIComponent(courseCode)}`)}
                              className="chip hover:border-ink-2/50 hover:text-ink"
                            >
                              Open statistics
                            </button>
                          )}
                          {courseCode && (
                            <button
                              onClick={() => navigate(`/download?codes=${encodeURIComponent(courseCode)}`)}
                              className="chip hover:border-ink-2/50 hover:text-ink"
                            >
                              Download these papers
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
        </div>
      </div>

    </div>
  );
}
