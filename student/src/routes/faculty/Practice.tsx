import { useEffect, useState } from "react";
import axios from "axios";
import { PageHead, SubjectPicker, useSubjects, Banner, Skeleton, Empty, SqlToggle }
  from "../../components/faculty/Shared";

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || "" });

type Item = {
  question_id: string; stem: string; prompt: string;
  options: string[]; answer: string;
  marks: number | null; unit_no: number | null;
  bloom_level: string | null; exam_year: number; source_file: string;
};

/**
 * Practice sets built from real past questions.
 *
 * The stem is always a question that was actually set, carrying its year and
 * source paper. Only the options are assembled, and they are assembled from
 * OTHER real topics in the same subject — so a wrong answer is something a
 * student could genuinely confuse it with, not an invented plausible string.
 * Nothing here writes course content.
 */
export default function Practice() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  const [scope, setScope] = useState<"subject" | "unit">("subject");
  const [unit, setUnit] = useState<number | null>(null);
  const [units, setUnits] = useState<number[]>([]);
  const [count, setCount] = useState(10);

  const [items, setItems] = useState<Item[] | null>(null);
  // provenance for the pool the set was drawn from — the agent wrote the SQL
  const [pool, setPool] = useState<{
    engine?: string; sql?: string; ms?: number;
    cached?: boolean; fallback_reason?: string; pool_size?: number;
  } | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);
  useEffect(() => {
    if (!key) return;
    setItems(null); setPicked({}); setRevealed(false); setUnit(null); setPool(null);
    http.get("/api/faculty/units", { params: { subject_key: key } })
      .then((r) => setUnits(r.data.units ?? []))
      .catch(() => setUnits([]));
  }, [key]);

  async function build() {
    setBusy(true); setErr(null); setPicked({}); setRevealed(false);
    try {
      const r = await http.post("/api/faculty/practice", {
        subject_key: key, scope, unit_no: scope === "unit" ? unit : null, count,
      });
      setItems(r.data.items);
      setPool(r.data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? String(e));
      setItems(null); setPool(null);
    } finally { setBusy(false); }
  }

  const answered = items ? items.filter((i) => picked[i.question_id]).length : 0;
  const correct = items
    ? items.filter((i) => picked[i.question_id] === i.answer).length : 0;

  return (
    <div className="page py-8">
      <div className="mx-auto max-w-[900px]">
      <PageHead title="Practice"
        right={<SubjectPicker subjects={subjects} value={key} onChange={setKey} />} />

      <div className="card flex flex-wrap items-end gap-3 p-3 no-print">
        <label className="flex flex-col gap-1.5">
          <span className="label-cap">Scope</span>
          <select value={scope} onChange={(e) => setScope(e.target.value as "subject" | "unit")}
            className="field">
            <option value="subject">Whole subject</option>
            <option value="unit">One unit</option>
          </select>
        </label>
        {scope === "unit" && (
          <label className="flex flex-col gap-1.5">
            <span className="label-cap">Unit</span>
            <select value={unit ?? ""} onChange={(e) => setUnit(Number(e.target.value))}
              className="field">
              <option value="">choose…</option>
              {units.map((u) => <option key={u} value={u}>Unit {u}</option>)}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="label-cap">Questions</span>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}
            className="field">
            {[5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button onClick={build} disabled={busy || !key || (scope === "unit" && !unit)}
          className="btn-primary">
          {busy ? "Asking the agent…" : items ? "New set" : "Build a set"}
        </button>
        {items && (
          <span className="font-mono text-[12px] text-ink-2 ml-auto tabular-nums">
            {answered}/{items.length} answered
            {revealed && <span className="text-mark"> · {correct} correct</span>}
          </span>
        )}
      </div>

      {err && <div className="mt-4"><Banner>{err}</Banner></div>}
      {busy && !items && <div className="mt-6"><Skeleton className="h-72" /></div>}
      {!busy && !items && !err && (
        <div className="mt-6">
          <Empty title="No set yet" />
        </div>
      )}

      {items && (
        <div className="flex flex-col gap-4 mt-6 k-stagger">
          {items.map((it, n) => {
            const chosen = picked[it.question_id];
            return (
              <div key={it.question_id} className="card p-4">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="font-mono text-[12px] text-ink-2">{n + 1}</span>
                  <p className="text-[15px] leading-snug flex-1">{it.stem}</p>
                </div>
                <p className="text-[12px] text-ink-2 mb-2 pl-7">{it.prompt}</p>
                <div className="flex flex-col gap-1.5 pl-7">
                  {it.options.map((o) => {
                    const isChosen = chosen === o;
                    const isAnswer = o === it.answer;
                    const tone = !revealed
                      ? isChosen ? "border-ink-2 bg-line-2/60" : "border-line hover:border-ink-2"
                      : isAnswer ? "border-ok bg-ok/[0.08]"
                      : isChosen ? "border-mark bg-mark/[0.06]" : "border-line opacity-60";
                    return (
                      <button key={o} disabled={revealed}
                        onClick={() => setPicked({ ...picked, [it.question_id]: o })}
                        className={`text-left border rounded-md px-3 py-1.5 text-[13.5px]
                                    transition-colors duration-150 ${tone}`}>
                        {o}
                        {revealed && isAnswer && <span className="text-ok ml-2">correct</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="font-mono text-[10.5px] text-ink-2 mt-2 pl-7">
                  {it.exam_year} · {it.marks ?? "—"} marks · unit {it.unit_no ?? "—"}
                  {it.bloom_level ? ` · ${it.bloom_level}` : ""}
                </p>
              </div>
            );
          })}

          {/* The pool was chosen by the agent, so the set shows its SQL like
              every other screen. `cached` explains why a re-roll is instant. */}
          <SqlToggle sql={pool?.sql} ms={pool?.cached ? undefined : pool?.ms}
                     engine={pool?.engine} fallbackReason={pool?.fallback_reason} />

          <div className="flex items-center gap-3">
            <button onClick={() => setRevealed(true)} disabled={revealed || answered === 0}
              className="btn-primary">
              {revealed ? `${correct} of ${items.length} correct` : "Check answers"}
            </button>
            {revealed && <button onClick={build} className="btn">Another set</button>}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
