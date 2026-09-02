"use client";
import { useEffect, useState } from "react";
import { SubjectPicker, useSubjects } from "@/components/SubjectPicker";
import { Banner, Skeleton, SqlToggle, Empty } from "@/components/Bits";
import { PaperView } from "@/components/PaperView";

const BLOOMS = ["remember", "understand", "apply", "analyse", "evaluate"];

export default function Generate() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  const [examType, setExamType] = useState("SEE");
  const [total, setTotal] = useState(100);
  const [excl, setExcl] = useState(3);
  const [requireCo, setRequireCo] = useState(true);
  const [choice, setChoice] = useState(true);
  const [mix, setMix] = useState<Record<string, number>>({
    remember: 10, understand: 30, apply: 40, analyse: 20, evaluate: 0,
  });
  const [locked, setLocked] = useState<Record<string, string>>({});
  const [paper, setPaper] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);

  const mixTotal = Object.values(mix).reduce((a, b) => a + b, 0);

  async function generate(keepLocks = true) {
    if (!key) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_key: key, exam_type: examType, total_marks: total,
          exclude_years: excl, require_co: requireCo, internal_choice: choice,
          bloom_mix: mix, locked: keepLocks ? locked : {},
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? r.statusText);
      setPaper(j);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  const subject = subjects?.find((s) => s.subject_key === key);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="serif-display text-4xl text-ink">Set the next paper</h1>
          <p className="text-[13px] text-ink-2 mt-2 max-w-2xl">
            Assembled by constraint satisfaction from questions that were actually
            set. Nothing here is written by a language model — every line traces to
            a question id, its source PDF and the year it was last asked.
          </p>
        </div>
        <SubjectPicker subjects={subjects} value={key} onChange={setKey} />
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* ---- controls ---- */}
        <aside className="border rounded-lg bg-paper-2 p-4 flex flex-col gap-4 lg:sticky lg:top-20">
          <Field label="Exam type">
            <select value={examType} onChange={(e) => setExamType(e.target.value)} className={inp}>
              <option value="SEE">SEE — semester end</option>
              <option value="CIE">CIE — internal</option>
            </select>
          </Field>
          <Field label="Total marks">
            <input type="number" value={total} min={10} max={200}
              onChange={(e) => setTotal(Number(e.target.value))} className={inp} />
          </Field>
          <Field label={`Exclude asked in last ${excl} years`}>
            <input type="range" min={0} max={9} value={excl}
              onChange={(e) => setExcl(Number(e.target.value))} className="w-full accent-mark" />
          </Field>

          <div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-[11px] uppercase tracking-wider text-ink-2">Difficulty mix</span>
              <span className={`mono text-[11px] ${mixTotal === 100 ? "text-ink-2" : "text-mark"}`}>
                {mixTotal}%
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {BLOOMS.map((b) => (
                <div key={b} className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-2 w-[74px] capitalize">{b}</span>
                  <input type="range" min={0} max={100} step={5} value={mix[b]}
                    onChange={(e) => setMix({ ...mix, [b]: Number(e.target.value) })}
                    className="flex-1 accent-mark" />
                  <span className="mono text-[11px] w-8 text-right text-ink-2">{mix[b]}</span>
                </div>
              ))}
            </div>
            {mixTotal !== 100 && (
              <p className="text-[11px] text-mark mt-2">Must total 100% — currently {mixTotal}%.</p>
            )}
          </div>

          <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
            <input type="checkbox" checked={requireCo} onChange={(e) => setRequireCo(e.target.checked)}
              className="accent-mark" />
            Require every CO to appear
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
            <input type="checkbox" checked={choice} onChange={(e) => setChoice(e.target.checked)}
              className="accent-mark" />
            Internal choice (BMSCE format)
          </label>

          <button onClick={() => generate(false)} disabled={busy || !key || mixTotal !== 100}
            className="mt-1 bg-mark text-paper rounded-md py-2 text-[14px] font-medium
                       disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90">
            {busy ? "Assembling…" : "Generate paper"}
          </button>
          {paper && (
            <button onClick={() => generate(true)} disabled={busy}
              className="border rounded-md py-2 text-[13px] text-ink hover:bg-line-2">
              Regenerate {Object.keys(locked).length > 0 && `(keep ${Object.keys(locked).length} locked)`}
            </button>
          )}
        </aside>

        {/* ---- paper ---- */}
        <section className="min-w-0">
          {err && <Banner>{err}</Banner>}
          {busy && !paper && <Skeleton className="h-[520px] w-full" />}
          {!busy && !paper && !err && (
            <Empty title="No paper yet"
              hint="Set the constraints and generate. Any constraint that cannot be met will be stated on the paper, not hidden." />
          )}
          {paper && (
            <PaperView paper={paper} subject={subject} locked={locked} setLocked={setLocked}
                       onRegenerate={() => generate(true)} />
          )}
        </section>
      </div>
    </div>
  );
}

const inp = "w-full border rounded-md bg-paper px-2 py-1.5 text-[13px] text-ink";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[11px] uppercase tracking-wider text-ink-2 block mb-1.5">{label}</span>
      {children}
    </div>
  );
}
