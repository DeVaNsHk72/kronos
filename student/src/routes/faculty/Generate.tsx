import { useEffect, useState } from "react";
import { generatePaper } from "../../facultyApi";
import { PageHead, SubjectPicker, useSubjects, Banner, Skeleton, Empty }
  from "../../components/faculty/Shared";

const BLOOMS = ["remember", "understand", "apply", "analyse", "evaluate"];

export default function Generate() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  const [examType, setExamType] = useState("SEE");
  const [excl, setExcl] = useState(3);
  const [mix, setMix] = useState<Record<string, number>>({
    remember: 10, understand: 30, apply: 40, analyse: 20, evaluate: 0 });
  const [paper, setPaper] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);

  async function go() {
    setBusy(true); setErr(null);
    try {
      setPaper(await generatePaper({ subject_key: key, exam_type: examType,
        exclude_years: excl, bloom_mix: mix,
        // A blueprint saved on the Blueprint screen is authoritative for this
        // subject; the declared format is only the fallback.
        blueprint: (() => {
          try { return JSON.parse(localStorage.getItem("kronos-blueprints") || "{}")[key] ?? null; }
          catch { return null; }
        })() }));
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? String(e));
    } finally { setBusy(false); }
  }

  const subject = subjects?.find((s) => s.subject_key === key);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHead title="Set the next paper"
        blurb="Assembled from questions that were actually set. Nothing is written by a language model — every line traces to a real past paper and the year it was last asked."
        right={<SubjectPicker subjects={subjects} value={key} onChange={setKey} />} />

      <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
        <aside className="border border-line rounded-lg bg-paper-2 p-4 flex flex-col gap-4 no-print">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-ink-2 block mb-1.5">Exam</span>
            <select value={examType} onChange={(e) => setExamType(e.target.value)}
              className="w-full border border-line rounded-md bg-paper px-2 py-1.5 text-[13px]">
              <option value="SEE">SEE — 100 marks, 5 units × 20</option>
              <option value="CIE">CIE — 40 marks, Parts A/B/C</option>
            </select>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider text-ink-2 block mb-1.5">
              Exclude asked in last {excl} years
            </span>
            <input type="range" min={0} max={9} value={excl}
              onChange={(e) => setExcl(Number(e.target.value))} className="w-full accent-mark" />
          </div>
          <div>
            <div className="mb-2">
              <span className="text-[11px] uppercase tracking-wider text-ink-2">Difficulty preference</span>
              <span className="block text-[11px] text-ink-2 mt-0.5">
                Slots prefer the highest-weighted level first. A level at 0 is never preferred.
              </span>
            </div>
            {BLOOMS.map((b) => (
              <div key={b} className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] text-ink-2 w-[70px] capitalize">{b}</span>
                <input type="range" min={0} max={100} step={5} value={mix[b]}
                  onChange={(e) => setMix({ ...mix, [b]: Number(e.target.value) })}
                  className="flex-1 accent-mark" />
                <span className="font-mono text-[11px] w-7 text-right text-ink-2">{mix[b]}</span>
              </div>
            ))}
          </div>
          <button onClick={go} disabled={busy || !key}
            className="bg-mark text-paper rounded-md py-2 text-[14px] font-medium disabled:opacity-40">
            {busy ? "Assembling…" : paper ? "Regenerate" : "Generate paper"}
          </button>
        </aside>

        <section className="min-w-0">
          {err && <Banner>{err}</Banner>}
          {busy && !paper && <Skeleton className="h-[480px] w-full" />}
          {!busy && !paper && !err && (
            <Empty title="No paper yet"
              hint="Choose the exam and generate. Every question comes from a real past paper." />
          )}
          {paper && <Paper paper={paper} subject={subject} open={open} setOpen={setOpen} />}
        </section>
      </div>
    </div>
  );
}

function Paper({ paper, subject, open, setOpen }: any) {
  return (
    // k-rise: the agent takes 20-60s, then a whole paper would otherwise
    // teleport in. Fade + 6px rise, ease-out 220ms.
    <div className="flex flex-col gap-4 k-rise">
      <div className="flex items-center gap-3 flex-wrap no-print">
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink-2">
          structure: {paper.basis}
        </span>
        <span className="font-mono text-[11px] text-ink-2">
          {paper.total_marks} answerable · {paper.printed_marks} printed · excluding since {paper.cutoff_year}
        </span>
        <button onClick={() => window.print()}
          className="ml-auto border border-line rounded-md px-3 py-1.5 text-[13px] hover:bg-line-2">
          Print / PDF
        </button>
      </div>

      {/* sections stagger 40ms so the eye is led down the page rather than
          hit with the whole paper at once */}
      <article className="paper-sheet border border-line rounded-lg bg-paper-2 p-8 serif k-stagger">
        <header className="text-center border-b border-line pb-4 mb-5">
          <p className="font-semibold text-[17px] text-ink">B.M.S. College of Engineering, Bengaluru-560019</p>
          <p className="text-[13px] text-ink-2">Autonomous Institute Affiliated to VTU</p>
        </header>
        <div className="grid grid-cols-2 gap-y-1 text-[13px] mb-4">
          <span>Course: <strong>{subject?.subject_name ?? paper.subject_key}</strong></span>
          <span>Max Marks: <strong className="font-mono">{paper.total_marks}</strong></span>
          <span>Course Code: <strong className="font-mono">{subject?.subject_code ?? "—"}</strong></span>
          <span>Semester: <strong>{subject?.semester ?? "—"}</strong></span>
        </div>
        <p className="text-[12px] text-ink-2 border-y border-line py-2 mb-5">
          <strong>Instructions:</strong>{" "}
          {(paper.instructions ?? []).map((t: string, i: number) => <span key={i}>{i + 1}. {t} </span>)}
        </p>

        {paper.sections.map((sec: any) => (
          <section key={sec.label} className="mb-7">
            <div className="flex items-baseline justify-between border-b border-line pb-1 mb-1">
              <h3 className="font-semibold text-[14px] tracking-wide">{sec.label}</h3>
              <span className="font-mono text-[10px] text-ink-2 uppercase tracking-wider">Marks</span>
            </div>
            <p className="text-[12px] text-ink-2 mb-2 italic">{sec.note}</p>
            {sec.picks.map((p: any) => {
              const k = String(p.n);
              return (
                <div key={k} className="grid grid-cols-[28px_1fr_auto] gap-2 py-1.5 items-start
                                        border-b border-line-2 last:border-0">
                  <span className="font-mono text-[12px] text-ink-2 pt-0.5">{p.n}</span>
                  <div className="min-w-0">
                    {p.q ? (
                      <>
                        <p className="text-[14px] leading-snug">{p.q.question_text}</p>
                        <button onClick={() => setOpen(open === k ? null : k)}
                          className="font-mono text-[10px] uppercase tracking-wider text-ink-2 hover:text-mark mt-1 no-print">
                          {open === k ? "hide source" : "source"}
                        </button>
                        <div className="disclosure" data-open={open === k}>
                          <div>
                            <div className="mt-2 p-2 rounded border border-line bg-paper text-[11px] font-mono text-ink-2 space-y-0.5">
                              <div>question_id: {p.q.question_id}</div>
                              <div>source: {p.q.source_file}</div>
                              <div>page: {p.q.source_page ?? "— not recorded in the corpus"}</div>
                              <div>last asked: {p.q.exam_year} ({p.q.exam_session})</div>
                              <div>unit {p.q.unit_no ?? "—"} · bloom {p.q.bloom_level ?? "unclassified"}</div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-[14px] text-mark italic">No question available — see the notice above.</p>
                    )}
                  </div>
                  <span className="font-mono text-[12px] text-ink-2 whitespace-nowrap pt-0.5">
                    {p.marks}
                  </span>
                </div>
              );
            })}
          </section>
        ))}
      </article>
    </div>
  );
}
