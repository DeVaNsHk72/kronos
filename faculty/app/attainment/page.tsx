"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
         ReferenceLine } from "recharts";
import { SubjectPicker, useSubjects } from "@/components/SubjectPicker";
import { SqlToggle, Skeleton, Banner, Empty, Tile } from "@/components/Bits";
import { runQuery, coveragePhrase } from "@/lib/util";

const FLOOR = 10;   // a CO under 10% of the paper is flagged

export default function Attainment() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  const [co, setCo] = useState<any>(null);
  const [po, setPo] = useState<any>(null);
  const [ov, setOv] = useState<any>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);
  useEffect(() => {
    if (!key) return;
    setCo(null); setPo(null);
    runQuery("coAttainment", { subject_key: key }).then(setCo);
    runQuery("poAttainment", { subject_key: key }).then(setPo);
    runQuery("overview", { subject_key: key }).then(setOv);
  }, [key]);

  const o = ov?.rows?.[0];
  const coRows = co?.rows ?? [];
  const under = coRows.filter((r: any) => Number(r.pct_of_paper) < FLOOR);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="serif-display text-4xl text-ink">CO / PO attainment</h1>
          <p className="text-[13px] text-ink-2 mt-2 max-w-2xl">
            Marks distribution across course and programme outcomes, from SEE main
            sittings only.
          </p>
        </div>
        <SubjectPicker subjects={subjects} value={key} onChange={setKey} />
      </div>

      {/* The honesty banner is not optional here: this screen feeds accreditation
          reporting, and roughly 60% of questions carry no CO at all. */}
      {o && (
        <Banner>
          <p className="font-medium mb-1">This view covers a minority of the archive.</p>
          <p className="text-[12.5px] text-ink-2">
            CO is recorded on {coveragePhrase(Number(o.with_co), Number(o.total_questions), "questions")}.
            Percentages below are shares <em>of the questions that carry a CO</em>, not of
            the whole archive — a CO could look well covered simply because the
            questions missing a CO were never counted. Treat as indicative, not as an
            attainment return.
          </p>
        </Banner>
      )}

      {!co ? <Skeleton className="h-[320px]" /> : coRows.length === 0 ? (
        <Empty title="No CO data for this subject"
          hint="No question in this subject records a course outcome, so attainment cannot be computed." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile label="COs present" value={coRows.length} />
            <Tile label="Questions with CO" value={coRows.reduce((s: number, r: any) => s + Number(r.questions), 0)} />
            <Tile label="Marks attributed" value={coRows.reduce((s: number, r: any) => s + Number(r.total_marks), 0)} />
            <Tile label={`COs under ${FLOOR}%`} value={under.length}
                  tone={under.length ? "warn" : "normal"}
                  sub={under.length ? `CO ${under.map((r: any) => r.course_outcome).join(", ")}` : "none"} />
          </div>

          <section className="border rounded-lg bg-paper-2 p-5">
            <h2 className="serif text-lg text-ink mb-1">Marks by course outcome</h2>
            <p className="text-[12px] text-ink-2 mb-4">
              The line marks the {FLOOR}% floor. Anything below it is under-examined
              relative to the others.
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={coRows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="course_outcome" tickFormatter={(v) => `CO${v}`}
                  tick={{ fontSize: 11, fill: "var(--ink-2)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--ink-2)" }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "var(--paper-2)", border: "1px solid var(--line)",
                  borderRadius: 6, fontSize: 12 }}
                  formatter={(v: any, _n: any, p: any) =>
                    [`${v}% · ${p.payload.total_marks} marks · ${p.payload.questions} questions`, `CO${p.payload.course_outcome}`]} />
                <ReferenceLine y={FLOOR} stroke="var(--ink-2)" strokeDasharray="4 4" />
                <Bar dataKey="pct_of_paper" radius={[3, 3, 0, 0]}>
                  {coRows.map((r: any) => (
                    <Cell key={r.course_outcome}
                      fill={Number(r.pct_of_paper) < FLOOR ? "var(--mark)" : "var(--ink-2)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <SqlToggle sql={co.sql} ms={co.ms} backend={co.backend} />
          </section>

          <section className="border rounded-lg bg-paper-2 p-5">
            <h2 className="serif text-lg text-ink mb-1">Marks by programme outcome</h2>
            {!po ? <Skeleton className="h-40" /> : po.rows.length === 0 ? (
              <Empty title="No PO data recorded for this subject" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={po.rows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="program_outcome" tickFormatter={(v) => `PO${v}`}
                    tick={{ fontSize: 11, fill: "var(--ink-2)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--ink-2)" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "var(--paper-2)", border: "1px solid var(--line)",
                    borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="total_marks" fill="var(--ink-2)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {po && <SqlToggle sql={po.sql} ms={po.ms} backend={po.backend} />}
          </section>
        </>
      )}
    </div>
  );
}
