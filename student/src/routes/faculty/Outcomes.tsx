import { useEffect, useState } from "react";
import { runQuery, type QueryResult } from "../../facultyApi";
import { PageHead, SubjectPicker, useSubjects, SqlToggle, Skeleton, Empty, Banner }
  from "../../components/faculty/Shared";

const LEVELS = ["remember", "understand", "apply", "analyse", "evaluate", "unclassified"];

/** Which cognitive level each outcome is actually tested at. A CO assessed only
 *  by recall is a real finding for an accreditation review, and it is invisible
 *  in a plain marks-per-CO chart. */
export default function Outcomes() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  const [data, setData] = useState<QueryResult | null>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);
  useEffect(() => {
    if (!key) return;
    setData(null);
    runQuery("bloomByCo", { subject_key: key }).then(setData);
  }, [key]);

  const rows = data?.rows ?? [];
  const cos = [...new Set(rows.map((r) => Number(r.course_outcome)))].sort((a, b) => a - b);
  const grid = new Map<string, number>();
  let max = 0;
  for (const r of rows) {
    const k = `${r.course_outcome}|${r.bloom_level}`;
    const m = Number(r.marks) || 0;
    grid.set(k, m);
    if (m > max) max = m;
  }

  // A CO whose marks sit only in remember/understand is being assessed shallowly.
  const shallow = cos.filter((co) => {
    const low = LEVELS.slice(0, 2).reduce((s, b) => s + (grid.get(`${co}|${b}`) ?? 0), 0);
    const all = LEVELS.reduce((s, b) => s + (grid.get(`${co}|${b}`) ?? 0), 0);
    return all > 0 && low / all >= 0.8;
  });

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHead title="Outcomes × cognitive level"
        blurb="Marks for each course outcome, split by the level it is tested at. A CO carrying plenty of marks can still be assessed entirely by recall — a plain marks-per-CO chart hides that."
        right={<SubjectPicker subjects={subjects} value={key} onChange={setKey} />} />

      {!data ? <Skeleton className="h-64" /> : rows.length === 0 ? (
        <Empty title="No CO data for this subject"
          hint="No question here records both a course outcome and a classifiable verb." />
      ) : (
        <>
          {shallow.length > 0 && (
            <div className="mb-5">
              <Banner>
                <p className="font-medium mb-1">
                  CO {shallow.join(", ")} {shallow.length === 1 ? "is" : "are"} assessed almost
                  entirely at recall and comprehension.
                </p>
                <p className="text-[12px] text-ink-2">
                  80% or more of {shallow.length === 1 ? "its" : "their"} marks sit in
                  remember/understand. Worth raising before an accreditation review rather than during one.
                </p>
              </Banner>
            </div>
          )}

          <div className="border border-line rounded-lg bg-paper-2 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-2">
                  <th className="px-4 py-2 font-medium">CO</th>
                  {LEVELS.map((b) => <th key={b} className="px-4 py-2 font-medium text-right">{b}</th>)}
                  <th className="px-4 py-2 font-medium text-right">total</th>
                </tr>
              </thead>
              <tbody>
                {cos.map((co) => {
                  const total = LEVELS.reduce((s, b) => s + (grid.get(`${co}|${b}`) ?? 0), 0);
                  return (
                    <tr key={co} className="border-t border-line">
                      <td className="px-4 py-2 font-mono">CO{co}</td>
                      {LEVELS.map((b) => {
                        const v = grid.get(`${co}|${b}`) ?? 0;
                        // opacity encodes weight so the shape reads at a glance
                        const a = max ? v / max : 0;
                        return (
                          <td key={b} className="px-4 py-2 text-right font-mono tabular-nums"
                              style={{ background: v ? `color-mix(in srgb, var(--color-mark) ${Math.round(a * 55)}%, transparent)` : undefined }}>
                            {v || <span className="text-ink-2">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-4 py-2 text-right font-mono text-ink-2">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-ink-2 mt-2">
            Shading is relative to the heaviest cell. <strong>unclassified</strong> is not a gap in the
            syllabus — it means the question's leading verb was not in the Bloom map, which is true of
            54% of the corpus.
          </p>
          <SqlToggle sql={data?.sql} ms={data?.ms} engine={data?.engine} fallbackReason={data?.fallback_reason} />
        </>
      )}
    </div>
  );
}
