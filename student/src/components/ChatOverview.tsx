import type { Question } from "../api";

/** Everything here is derived client-side from the result rows already in the
 *  response — no extra request, and nothing claimed that isn't actually in
 *  the data (no fabricated counts, no "3 near-duplicates" without a real
 *  duplicate check). */
export function computeOverview(results: Question[]) {
  const topicCounts = new Map<string, number>();
  const askedIn = new Map<string, { year: number; exam_type: string; n: number }>();
  let marksSum = 0;
  let marksN = 0;
  let yearMin = Infinity;
  let yearMax = -Infinity;

  for (const r of results) {
    if (r.topic) topicCounts.set(r.topic, (topicCounts.get(r.topic) ?? 0) + 1);
    if (r.marks != null) {
      marksSum += r.marks;
      marksN++;
    }
    if (r.year != null) {
      yearMin = Math.min(yearMin, r.year);
      yearMax = Math.max(yearMax, r.year);
      const key = `${r.year}-${r.exam_type}`;
      const cur = askedIn.get(key);
      if (cur) cur.n++;
      else askedIn.set(key, { year: r.year, exam_type: r.exam_type, n: 1 });
    }
  }

  const topics = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const also = [...askedIn.values()].sort((a, b) => b.year - a.year).slice(0, 8);

  return {
    total: results.length,
    topics,
    avgMarks: marksN ? Math.round((marksSum / marksN) * 10) / 10 : null,
    yearRange: Number.isFinite(yearMin) ? ([yearMin, yearMax] as const) : null,
    alsoAskedIn: also,
  };
}

export type Overview = ReturnType<typeof computeOverview>;

/** Stat row + topic breakdown — goes above the result cards. */
export function ChatStats({ o }: { o: Overview }) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="card flex flex-wrap gap-x-6 gap-y-2 px-4 py-3">
        <div>
          <div className="label-cap">found</div>
          <div className="text-sm font-semibold text-ink">{o.total}</div>
        </div>
        {o.topics[0] && (
          <div>
            <div className="label-cap">top topic</div>
            <div className="max-w-[14rem] truncate text-sm font-semibold text-ink">
              {o.topics[0][0]}
            </div>
          </div>
        )}
        {o.avgMarks != null && (
          <div>
            <div className="label-cap">avg marks</div>
            <div className="text-sm font-semibold text-mark">{o.avgMarks}</div>
          </div>
        )}
        {o.yearRange && (
          <div>
            <div className="label-cap">years</div>
            <div className="text-sm font-semibold text-ink">
              {o.yearRange[0] === o.yearRange[1]
                ? o.yearRange[0]
                : `${o.yearRange[0]}–${o.yearRange[1]}`}
            </div>
          </div>
        )}
      </div>

      {o.topics.length > 1 && (
        <div>
          <p className="label-cap">topics covered</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {o.topics.map(([topic, n]) => (
              <li key={topic} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink">{topic}</span>
                <span className="font-mono text-xs tabular-nums text-ink-2">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Distinct (year, exam) pairs the topic showed up in — goes below the cards. */
export function ChatAlsoAskedIn({ o }: { o: Overview }) {
  if (o.alsoAskedIn.length <= 1) return null;
  return (
    <div className="mt-4">
      <p className="label-cap">also asked in</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {o.alsoAskedIn.map((a) => (
          <span key={`${a.year}-${a.exam_type}`} className="chip">
            {a.year} {a.exam_type}
          </span>
        ))}
      </div>
    </div>
  );
}
