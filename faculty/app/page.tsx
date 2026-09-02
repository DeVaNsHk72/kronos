"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from "recharts";
import { SubjectPicker, useSubjects } from "@/components/SubjectPicker";
import { Tile, SqlToggle, Skeleton, Banner, Empty } from "@/components/Bits";
import { runQuery, coveragePhrase } from "@/lib/util";

const UNIT_TONES = ["#b02c33", "#8a5a12", "#2f6b46", "#3a5a8a", "#6b3a6b", "#7a5a3a", "#4a4a4a"];

export default function Dashboard() {
  const { subjects, err } = useSubjects();
  const [key, setKey] = useState("");
  const [overview, setOverview] = useState<any>(null);
  const [units, setUnits] = useState<any>(null);
  const [drift, setDrift] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);

  useEffect(() => {
    if (!key) return;
    setBusy(true);
    Promise.all([
      runQuery("overview", { subject_key: key }),
      runQuery("marksByUnit", { subject_key: key }),
      runQuery("unitDrift", { subject_key: key }),
    ]).then(([o, u, d]) => { setOverview(o); setUnits(u); setDrift(d); })
      .finally(() => setBusy(false));
  }, [key]);

  if (err) return <Banner>Could not reach the data layer: {err}</Banner>;
  const o = overview?.rows?.[0];

  // Stacked area needs one row per year with a column per unit.
  const driftData = (() => {
    if (!drift?.rows?.length) return { data: [], unitKeys: [] as string[] };
    const byYear = new Map<number, Record<string, number>>();
    const unitKeys = new Set<string>();
    for (const r of drift.rows) {
      const y = Number(r.exam_year);
      const u = `Unit ${r.unit_no}`;
      unitKeys.add(u);
      if (!byYear.has(y)) byYear.set(y, { year: y } as any);
      byYear.get(y)![u] = Number(r.marks);
    }
    return {
      data: [...byYear.values()].sort((a: any, b: any) => a.year - b.year),
      unitKeys: [...unitKeys].sort(),
    };
  })();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="serif-display text-4xl text-ink">The state of this subject</h1>
          <p className="text-[13px] text-ink-2 mt-2 max-w-xl">
            Everything below is drawn from papers actually sat. Re-exam sittings are
            excluded from the charts — they are real, but they are not what is normally asked.
          </p>
        </div>
        <SubjectPicker subjects={subjects} value={key} onChange={setKey} />
      </div>

      {busy && !o ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[86px]" />)}
        </div>
      ) : o ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Tile label="Questions" value={Number(o.total_questions).toLocaleString()}
                  sub={`${o.first_year}–${o.last_year}`} />
            <Tile label="Years covered" value={o.years_covered} />
            <Tile label="Papers" value={o.papers} />
            <Tile label="Marks coverage"
                  tone={Number(o.with_marks) < Number(o.total_questions) ? "warn" : "normal"}
                  value={`${Math.round(100 * Number(o.with_marks) / Number(o.total_questions))}%`}
                  sub={coveragePhrase(Number(o.with_marks), Number(o.total_questions), "carry marks")} />
            <Tile label="Unmapped" value={o.unmapped}
                  tone={Number(o.unmapped) > 0 ? "warn" : "normal"}
                  sub={Number(o.unmapped) === 0 ? "every question has a topic" : "no topic assigned"} />
          </div>

          <Banner tone="info">
            <strong>Coverage is partial and totals reflect that.</strong>{" "}
            {coveragePhrase(Number(o.with_marks), Number(o.total_questions), "questions state their marks")};
            the rest are excluded from every marks total rather than counted as zero.
            CO is recorded on {coveragePhrase(Number(o.with_co), Number(o.total_questions), "questions")}.
          </Banner>

          <div className="grid lg:grid-cols-2 gap-6">
            <section className="border rounded-lg bg-paper-2 p-5">
              <h2 className="serif text-lg text-ink">Marks by unit</h2>
              <p className="text-[12px] text-ink-2 mb-4">Main sittings only, questions with stated marks.</p>
              {units?.rows?.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={units.rows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="unit_no" tickFormatter={(v) => `U${v}`}
                           tick={{ fontSize: 11, fill: "var(--ink-2)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--ink-2)" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--paper-2)", border: "1px solid var(--line)",
                        borderRadius: 6, fontSize: 12 }}
                      formatter={(v: any, n: any) => [Number(v).toLocaleString(), n === "marks" ? "Marks" : n]} />
                    <Bar dataKey="marks" fill="var(--mark)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty title="No marks recorded for this subject" />}
              <SqlToggle sql={units?.sql ?? ""} ms={units?.ms} backend={units?.backend} />
            </section>

            <section className="border rounded-lg bg-paper-2 p-5">
              <h2 className="serif text-lg text-ink">Unit emphasis over time</h2>
              <p className="text-[12px] text-ink-2 mb-4">
                A unit thinning out year on year is usually being quietly dropped.
              </p>
              {driftData.data.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={driftData.data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--ink-2)" }}
                           tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--ink-2)" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "var(--paper-2)", border: "1px solid var(--line)",
                      borderRadius: 6, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {driftData.unitKeys.map((u, i) => (
                      <Area key={u} type="monotone" dataKey={u} stackId="1"
                            stroke={UNIT_TONES[i % UNIT_TONES.length]}
                            fill={UNIT_TONES[i % UNIT_TONES.length]} fillOpacity={0.18} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              ) : <Empty title="Not enough years to show drift" />}
              <SqlToggle sql={drift?.sql ?? ""} ms={drift?.ms} backend={drift?.backend} />
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
