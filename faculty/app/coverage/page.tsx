"use client";
import { useEffect, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ZAxis,
} from "recharts";
import { SubjectPicker, useSubjects } from "@/components/SubjectPicker";
import { SqlToggle, Skeleton, Banner, Empty } from "@/components/Bits";
import { runQuery } from "@/lib/util";

export default function Coverage() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  const [gap, setGap] = useState<any>(null);
  const [rep, setRep] = useState<any>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);
  useEffect(() => {
    if (!key) return;
    setGap(null); setRep(null);
    runQuery("coverageGap", { subject_key: key }).then(setGap);
    runQuery("repetition", { subject_key: key }).then(setRep);
  }, [key]);

  const rows = gap?.rows ?? [];
  const maxMarks = Math.max(1, ...rows.map((r: any) => Number(r.marks_examined)));
  const problem = rows.filter((r: any) => Number(r.notes_pages) < 2 && Number(r.years_appeared) >= 4);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="serif-display text-4xl text-ink">Where teaching and examining diverge</h1>
          <p className="text-[13px] text-ink-2 mt-2 max-w-2xl">
            Each dot is a topic. Far right means the notes cover it well; high up
            means the exam keeps asking it. The bottom-right is the problem zone:
            heavily examined, thinly taught.
          </p>
        </div>
        <SubjectPicker subjects={subjects} value={key} onChange={setKey} />
      </div>

      {!gap ? <Skeleton className="h-[360px]" /> : rows.length === 0 ? (
        <Empty title="No topics with marks for this subject" />
      ) : (
        <>
          <section className="border rounded-lg bg-paper-2 p-5">
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
                <CartesianGrid stroke="var(--line)" />
                <XAxis type="number" dataKey="notes_pages" name="Note pages"
                  tick={{ fontSize: 11, fill: "var(--ink-2)" }} tickLine={false}
                  label={{ value: "pages of notes covering the topic", position: "bottom",
                           offset: 10, fontSize: 11, fill: "var(--ink-2)" }} />
                <YAxis type="number" dataKey="marks_examined" name="Marks examined"
                  tick={{ fontSize: 11, fill: "var(--ink-2)" }} tickLine={false}
                  label={{ value: "marks examined", angle: -90, position: "insideLeft",
                           fontSize: 11, fill: "var(--ink-2)" }} />
                <ZAxis dataKey="years_appeared" range={[40, 260]} name="Years" />
                {/* the quadrant that matters, labelled rather than left to inference */}
                <ReferenceArea x1={0} x2={2} y1={maxMarks * 0.45} y2={maxMarks}
                  fill="var(--mark)" fillOpacity={0.07} stroke="var(--mark)" strokeOpacity={0.25}
                  label={{ value: "examined heavily · taught thinly", position: "insideTopLeft",
                           fontSize: 11, fill: "var(--mark)" }} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{ background: "var(--paper-2)", border: "1px solid var(--line)",
                    borderRadius: 6, fontSize: 12 }}
                  content={({ payload }) => {
                    const d: any = payload?.[0]?.payload; if (!d) return null;
                    return (
                      <div className="border rounded-md bg-paper-2 p-2 text-[12px] max-w-[260px]">
                        <p className="font-medium text-ink">{d.topic_name}</p>
                        <p className="text-ink-2 mono text-[11px] mt-1">
                          unit {d.unit_no} · {d.marks_examined} marks · {d.questions} questions<br />
                          {d.years_appeared} years · {d.notes_pages} note pages
                        </p>
                      </div>);
                  }} />
                <Scatter data={rows} fill="var(--mark)" fillOpacity={0.55} />
              </ScatterChart>
            </ResponsiveContainer>
            <SqlToggle sql={gap.sql} ms={gap.ms} backend={gap.backend} />
          </section>

          <section>
            <h2 className="serif text-xl text-ink mb-1">The problem zone, listed</h2>
            <p className="text-[12px] text-ink-2 mb-3">
              Fewer than 2 pages of notes, examined in 4 or more years.
            </p>
            {problem.length === 0 ? (
              <Empty title="No topic falls in the problem zone" hint="Every heavily examined topic has note coverage." />
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-[13px] dense">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-ink-2">
                      <th className="px-4 py-2 font-medium">Topic</th>
                      <th className="px-4 py-2 font-medium">Unit</th>
                      <th className="px-4 py-2 font-medium text-right">Marks</th>
                      <th className="px-4 py-2 font-medium text-right">Years</th>
                      <th className="px-4 py-2 font-medium text-right">Note pages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {problem.map((r: any) => (
                      <tr key={r.topic_name} className="border-t hover:bg-line-2/40">
                        <td className="px-4 py-2 serif">{r.topic_name}</td>
                        <td className="px-4 py-2 mono text-ink-2">{r.unit_no}</td>
                        <td className="px-4 py-2 mono text-right">{r.marks_examined}</td>
                        <td className="px-4 py-2 mono text-right text-ink-2">{r.years_appeared}</td>
                        <td className="px-4 py-2 mono text-right text-mark">{r.notes_pages}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="serif text-xl text-ink mb-1">Asked to death</h2>
            <p className="text-[12px] text-ink-2 mb-3">
              Near-identical questions set three or more times. Use this to avoid
              them, not to repeat them.
            </p>
            {!rep ? <Skeleton className="h-32" /> : rep.rows.length === 0 ? (
              <Empty title="No question has been repeated three times" />
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-[13px] dense">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-ink-2">
                      <th className="px-4 py-2 font-medium text-right">×</th>
                      <th className="px-4 py-2 font-medium">Question</th>
                      <th className="px-4 py-2 font-medium">Unit</th>
                      <th className="px-4 py-2 font-medium">Span</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rep.rows.slice(0, 25).map((r: any) => (
                      <tr key={r.repeat_cluster_id} className="border-t hover:bg-line-2/40">
                        <td className="px-4 py-2 mono text-right text-mark font-medium">{r.times_asked}</td>
                        <td className="px-4 py-2 serif max-w-[560px] truncate" title={r.example}>{r.example}</td>
                        <td className="px-4 py-2 mono text-ink-2">{r.unit_no}</td>
                        <td className="px-4 py-2 mono text-ink-2">{r.first_asked}–{r.last_asked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <SqlToggle sql={rep.sql} ms={rep.ms} backend={rep.backend} />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
