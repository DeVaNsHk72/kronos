import { fmt } from "@/lib/utils";
import NumberTicker from "@/components/ui/number-ticker";

export type Dims = {
  questions: number | null;
  subjects: number | null;
  papers: number | null;
  years: [number, number] | null;
};

/** The stamp in the corner of the sheet. Reusable — the sidebar footer, the
 *  Landing footer, and any print header can pass the same shape and get the
 *  same block. Every number is a real one; a `null` renders as a dash. */
export default function TitleBlock({
  dims,
  source = "B.M.S. College of Engineering",
}: {
  dims: Dims;
  source?: string;
}) {
  const cells: [string, number | null][] = [
    ["Subjects",  dims.subjects],
    ["Questions", dims.questions],
    ["Papers",    dims.papers],
  ];
  return (
    <div className="border-t border-line px-4 py-3">
      <div className="flex flex-col gap-1.5">
        {cells.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between">
            <span className="text-[0.6875rem] text-ink-2">{k}</span>
            <span className="font-mono text-[0.75rem] tabular-nums text-ink">
              {v != null ? <NumberTicker target={v} /> : "—"}
            </span>
          </div>
        ))}
        {dims.years && (
          <div className="flex items-baseline justify-between">
            <span className="text-[0.6875rem] text-ink-2">Years</span>
            <span className="font-mono text-[0.75rem] tabular-nums text-ink">
              {dims.years[0]}–{dims.years[1]}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 text-[0.625rem] text-ink-2/60">{source}</div>
    </div>
  );
}
