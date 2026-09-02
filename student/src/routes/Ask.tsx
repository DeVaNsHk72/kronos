import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarBlank as CalendarRange,
  ListChecks,
  Repeat as Repeat2,
} from "@phosphor-icons/react";
import { askChat, type ChatResponse, type ChatTurn, type Question } from "../api";
import QuestionCard from "../components/QuestionCard";
import ChatAnswer from "../components/ChatAnswer";
import ChatIntentPanel from "../components/ChatIntentPanel";
import { computeOverview, ChatStats, ChatAlsoAskedIn } from "../components/ChatOverview";
import PromptBox from "../components/PromptBox";
import { archiveError } from "@/lib/utils";

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

interface Turn {
  id: number;
  question: string;
  response: ChatResponse | null;
  asking: boolean;
  error: string | null;
  expanded: boolean;
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
function RetrievalProgress() {
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
        const text = label;
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

  // The landing hands a question over in navigation state. Fired once — a
  // re-render must not re-ask it, and neither must a back-navigation.
  const handoff = (useLocation().state as { question?: string } | null)?.question;
  const fired = useRef(false);
  useEffect(() => {
    if (handoff && !fired.current) {
      fired.current = true;
      submit(handoff);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function submit(message: string) {
    const text = message.trim();
    if (!text) return;
    setQ("");

    const id = nextId++;
    const history: ChatTurn[] = turns
      .filter((t) => t.response?.answer)
      .flatMap((t) => [
        { role: "user" as const, content: t.question },
        { role: "assistant" as const, content: t.response!.answer! },
      ]);

    setTurns((ts) => [
      ...ts,
      { id, question: text, response: null, asking: true, error: null, expanded: false },
    ]);

    try {
      const res = await askChat(text, history);
      setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, response: res, asking: false } : t)));
    } catch (e) {
      const msg = archiveError(e);
      setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, error: msg, asking: false } : t)));
    }
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
      <div className="page w-full flex-1 pb-40 pt-8">
        <div className="mx-auto max-w-[860px]">
        {empty ? (
          /* At rest, the sheet shows what it is. The centred column of
             icon-and-label tiles is the arrangement every AI tool ships, and
             it says nothing before you have asked; a drawing at rest shows its
             dimensions, so this one does — measured figures in fixed slots,
             then the openers ruled into the same grid. */
          <div className="pt-6 pb-4">
            <h1 className="serif-display text-[clamp(2rem,4vw,2.9rem)] text-ink">
              What do you need to know?
            </h1>
            <p className="serif mt-3 max-w-[54ch] text-[14.5px] text-ink-2">
              Ask in plain words. Kronos writes the SQL, runs it, and shows you both.
            </p>

            <ul className="mt-10 border-t border-line">
              {EXAMPLES.map(({ icon: Icon, label, q: ex }) => (
                <li key={ex} className="border-b border-line">
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
                    <span className="draft-caps opacity-0 transition-opacity duration-150 group-hover:opacity-100">
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
                      {t.asking && <RetrievalProgress />}

                      {t.error && (
                        <p className="py-1.5 text-sm text-mark">{t.error}</p>
                      )}

                      {!t.asking && t.response?.answer && (
                        <>
                          <ChatIntentPanel intent={t.response.intent} />
                          <ChatAnswer
                            answer={t.response.answer}
                            citations={t.response.citations}
                            onJump={(n) => jump(t.id, n)}
                          />
                        </>
                      )}

                      {!t.asking && overview && overview.total > 0 && (
                        <ChatStats o={overview} />
                      )}

                      {!t.asking && results.length > 0 && (
                        <div className="mt-4 flex flex-col gap-2.5">
                          {shown.map((res, i) => {
                            const n = i < cited ? i + 1 : undefined;
                            const citeId = n ? `cite-t${t.id}-${n}` : undefined;
                            return (
                              <QuestionCard
                                key={res.id}
                                q={res}
                                n={n}
                                citeId={citeId}
                                flash={citeId ? flash === citeId : false}
                                matchReasons={t.response ? matchReasons(res, t.response) : undefined}
                              />
                            );
                          })}
                          {!t.expanded && results.length > CARD_LIMIT && (
                            <button
                              onClick={() => expand(t.id)}
                              className="self-start text-xs font-medium text-ink-2 transition-colors duration-150 hover:text-ink hover:underline"
                            >
                              Show {results.length - CARD_LIMIT} more
                            </button>
                          )}
                        </div>
                      )}

                      {!t.asking && overview && <ChatAlsoAskedIn o={overview} />}

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

      <PromptBox
        value={q}
        onChange={setQ}
        onSubmit={submit}
        placeholder="Ask Kronos — what repeats in thermodynamics?"
        footnote="Every answer shows the SQL it ran, and every row cites the paper it came from"
      />
    </div>
  );
}
