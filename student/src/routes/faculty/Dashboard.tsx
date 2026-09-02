import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
         AreaChart, Area, Legend } from "recharts";
import { runQuery, type QueryResult } from "../../facultyApi";
import { PageHead, SubjectPicker, useSubjects, Tile, SqlToggle, Skeleton, Banner, Empty }
  from "../../components/faculty/Shared";

const TONES = ["#b02c33", "#8a5a12", "#2f6b46", "#3a5a8a", "#6b3a6b", "#7a5a3a", "#4a4a4a"];

export default function FacultyDashboard() {
  const { subjects, err } = useSubjects();
  const [key, setKey] = useState("");
  const [ov, setOv] = useState<QueryResult | null>(null);
  const [units, setUnits] = useState<QueryResult | null>(null);
  const [drift, setDrift] = useState<QueryResult | null>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);
  useEffect(() => {
    if (!key) return;
    setOv(null); setUnits(null); setDrift(null);
    runQuery("overview", { subject_key: key }).then(setOv);
    runQuery("marksByUnit", { subject_key: key }).then(setUnits);
    runQuery("unitDrift", { subject_key: key }).then(setDrift);
  }, [key]);

  if (err) return <div className="px-6 py-8"><Banner>Could not reach the data layer: {err}</Banner></div>;
  const o = ov?.rows?.[0];

  const driftData = (() => {
    if (!drift?.rows?.length) return { data: [] as any[], keys: [] as string[] };
    const byYear = new Map<number, any>(); const ks = new Set<string>();
    for (const r of drift.rows) {
      const y = Number(r.exam_year), u = `Unit ${r.unit_no}`;
      ks.add(u);
      if (!byYear.has(y)) byYear.set(y, { year: y });
      byYear.get(y)[u] = Number(r.marks);
    }
    return { data: [...byYear.values()].sort((a, b) => a.year - b.year), keys: [...ks].sort() };
  })();

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHead title="Intelligence"
        blurb="Drawn from papers actually sat. Re-exam sittings are excluded from the charts — they are real, but they are not what is normally asked."
        right={<SubjectPicker subjects={subjects} value={key} onChange={setKey} />} />

      {!o ? <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[86px]" />)}
            </div>
        : <>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Tile label="Questions" value={Number(o.total_questions).toLocaleString()}
                sub={`${o.first_year}–${o.last_year}`} />
          <Tile label="Years" value={o.years_covered} />
          <Tile label="Papers" value={o.papers} />
          <Tile label="Marks coverage"
                tone={Number(o.with_marks) < Number(o.total_questions) ? "warn" : "normal"}
                value={`${Math.round(100 * Number(o.with_marks) / Number(o.total_questions))}%`}
                sub={`${Number(o.with_marks).toLocaleString()} of ${Number(o.total_questions).toLocaleString()} state marks`} />
          <Tile label="Unmapped" value={o.unmapped} tone={Number(o.unmapped) > 0 ? "warn" : "normal"}
                sub={Number(o.unmapped) === 0 ? "every question has a topic" : "no topic assigned"} />
        </div>

        <div className="mt-4">
          <Banner>
            <strong>Coverage is partial and totals reflect that.</strong>{" "}
            {Number(o.with_marks).toLocaleString()} of {Number(o.total_questions).toLocaleString()} questions
            state their marks; the rest are excluded from every total rather than counted as zero.
            CO is recorded on {Math.round(100 * Number(o.with_co) / Number(o.total_questions))}%.
          </Banner>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          <section className="border border-line rounded-lg bg-paper-2 p-5">
            <h2 className="serif text-lg text-ink">Marks by unit</h2>
            <p className="text-[12px] text-ink-2 mb-4">Main sittings, questions with stated marks.</p>
            {units?.rows?.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={units.rows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="unit_no" tickFormatter={(v) => `U${v}`} tickLine={false}
                         axisLine={false} tick={{ fontSize: 11, fill: "var(--color-ink-2)" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-ink-2)" }} />
                  <Tooltip contentStyle={{ background: "var(--color-paper-2)",
                    border: "1px solid var(--color-line)", borderRadius: 6, fontSize: 12 }} />
                  <Bar isAnimationActive={false} dataKey="marks" fill="var(--color-mark)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty title="No marks recorded" />}
            <SqlToggle sql={units?.sql} ms={units?.ms} engine={units?.engine} fallbackReason={units?.fallback_reason} />
          </section>

          <section className="border border-line rounded-lg bg-paper-2 p-5">
            <h2 className="serif text-lg text-ink">Unit emphasis over time</h2>
            <p className="text-[12px] text-ink-2 mb-4">A unit thinning year on year is usually being quietly dropped.</p>
            {driftData.data.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={driftData.data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="year" tickLine={false} axisLine={false}
                         tick={{ fontSize: 11, fill: "var(--color-ink-2)" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-ink-2)" }} />
                  <Tooltip contentStyle={{ background: "var(--color-paper-2)",
                    border: "1px solid var(--color-line)", borderRadius: 6, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {driftData.keys.map((u, i) => (
                    <Area isAnimationActive={false} key={u} type="monotone" dataKey={u} stackId="1"
                          stroke={TONES[i % TONES.length]} fill={TONES[i % TONES.length]} fillOpacity={0.18} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : <Empty title="Not enough years to show drift" />}
            <SqlToggle sql={drift?.sql} ms={drift?.ms} engine={drift?.engine} fallbackReason={drift?.fallback_reason} />
          </section>
        </div>
      </>}
    </div>
  );
}
