import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUp } from "@phosphor-icons/react";
import { getStats, type Stats } from "@/api";
import { HOME, setRole } from "@/lib/role";
import { fmt } from "@/lib/utils";

/**
 * The welcome sheet.
 *
 * No longer the entry point — the gate is — but the page that says what this
 * is, reachable from the gate and from the wordmark. Plain ground, the claim,
 * the first action, and the measured size of what it reasons over.
 *
 * There is no "get started": the first action is the product's only verb.
 */

export default function Landing() {
  const nav = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // One source for the figures, the same one the title block reads, so the
    // two never disagree about the size of the archive.
    getStats().then(setStats).catch(() => setStats(null));
  }, []);

  function ask(text?: string) {
    const question = (text ?? q).trim();
    if (!question) return;
    setRole("student");
    nav(HOME.student, { state: { question } });
  }

  const openers = [
    "I have the Cloud Computing exam in three days, where do I start?",
    "What repeats in Operating Systems deadlock questions?",
    "Which units carry the most marks in Engineering Maths II?",
  ];

  return (
    <div className="relative min-h-screen">
      {/* The drawing frame: corner ticks at the edge of the sheet. */}
      <div aria-hidden className="pointer-events-none absolute inset-5 hidden sm:block">
        {[
          "left-0 top-0 border-l border-t",
          "right-0 top-0 border-r border-t",
          "left-0 bottom-0 border-l border-b",
          "right-0 bottom-0 border-r border-b",
        ].map((c) => (
          <span key={c} className={`absolute h-4 w-4 border-line ${c}`} />
        ))}
      </div>

      <div className="relative flex min-h-screen w-full max-w-full flex-col px-5 py-6 sm:px-10 sm:py-7">
        <header className="flex items-baseline gap-3">
          <span className="wordmark text-[15px] text-ink">Kronos</span>
          <span aria-hidden className="h-[7px] w-[7px] translate-y-[-2px] bg-ink-2" />
          {/* Sheet identity belongs in the frame, the way a drawing stamps it —
              not stacked above the headline as a label the heading does not need. */}
          <span className="draft-caps ml-auto hidden sm:block">
            Rev. 2026 · Sheet 1 of 1 · B.M.S. College of Engineering
          </span>
        </header>

        <main className="flex min-w-0 max-w-[640px] flex-1 flex-col justify-end py-10 sm:justify-center sm:py-12">
          <div>
            {/* The break is authored, not left to the measure: three lines at
                every width, so the sheet's proportions hold from 390 to 1600. */}
            <h1 className="serif-display text-[clamp(2.2rem,6.4vw,5.2rem)] text-ink">
              An agent whose
              <br />
              brain is your
              <br />
              <span className="text-mark">college's exams.</span>
            </h1>
          </div>

          <p className="serif mt-6 max-w-[54ch] text-[15.5px] text-ink-2">
            Not a chatbot over a folder of PDFs. Ask in plain words; Kronos writes SQL over
            governed tables built from this college's own papers, and shows you the query.
          </p>

          {/* The first action is the product's only verb. */}
          <div className="mt-8 w-full max-w-[680px]">
            <div className="flex items-end gap-2 border border-line bg-paper-2 px-4 py-3 transition-colors duration-150 focus-within:border-ink">
              <textarea
                ref={input}
                rows={1}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask();
                  }
                }}
                placeholder="Ask Kronos about a subject, a unit, a year…"
                aria-label="Ask Kronos"
                className="max-h-32 min-h-[26px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-ink outline-none"
              />
              <button
                onClick={() => ask()}
                disabled={!q.trim()}
                aria-label="Ask"
                className="btn-primary mb-0.5 h-9 w-9 shrink-0 !p-0"
              >
                <ArrowUp size={16} weight="bold" />
              </button>
            </div>

            <ul className="mt-4 border-t border-line">
              {openers.map((o) => (
                <li key={o} className="border-b border-line">
                  <button
                    onClick={() => ask(o)}
                    className="group flex w-full items-start gap-3 py-2.5 text-left"
                  >
                    <span
                      aria-hidden
                      className="mt-[0.55em] h-1 w-1 shrink-0 bg-line transition-colors duration-150 group-hover:bg-mark"
                    />
                    <span className="min-w-0 flex-1 text-[13.5px] text-ink-2 transition-colors duration-150 group-hover:text-ink">
                      {o}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </main>

        <footer className="flex flex-wrap items-end justify-between gap-6 border-t border-line pt-4">
          {/* The title block's dimensions, on the sheet they describe. Every
              figure is measured; a dash means Kronos has not answered
              yet, and never a plausible-looking number. */}
          <dl className="grid min-w-0 grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-9">
            {[
              ["Questions", fmt(stats?.questions)],
              ["Subjects", fmt(stats?.courses)],
              ["Papers", fmt(stats?.papers)],
              ["Span", stats ? `${stats.year_range[0]}–${stats.year_range[1]}` : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="label-cap">{k}</dt>
                <dd className="mt-1 font-mono text-[15px] tabular-nums text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <button
            onClick={() => {
              setRole("teacher");
              nav(HOME.teacher);
            }}
            className="group flex items-center gap-2 text-[13px] text-ink-2 transition-colors duration-150 hover:text-ink"
          >
            I set the papers
            <ArrowRight
              size={14}
              weight="bold"
              className="transition-transform duration-150 group-hover:translate-x-0.5"
            />
          </button>
        </footer>
      </div>
    </div>
  );
}
