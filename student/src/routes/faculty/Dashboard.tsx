import { fmt } from "@/lib/utils";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
         AreaChart, Area, Legend , Cell } from "recharts";
import { runQuery, type QueryResult } from "../../facultyApi";
import { useChartTokens, step, tickStyle } from "@/lib/chartTheme";
import { PageHead, SubjectPicker, useSubjects, Tile, TileRow, Panel, SqlToggle, Skeleton, Banner, Empty }
  from "../../components/faculty/Shared";

/** How many ordered bands the sequential ramp can separate honestly. Anything
 *  past this folds into one "Other units" band rather than being handed a
 *  generated colour, which would claim a distinction the eye cannot make. */
const MAX_BANDS = 5;

export default function FacultyDashboard() {
  const chart = useChartTokens();
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
    const all = [...ks].sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
    const data = [...byYear.values()].sort((a, b) => a.year - b.year);

    // Past what the ramp can separate, the remaining units are summed into one
    // band rather than dropped. A faculty dashboard that quietly omits unit 6
    // is worse than one that says "units 6+" — the marks still have to add up.
    if (all.length <= MAX_BANDS) return { data, keys: all };
    const kept = all.slice(0, MAX_BANDS - 1);
    const folded = all.slice(MAX_BANDS - 1);
    const label = `Units ${folded[0].slice(5)}+`;
    for (const row of data) {
      let sum = 0;
      for (const u of folded) {
        sum += Number(row[u] ?? 0);
        delete row[u];
      }
      row[label] = sum;
    }
    return { data, keys: [...kept, label] };
  })();

  return (
    <div className="page py-8">
      <PageHead title="Overview"
        right={<SubjectPicker subjects={subjects} value={key} onChange={setKey} failed={!!err} />} />

      {err && <div className="mb-5"><Banner>{err}</Banner></div>}

      {/* A failed request empties the figures; it does not remove them. Every
          quantity keeps its slot and prints a dash, so the sheet reads as a
          sheet that has not been answered rather than as a sheet with nothing
          on it — and the columns do not move when the answer arrives. */}
      {err ? <TileRow>
              {["Questions", "Years", "Papers", "Marks stated", "Unmapped"].map((label) => (
                <Tile key={label} label={label} value="—" />
              ))}
            </TileRow>
        : !o ? <TileRow>
              {["Questions", "Years", "Papers", "Marks stated", "Unmapped"].map((label) => (
                <div key={label} className="flex flex-col gap-1.5 border-b border-r border-line px-4 py-3">
                  <span className="label-cap">{label}</span>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </TileRow>
        : <>
        <TileRow>
          <Tile label="Questions" value={fmt(Number(o.total_questions))} />
          <Tile label="Years" value={o.first_year ? `${o.first_year}–${o.last_year}` : "—"} />
          <Tile label="Papers" value={o.papers ?? "—"} />
          <Tile label="Marks stated"
                tone={Number(o.with_marks) < Number(o.total_questions) ? "warn" : "normal"}
                value={`${Math.round(100 * Number(o.with_marks) / Number(o.total_questions))}%`} />
          {/* Genie does not always return every requested column; an absent
              one must read as "not answered", not as an empty tile. */}
          <Tile label="Unmapped" value={o.unmapped ?? "—"}
                tone={Number(o.unmapped) > 0 ? "warn" : "normal"} />
        </TileRow>

        <div className="grid lg:grid-cols-2 gap-4 mt-4">
          <Panel title="Marks by unit">
            {units?.rows?.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={units.rows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="unit_no" tickFormatter={(v) => `U${v}`} tickLine={false}
                         axisLine={false} tick={{ fontSize: 11, fill: "var(--color-ink-2)" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-ink-2)" }} />
                  <Tooltip contentStyle={{ background: "var(--color-paper-2)",
                    border: "1px solid var(--color-line)", borderRadius: 4, fontSize: 12,
                    fontFamily: "var(--font-sans)", color: "var(--color-ink)" }}
                    labelStyle={{ color: "var(--color-ink-2)" }} />
                  {/* One hue stepped by lightness, ordered by unit — the same
                      encoding as the drift chart, so a reader who has learnt
                      one has learnt both. */}
                  <Bar isAnimationActive={false} dataKey="marks" radius={[2, 2, 0, 0]}>
                    {(units?.rows ?? []).map((_, i) => (
                      <Cell key={i} fill={step(chart, i, units?.rows?.length ?? 1)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty title="No marks recorded" />}
            <SqlToggle sql={units?.sql} ms={units?.ms} engine={units?.engine} fallbackReason={units?.fallback_reason} />
          </Panel>

          <Panel title="Unit emphasis over time">
            {driftData.data.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={driftData.data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} tick={tickStyle(chart)} />
                  <YAxis tickLine={false} axisLine={false} tick={tickStyle(chart)} />
                  <Tooltip contentStyle={{ background: "var(--color-paper-2)",
                    border: "1px solid var(--color-line)", borderRadius: 4, fontSize: 12,
                    fontFamily: "var(--font-sans)", color: "var(--color-ink)" }}
                    labelStyle={{ color: "var(--color-ink-2)" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {driftData.keys.map((u, i) => (
                    /* Units are ordered, so they take one hue stepped by
                       lightness. The stroke is the surface colour, which draws
                       the 2px gap that keeps two adjacent bands from reading as
                       one — the separation the ramp alone cannot carry. */
                    <Area isAnimationActive={false} key={u} type="monotone" dataKey={u} stackId="1"
                          stroke={chart["--k-paper-2"]} strokeWidth={2}
                          fill={step(chart, i, driftData.keys.length)}
                          fillOpacity={1} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            ) : <Empty title="Not enough years to show drift" />}
            <SqlToggle sql={drift?.sql} ms={drift?.ms} engine={drift?.engine} fallbackReason={drift?.fallback_reason} />
          </Panel>
        </div>
      </>}
    </div>
  );
}
