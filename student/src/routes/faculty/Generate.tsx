import { useEffect, useState } from "react";
import { generatePaper } from "../../facultyApi";
import { PageHead, SubjectPicker, useSubjects, Banner, Skeleton, Empty }
  from "../../components/faculty/Shared";

const BLOOMS = ["remember", "understand", "apply", "analyse", "evaluate"];

export default function Generate() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  const [excl, setExcl] = useState(3);
  const [requireCo, setRequireCo] = useState(true);
  const [mix, setMix] = useState<Record<string, number>>({
    remember: 10, understand: 30, apply: 40, analyse: 20, evaluate: 0 });
  const [paper, setPaper] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);
  const mixTotal = Object.values(mix).reduce((a, b) => a + b, 0);

  async function go() {
    setBusy(true); setErr(null);
    try {
      setPaper(await generatePaper({ subject_key: key, exam_type: "CIE",
        exclude_years: excl, require_co: requireCo, bloom_mix: mix }));
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? String(e));
    } finally { setBusy(false); }
  }

  const subject = subjects?.find((s) => s.subject_key === key);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <PageHead title="Set the next paper"
        blurb="Assembled by constraint satisfaction from questions that were actually set. Nothing is written by a language model — every line traces to a question id, its source PDF and the year it was last asked."
        right={<SubjectPicker subjects={subjects} value={key} onChange={setKey} />} />

      <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
        <aside className="border border-line rounded-lg bg-paper-2 p-4 flex flex-col gap-4 no-print">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-ink-2 block mb-1.5">
              Exclude asked in last {excl} years
            </span>
            <input type="range" min={0} max={9} value={excl}
              onChange={(e) => setExcl(Number(e.target.value))} className="w-full accent-mark" />
          </div>
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-[11px] uppercase tracking-wider text-ink-2">Difficulty mix</span>
              <span className={`font-mono text-[11px] ${mixTotal === 100 ? "text-ink-2" : "text-mark"}`}>{mixTotal}%</span>
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
          <label className="flex items-center gap-2 text-[13px] text-ink cursor-pointer">
            <input type="checkbox" checked={requireCo} onChange={(e) => setRequireCo(e.target.checked)}
              className="accent-mark" /> Require every CO to appear
          </label>
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
              hint="Any constraint that cannot be met will be stated on the paper, not hidden." />
          )}
          {paper && <Paper paper={paper} subject={subject} open={open} setOpen={setOpen} />}
        </section>
      </div>
    </div>
  );
}

function Paper({ paper, subject, open, setOpen }: any) {
  return (
    <div className="flex flex-col gap-4">
      {paper.warnings?.length > 0 && (
        <Banner>
          <p className="font-medium mb-1">
            {paper.warnings.length} constraint{paper.warnings.length === 1 ? "" : "s"} relaxed.
          </p>
          <ul className="list-disc ml-4 space-y-0.5 text-[12px] text-ink-2 max-h-36 overflow-y-auto">
            {paper.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
          </ul>
        </Banner>
      )}
      <div className="flex items-center gap-3 flex-wrap no-print">
        <span className="font-mono text-[11px] uppercase tracking-widest text-ink-2">
          structure: {paper.basis}
        </span>
        <span className="font-mono text-[11px] text-ink-2">
          {paper.total_marks} answerable · {paper.printed_marks} printed · excluding since {paper.cutoff_year}
        </span>
        <span className="font-mono text-[11px] text-ink-2">
          CO {paper.cos_covered.join(",") || "none"} of {paper.cos_required.join(",")}
        </span>
        <button onClick={() => window.print()}
          className="ml-auto border border-line rounded-md px-3 py-1.5 text-[13px] hover:bg-line-2">
          Print / PDF
        </button>
      </div>

      <article className="paper-sheet border border-line rounded-lg bg-paper-2 p-8 serif">
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
              <span className="font-mono text-[10px] text-ink-2 uppercase tracking-wider">CO · PO · Marks</span>
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
                        {open === k && (
                          <div className="mt-2 p-2 rounded border border-line bg-paper text-[11px] font-mono text-ink-2 space-y-0.5">
                            <div>question_id: {p.q.question_id}</div>
                            <div>source: {p.q.source_file}</div>
                            <div>page: {p.q.source_page ?? "— not recorded in the corpus"}</div>
                            <div>last asked: {p.q.exam_year} ({p.q.exam_session})</div>
                            <div>unit {p.q.unit_no ?? "—"} · bloom {p.q.bloom_level ?? "unclassified"}</div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-[14px] text-mark italic">No question available — see the notice above.</p>
                    )}
                  </div>
                  <span className="font-mono text-[12px] text-ink-2 whitespace-nowrap pt-0.5">
                    {p.q?.course_outcome ?? "—"} · {p.q?.program_outcome ?? "—"} · {p.marks}
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
