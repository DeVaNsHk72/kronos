import { useEffect, useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
         ResponsiveContainer, ReferenceArea, ZAxis } from "recharts";
import { runQuery, type QueryResult } from "../../facultyApi";
import { PageHead, SubjectPicker, useSubjects, SqlToggle, Skeleton, Empty }
  from "../../components/faculty/Shared";

export default function Coverage() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  const [gap, setGap] = useState<QueryResult | null>(null);
  const [rep, setRep] = useState<QueryResult | null>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);
  useEffect(() => {
    if (!key) return;
    setGap(null); setRep(null);
    runQuery("coverageGap", { subject_key: key }).then(setGap);
    runQuery("repetition", { subject_key: key }).then(setRep);
  }, [key]);

  const rows = gap?.rows ?? [];
  const maxMarks = Math.max(1, ...rows.map((r) => Number(r.marks_examined)));
  const problem = rows.filter((r) => Number(r.notes_pages) < 2 && Number(r.years_appeared) >= 4);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHead title="Where teaching and examining diverge"
        blurb="Each dot is a topic. Far right means the notes cover it well; high up means the exam keeps asking it. The bottom-right is the problem zone."
        right={<SubjectPicker subjects={subjects} value={key} onChange={setKey} />} />

      {!gap ? <Skeleton className="h-[360px]" /> : rows.length === 0 ? (
        <Empty title="No topics with marks for this subject" />
      ) : (
        <>
          <section className="border border-line rounded-lg bg-paper-2 p-5">
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
                <CartesianGrid stroke="var(--color-line)" />
                <XAxis type="number" dataKey="notes_pages" tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-ink-2)" }}
                  label={{ value: "pages of notes covering the topic", position: "bottom",
                           offset: 10, fontSize: 11, fill: "var(--color-ink-2)" }} />
                <YAxis type="number" dataKey="marks_examined" tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-ink-2)" }}
                  label={{ value: "marks examined", angle: -90, position: "insideLeft",
                           fontSize: 11, fill: "var(--color-ink-2)" }} />
                <ZAxis dataKey="years_appeared" range={[40, 240]} />
                {/* the quadrant that matters, labelled rather than left to inference */}
                <ReferenceArea x1={0} x2={2} y1={maxMarks * 0.45} y2={maxMarks}
                  fill="var(--color-mark)" fillOpacity={0.07}
                  stroke="var(--color-mark)" strokeOpacity={0.25}
                  label={{ value: "examined heavily · taught thinly", position: "insideTopLeft",
                           fontSize: 11, fill: "var(--color-mark)" }} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }}
                  content={({ payload }) => {
                    const d: any = payload?.[0]?.payload; if (!d) return null;
                    return (
                      <div className="border border-line rounded-md bg-paper-2 p-2 text-[12px] max-w-[260px]">
                        <p className="font-medium text-ink">{d.topic_name}</p>
                        <p className="text-ink-2 font-mono text-[11px] mt-1">
                          unit {d.unit_no} · {d.marks_examined} marks · {d.questions} questions<br />
                          {d.years_appeared} years · {d.notes_pages} note pages
                        </p>
                      </div>);
                  }} />
                <Scatter data={rows} fill="var(--color-mark)" fillOpacity={0.55} />
              </ScatterChart>
            </ResponsiveContainer>
            <SqlToggle sql={gap.sql} ms={gap.ms} />
          </section>

          <section className="mt-8">
            <h2 className="serif text-xl text-ink mb-1">The problem zone, listed</h2>
            <p className="text-[12px] text-ink-2 mb-3">Fewer than 2 pages of notes, examined in 4+ years.</p>
            {problem.length === 0 ? <Empty title="No topic falls in the problem zone" /> : (
              <div className="border border-line rounded-lg overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-2 bg-paper-2">
                    <th className="px-4 py-2 font-medium">Topic</th>
                    <th className="px-4 py-2 font-medium">Unit</th>
                    <th className="px-4 py-2 font-medium text-right">Marks</th>
                    <th className="px-4 py-2 font-medium text-right">Years</th>
                    <th className="px-4 py-2 font-medium text-right">Note pages</th>
                  </tr></thead>
                  <tbody>
                    {problem.map((r) => (
                      <tr key={String(r.topic_name)} className="border-t border-line hover:bg-line-2/40">
                        <td className="px-4 py-2 serif">{r.topic_name}</td>
                        <td className="px-4 py-2 font-mono text-ink-2">{r.unit_no}</td>
                        <td className="px-4 py-2 font-mono text-right">{r.marks_examined}</td>
                        <td className="px-4 py-2 font-mono text-right text-ink-2">{r.years_appeared}</td>
                        <td className="px-4 py-2 font-mono text-right text-mark">{r.notes_pages}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="serif text-xl text-ink mb-1">Asked to death</h2>
            <p className="text-[12px] text-ink-2 mb-3">
              Near-identical questions set three or more times. Use this to avoid them, not repeat them.
            </p>
            {!rep ? <Skeleton className="h-32" /> : rep.rows.length === 0 ? (
              <Empty title="No question has been repeated three times" />
            ) : (
              <div className="border border-line rounded-lg overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-2 bg-paper-2">
                    <th className="px-4 py-2 font-medium text-right">×</th>
                    <th className="px-4 py-2 font-medium">Question</th>
                    <th className="px-4 py-2 font-medium">Unit</th>
                    <th className="px-4 py-2 font-medium">Span</th>
                  </tr></thead>
                  <tbody>
                    {rep.rows.slice(0, 25).map((r) => (
                      <tr key={String(r.repeat_cluster_id)} className="border-t border-line hover:bg-line-2/40">
                        <td className="px-4 py-2 font-mono text-right text-mark font-medium">{r.times_asked}</td>
                        <td className="px-4 py-2 serif max-w-[540px] truncate" title={String(r.example)}>{r.example}</td>
                        <td className="px-4 py-2 font-mono text-ink-2">{r.unit_no}</td>
                        <td className="px-4 py-2 font-mono text-ink-2">{r.first_asked}–{r.last_asked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-4 pb-3"><SqlToggle sql={rep.sql} ms={rep.ms} /></div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
