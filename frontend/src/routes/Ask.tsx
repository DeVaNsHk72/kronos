import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  CalendarBlank as CalendarRange,
  ListChecks,
  ChatCircleText as MessageSquareText,
  Repeat as Repeat2,
} from "@phosphor-icons/react";
import { askChat, getStats, type ChatResponse, type ChatTurn, type Question } from "../api";
import QuestionCard from "../components/QuestionCard";
import ChatAnswer from "../components/ChatAnswer";
import ChatIntentPanel from "../components/ChatIntentPanel";
import { computeOverview, ChatStats, ChatAlsoAskedIn } from "../components/ChatOverview";
import PromptBox from "../components/PromptBox";

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

const STEPS = ["Parsing your question", "Searching the archive", "Ranking by similarity", "Composing an answer"];

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
        const text = i === 1 && totalQuestions ? `Searching ${totalQuestions.toLocaleString()} questions` : label;
        const done = i < step;
        const active = i === step;
        const last = i === visible.length - 1;
        return (
          <div key={label} className="flex gap-2.5">
            {/* dot + connecting line */}
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full transition-colors ${
                  done ? "bg-mark" : active ? "animate-pulse bg-mark" : "bg-line"
                }`}
              />
              {!last && (
                <span className="mt-0.5 w-0.5 flex-1 rounded-full bg-line" />
              )}
            </div>
            <span
              className={`pb-2 serif italic text-[13px] transition-opacity ${
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
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getStats().then((s) => setTotalQuestions(s.questions)).catch(() => {});
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
      const msg = e instanceof Error ? e.message : "Something went wrong";
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
    <div className="flex min-h-[calc(100svh-76px)] flex-col">
      <div className="mx-auto w-full max-w-[860px] flex-1 px-4 pb-40 pt-6 sm:px-6">
        {empty ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
            <div className="icon-badge">
              <MessageSquareText size={20} weight="regular" />
            </div>
            <h1 className="title-section mt-5">Ask the archive.</h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-2">
              Answers come only from papers that exist here. Every claim is
              numbered, and every number opens a real question.
            </p>
            <div className="mt-7 grid w-full max-w-md grid-cols-2 gap-2.5">
              {EXAMPLES.map(({ icon: Icon, label, q: ex }) => (
                <button
                  key={ex}
                  onClick={() => submit(ex)}
                  className="flex flex-col items-start gap-2 rounded-md border border-line bg-paper-2 px-3.5 py-3 text-left transition-colors hover:border-ink/25 hover:bg-paper"
                >
                  <Icon size={16} weight="regular" className="text-mark" />
                  <span className="text-[13px] font-medium leading-snug text-ink">{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {turns.map((t) => {
              const cited = t.response?.citations.length ?? 0;
              const results = t.response?.results ?? [];
              const shown = t.expanded ? results : results.slice(0, CARD_LIMIT);
              const overview = t.response ? computeOverview(results) : null;
              const canFollowUp = !t.asking && t.response?.answer;
              const courseCode = t.response?.intent.course_code;

              return (
                <div key={t.id} className="flex flex-col gap-3 border-t border-line pt-8 first:border-t-0 first:pt-0">
                  {/* user message — right-aligned bubble */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-[15px] leading-relaxed text-paper">
                      {t.question}
                    </div>
                  </div>

                  {/* assistant message */}
                  <div className="flex gap-3">
                    <div className="mt-0.5 icon-badge-sm shrink-0">
                      <MessageSquareText size={14} weight="regular" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 serif-note">
                        Paperbank
                      </p>

                      {t.asking && <RetrievalProgress totalQuestions={totalQuestions} />}

                      {t.error && (
                        <p className="py-1.5 text-sm text-mark">
                          Couldn't reach the archive. {t.error}
                        </p>
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
                              className="self-start text-xs font-medium text-blueprint hover:underline"
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

      <PromptBox
        value={q}
        onChange={setQ}
        onSubmit={submit}
        placeholder="ask about a subject — what repeats in thermodynamics?"
        footnote={`answers grounded in ${totalQuestions?.toLocaleString() ?? "…"} archived questions`}
      />
    </div>
  );
}
