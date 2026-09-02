import { useEffect, useState } from "react";
import { FileText } from "@phosphor-icons/react";
import type { Question } from "../api";

// strip inline image markdown; figures are shown separately from the images[]
function cleanText(md: string) {
  return md.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
}

function label(q: Question) {
  const n = q.qno ?? "";
  const s = q.subpart ? `(${q.subpart})` : "";
  return `${n}${s}` || "—";
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wrap query terms in <mark> so matches are visible in the result text. */
function highlight(text: string, terms: string[]) {
  const words = terms
    .flatMap((t) => t.split(/\s+/))
    .map((w) => w.trim())
    .filter((w) => w.length > 2);
  if (words.length === 0) return text;
  // capturing split: odd indices are the matched terms
  const re = new RegExp(`(${words.map(escapeRe).join("|")})`, "gi");
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="hl">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export default function QuestionCard({
  q,
  query = "",
  n,
  flash = false,
  citeId,
  matchReasons,
}: {
  q: Question;
  query?: string;
  /** citation number, when this card is evidence behind a chat answer */
  n?: number;
  /** briefly outline the card after a citation jumps to it */
  flash?: boolean;
  /** DOM id for the citation jump target; defaults to `cite-${n}`. Needed when
   *  several chat turns each number their citations from 1. */
  citeId?: string;
  /** why this card matched the chat query — fields the caller can verify
   *  against the resolved intent, e.g. ["Topic", "Year", "Unit"] */
  matchReasons?: string[];
}) {
  const text = cleanText(q.question_md);
  const [zoomed, setZoomed] = useState<string | null>(null);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZoomed(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomed]);

  return (
    <article
      id={n ? citeId ?? `cite-${n}` : undefined}
      className={`card group scroll-mt-32 px-4 py-4 sm:px-5 transition-colors ${
        flash ? "border-blueprint ring-2 ring-blueprint/25" : "hover:border-ink-2"
      }`}
    >
      <div className="flex gap-3 sm:gap-4">
        {/* margin column: the citation number when cited, else the paper's own
            question number — both read as a printed paper's margin */}
        <div className="shrink-0 w-8 sm:w-10 pt-0.5 font-mono text-sm text-ink-2 tabular-nums">
          {n ? (
            <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[4px] border border-blueprint/35 bg-blueprint/8 px-1 text-[11px] font-semibold text-blueprint">
              {n}
            </span>
          ) : (
            label(q)
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Question left of the rule, marks right of it — the layout of the
              printed paper this row came from. */}
          <div className="flex items-start gap-3 sm:gap-4">
            <p className="min-w-0 flex-1 text-[15px] leading-relaxed text-ink sm:text-[15.5px]">
              {highlight(text, query ? [query] : [])}
            </p>
            <div className="shrink-0 self-stretch pl-3 sm:pl-4">
              <span className="mark block w-8 text-right text-sm sm:w-10">
                {q.marks != null ? q.marks : "—"}
              </span>
            </div>
          </div>

          {q.images.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {q.images.map((img) => (
                <button
                  key={img.filename}
                  type="button"
                  onClick={() => setZoomed(img.url)}
                  title="Zoom in"
                  className="block cursor-zoom-in"
                >
                  {/* not lazy: figures appear on only ~2% of questions, and a
                      lazily-loaded one often never fires its fetch at all */}
                  <img
                    src={img.url}
                    alt="Figure from the original paper"
                    decoding="async"
                    className="h-40 w-auto min-w-24 max-w-full rounded-sm border border-line bg-paper object-contain transition-colors hover:border-ink/40"
                  />
                </button>
              ))}
            </div>
          )}

          {/* primary identity: code, year, exam, unit, match */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="badge badge-code">{q.course_code}</span>
            <span className="badge">{q.year}</span>
            <span className="badge">{q.exam_type}</span>
            {/* when the margin shows a citation number, the paper's own Qno
                still needs a home */}
            {n && q.qno != null && <span className="badge">Q{label(q)}</span>}
            {q.unit != null && <span className="badge">Unit {q.unit}</span>}
            {q.score != null && (
              <span className="badge badge-score">
                {Math.round(q.score * 100)}% match
              </span>
            )}
          </div>

          {/* secondary: topic chips + context */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {q.topic && <span className="chip chip-topic">{q.topic}</span>}
            {q.subtopic && q.subtopic !== q.topic && (
              <span className="chip">{q.subtopic}</span>
            )}
          </div>

          {matchReasons && matchReasons.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {matchReasons.map((r) => (
                <span
                  key={r}
                  className="rounded-[4px] border border-line bg-line-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-2"
                >
                  {r}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
            <span className="truncate">{q.course_name}</span>
            <span className="text-line">·</span>
            <span className="truncate">{q.branch.replace(/_/g, " ")}</span>
            <a
              href={q.download_url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 font-medium text-blueprint opacity-70 transition-opacity hover:underline underline-offset-2 group-hover:opacity-100"
            >
              <FileText size={13} weight="regular" />
              {n ? `Source: ${q.year} ${q.exam_type} — Open PDF` : "Original paper"}
            </a>
          </div>
        </div>
      </div>

      {zoomed && (
        <div
          onClick={() => setZoomed(null)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-ink/90 p-6 backdrop-blur-sm"
        >
          <img
            src={zoomed}
            alt="Figure from the original paper"
            className="max-h-full max-w-full cursor-default rounded-sm object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </article>
  );
}
