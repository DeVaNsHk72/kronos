import type { ChatCitation } from "../api";

/** Render [3] and [2][7] as buttons that jump to the cited question. */
function withCitations(
  text: string,
  valid: Set<number>,
  onJump: (n: number) => void,
) {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (!m) return <span key={i}>{part}</span>;
    const n = Number(m[1]);
    // a marker with no matching row would be a grounding failure; show it
    // plainly rather than offering a link that goes nowhere
    if (!valid.has(n)) return <span key={i} className="text-ink-2">{part}</span>;
    return (
      <button
        key={i}
        onClick={() => onJump(n)}
        title={`Jump to question ${n}`}
        className="mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-blueprint/30 bg-blueprint/8 px-1 align-[1px] font-mono text-[10px] font-semibold text-blueprint transition-colors hover:bg-blueprint hover:text-paper"
      >
        {n}
      </button>
    );
  });
}

export default function ChatAnswer({
  answer,
  citations,
  onJump,
}: {
  answer: string;
  citations: ChatCitation[];
  onJump: (n: number) => void;
}) {
  const valid = new Set(citations.map((c) => c.n));

  return (
    <div className="whitespace-pre-wrap serif text-[16px] leading-relaxed text-ink">
      {withCitations(answer, valid, onJump)}
    </div>
  );
}
