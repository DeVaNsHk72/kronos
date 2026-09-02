import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
         Cell, ReferenceLine } from "recharts";
import { runQuery, type QueryResult } from "../../facultyApi";
import { PageHead, SubjectPicker, useSubjects, SqlToggle, Skeleton, Banner, Empty, Tile }
  from "../../components/faculty/Shared";

const FLOOR = 10;   // a CO under 10% of the paper is flagged

export default function Attainment() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  const [co, setCo] = useState<QueryResult | null>(null);
  const [po, setPo] = useState<QueryResult | null>(null);
  const [ov, setOv] = useState<QueryResult | null>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);
  useEffect(() => {
    if (!key) return;
    setCo(null); setPo(null);
    runQuery("coAttainment", { subject_key: key }).then(setCo);
    runQuery("poAttainment", { subject_key: key }).then(setPo);
    runQuery("overview", { subject_key: key }).then(setOv);
  }, [key]);

  const o = ov?.rows?.[0];
  const rows = co?.rows ?? [];
  const under = rows.filter((r) => Number(r.pct_of_paper) < FLOOR);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHead title="CO / PO attainment"
        blurb="Marks distribution across course and programme outcomes, from Main sittings only."
        right={<SubjectPicker subjects={subjects} value={key} onChange={setKey} />} />

      {/* Not optional: this screen feeds accreditation reporting, and most
          questions carry no CO at all. */}
      {o && (
        <div className="mb-6">
          <Banner>
            <p className="font-medium mb-1">This view covers a minority of the archive.</p>
            <p className="text-[12.5px] text-ink-2">
              CO is recorded on {Number(o.with_co).toLocaleString()} of{" "}
              {Number(o.total_questions).toLocaleString()} questions
              ({Math.round(100 * Number(o.with_co) / Number(o.total_questions))}%).
              Percentages below are shares <em>of the questions that carry a CO</em>, not of the
              whole archive — a CO could look well covered simply because the questions missing
              a CO were never counted. Indicative, not an attainment return.
            </p>
          </Banner>
        </div>
      )}

      {!co ? <Skeleton className="h-[300px]" /> : rows.length === 0 ? (
        <Empty title="No CO data for this subject"
          hint="No question in this subject records a course outcome, so attainment cannot be computed." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Tile label="COs present" value={rows.length} />
            <Tile label="Questions with CO" value={rows.reduce((s, r) => s + Number(r.questions), 0)} />
            <Tile label="Marks attributed" value={rows.reduce((s, r) => s + Number(r.total_marks), 0)} />
            <Tile label={`COs under ${FLOOR}%`} value={under.length}
              tone={under.length ? "warn" : "normal"}
              sub={under.length ? `CO ${under.map((r) => r.course_outcome).join(", ")}` : "none"} />
          </div>

          <section className="border border-line rounded-lg bg-paper-2 p-5">
            <h2 className="serif text-lg text-ink mb-1">Marks by course outcome</h2>
            <p className="text-[12px] text-ink-2 mb-4">
              The line marks the {FLOOR}% floor. Below it is under-examined relative to the others.
            </p>
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={rows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="course_outcome" tickFormatter={(v) => `CO${v}`} tickLine={false}
                  axisLine={false} tick={{ fontSize: 11, fill: "var(--color-ink-2)" }} />
                <YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-ink-2)" }} />
                <Tooltip contentStyle={{ background: "var(--color-paper-2)",
                  border: "1px solid var(--color-line)", borderRadius: 6, fontSize: 12 }}
                  formatter={(v: any, _n: any, p: any) =>
                    [`${v}% · ${p.payload.total_marks} marks · ${p.payload.questions} questions`,
                     `CO${p.payload.course_outcome}`]} />
                <ReferenceLine y={FLOOR} stroke="var(--color-ink-2)" strokeDasharray="4 4" />
                <Bar dataKey="pct_of_paper" radius={[3, 3, 0, 0]}>
                  {rows.map((r) => (
                    <Cell key={String(r.course_outcome)}
                      fill={Number(r.pct_of_paper) < FLOOR ? "var(--color-mark)" : "var(--color-ink-2)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <SqlToggle sql={co?.sql} ms={co?.ms} engine={co?.engine} fallbackReason={co?.fallback_reason} />
          </section>

          <section className="border border-line rounded-lg bg-paper-2 p-5 mt-6">
            <h2 className="serif text-lg text-ink mb-1">Marks by programme outcome</h2>
            {!po ? <Skeleton className="h-36" /> : po.rows.length === 0 ? (
              <Empty title="No PO data recorded for this subject" />
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={po.rows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="program_outcome" tickFormatter={(v) => `PO${v}`} tickLine={false}
                    axisLine={false} tick={{ fontSize: 11, fill: "var(--color-ink-2)" }} />
                  <YAxis tickLine={false} axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--color-ink-2)" }} />
                  <Tooltip contentStyle={{ background: "var(--color-paper-2)",
                    border: "1px solid var(--color-line)", borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="total_marks" fill="var(--color-ink-2)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {po && <SqlToggle sql={po?.sql} ms={po?.ms} engine={po?.engine} fallbackReason={po?.fallback_reason} />}
          </section>
        </>
      )}
    </div>
  );
}
