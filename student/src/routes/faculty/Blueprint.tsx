import { useEffect, useState } from "react";
import { runQuery, generatePaper, type QueryResult } from "../../facultyApi";
import { PageHead, SubjectPicker, useSubjects, Banner, Skeleton, SqlToggle, Empty }
  from "../../components/faculty/Shared";

type Section = { label: string; note: string; slots: number; answer: number; marks: number };

const CIE: Section[] = [
  { label: "PART - A", note: "Total 5 Marks (No Choice)", slots: 1, answer: 1, marks: 5 },
  { label: "PART - B", note: "Total 15 Marks (No Choice)", slots: 3, answer: 3, marks: 5 },
  { label: "PART - C", note: "Total 20 Marks (Answer any 2 of 3)", slots: 3, answer: 2, marks: 10 },
];

const STORE = "kronos-blueprints";

export default function Blueprint() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  const [excl, setExcl] = useState(3);
  const [sections, setSections] = useState<Section[]>(CIE);
  const [avail, setAvail] = useState<QueryResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);
  useEffect(() => {
    if (!key) return;
    setAvail(null); setResult(null);
    const cutoff = new Date().getFullYear() - excl;
    runQuery("availability", { subject_key: key, cutoff_year: cutoff }).then(setAvail);
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "{}")[key];
      if (saved) setSections(saved);
    } catch { /* no saved blueprint */ }
  }, [key, excl]);

  const answerable = sections.reduce((s, x) => s + x.answer * x.marks, 0);
  const printed = sections.reduce((s, x) => s + x.slots * x.marks, 0);

  // Availability is per (unit, marks). A section needing N questions at M marks
  // is satisfiable only if the units it can draw from hold N unused ones.
  const byMarks = new Map<number, number>();
  for (const r of avail?.rows ?? []) {
    const m = Number(r.marks);
    byMarks.set(m, (byMarks.get(m) ?? 0) + Number(r.available));
  }
  const shortfalls = sections
    .map((s) => ({ s, have: byMarks.get(s.marks) ?? 0 }))
    .filter((x) => x.have < x.s.slots);

  function save() {
    try {
      const all = JSON.parse(localStorage.getItem(STORE) || "{}");
      all[key] = sections;
      localStorage.setItem(STORE, JSON.stringify(all));
    } catch { /* storage unavailable — the blueprint still works this session */ }
  }

  async function test() {
    setTesting(true);
    try {
      setResult(await generatePaper({
        subject_key: key, exam_type: "CUSTOM", exclude_years: excl,
        require_co: true, bloom_mix: {}, blueprint: sections,
      }));
    } catch (e: any) {
      setResult({ error: e?.response?.data?.detail ?? String(e) });
    } finally { setTesting(false); }
  }

  const upd = (i: number, patch: Partial<Section>) =>
    setSections(sections.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHead title="Blueprint"
        blurb="Define the shape of a paper once, and the generator follows it exactly. A declared blueprint beats an inferred one — averaging real papers gives unit totals of 155 or 201, which then have to be scaled onto the target."
        right={<SubjectPicker subjects={subjects} value={key} onChange={setKey} />} />

      <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
        <section>
          <div className="border border-line rounded-lg bg-paper-2 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-2">
                <th className="px-3 py-2 font-medium">Section</th>
                <th className="px-3 py-2 font-medium">Instruction</th>
                <th className="px-3 py-2 font-medium w-20">Printed</th>
                <th className="px-3 py-2 font-medium w-20">Answer</th>
                <th className="px-3 py-2 font-medium w-20">Marks</th>
                <th className="px-3 py-2 font-medium w-16"></th>
              </tr></thead>
              <tbody>
                {sections.map((s, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-3 py-2">
                      <input value={s.label} onChange={(e) => upd(i, { label: e.target.value })}
                        className="w-full bg-transparent border border-line rounded px-2 py-1 font-mono text-[12px]" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={s.note} onChange={(e) => upd(i, { note: e.target.value })}
                        className="w-full bg-transparent border border-line rounded px-2 py-1 text-[12px]" />
                    </td>
                    {(["slots", "answer", "marks"] as const).map((f) => (
                      <td key={f} className="px-3 py-2">
                        <input type="number" min={0} value={s[f]}
                          onChange={(e) => upd(i, { [f]: Number(e.target.value) } as Partial<Section>)}
                          className="w-full bg-transparent border border-line rounded px-2 py-1 font-mono text-[12px]" />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <button onClick={() => setSections(sections.filter((_, k) => k !== i))}
                        className="text-[11px] text-ink-2 hover:text-mark">remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-3 p-3 border-t border-line">
              <button onClick={() => setSections([...sections,
                  { label: `PART - ${String.fromCharCode(65 + sections.length)}`, note: "", slots: 1, answer: 1, marks: 10 }])}
                className="border border-line rounded-md px-3 py-1 text-[12px] hover:bg-line-2">Add section</button>
              <button onClick={() => setSections(CIE)}
                className="text-[12px] text-ink-2 hover:text-mark underline underline-offset-2">reset to CIE</button>
              <span className="ml-auto font-mono text-[12px] text-ink-2">
                {answerable} answerable · {printed} printed
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button onClick={save}
              className="border border-line rounded-md px-4 py-2 text-[13px] hover:bg-line-2">
              Save for this subject
            </button>
            <button onClick={test} disabled={testing || !key}
              className="bg-mark text-paper rounded-md px-4 py-2 text-[13px] disabled:opacity-40">
              {testing ? "Testing…" : "Test — can the archive fill it?"}
            </button>
          </div>

          {result && (
            <div className="mt-4">
              {result.error ? <Banner>{result.error}</Banner> : (
                <Banner>
                  <p className="font-medium mb-1">
                    {result.empty_slots === 0
                      ? `Satisfiable — every slot filled, ${result.total_marks} marks.`
                      : `${result.empty_slots} slot${result.empty_slots === 1 ? "" : "s"} could not be filled.`}
                  </p>
                  <p className="text-[12px] text-ink-2">
                    COs covered {result.cos_covered.join(", ") || "none"} of {result.cos_required.join(", ")}.
                    {result.warnings.length > 0 && ` ${result.warnings.length} constraint(s) relaxed.`}
                  </p>
                  {result.warnings.length > 0 && (
                    <ul className="list-disc ml-4 mt-1 space-y-0.5 text-[12px] text-ink-2 max-h-32 overflow-y-auto">
                      {result.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                    </ul>
                  )}
                </Banner>
              )}
            </div>
          )}
        </section>

        {/* ---- what the archive can actually supply ---- */}
        <aside className="border border-line rounded-lg bg-paper-2 p-4">
          <h2 className="serif text-lg text-ink">What the archive holds</h2>
          <p className="text-[12px] text-ink-2 mb-3">
            Unused questions per mark value, after excluding everything asked in the
            last {excl} years.
          </p>
          <div className="mb-3">
            <span className="text-[11px] uppercase tracking-wider text-ink-2 block mb-1">
              Exclude last {excl} years
            </span>
            <input type="range" min={0} max={9} value={excl}
              onChange={(e) => setExcl(Number(e.target.value))} className="w-full accent-mark" />
          </div>

          {shortfalls.length > 0 && (
            <div className="mb-3">
              <Banner>
                <p className="font-medium mb-1">This blueprint cannot be filled.</p>
                <ul className="list-disc ml-4 text-[12px] text-ink-2">
                  {shortfalls.map((x, i) => (
                    <li key={i}>
                      {x.s.label} needs {x.s.slots} × {x.s.marks}-mark; only {x.have} unused available.
                    </li>
                  ))}
                </ul>
              </Banner>
            </div>
          )}

          {!avail ? <Skeleton className="h-48" /> : avail.rows.length === 0 ? (
            <Empty title="No questions with marks and units" />
          ) : (
            <table className="w-full text-[12px]">
              <thead><tr className="text-left text-[10px] uppercase tracking-wider text-ink-2">
                <th className="py-1">Unit</th><th className="py-1">Marks</th>
                <th className="py-1 text-right">Unused</th><th className="py-1 text-right">Total</th>
              </tr></thead>
              <tbody>
                {avail.rows.map((r, i) => {
                  const used = Number(r.total) - Number(r.available);
                  return (
                    <tr key={i} className="border-t border-line-2">
                      <td className="py-1 font-mono text-ink-2">{r.unit_no}</td>
                      <td className="py-1 font-mono">{r.marks}</td>
                      <td className={`py-1 font-mono text-right ${Number(r.available) === 0 ? "text-mark" : ""}`}>
                        {r.available}
                      </td>
                      <td className="py-1 font-mono text-right text-ink-2">
                        {r.total}{used > 0 && <span className="text-[10px]"> (−{used})</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <SqlToggle sql={avail?.sql} ms={avail?.ms} engine={avail?.engine} fallbackReason={avail?.fallback_reason} />
        </aside>
      </div>
    </div>
  );
}
