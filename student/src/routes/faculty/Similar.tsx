import { useEffect, useState } from "react";
import { checkSimilar, type QueryResult } from "../../facultyApi";
import { PageHead, SubjectPicker, useSubjects, Banner, Skeleton, Empty, SqlToggle }
  from "../../components/faculty/Shared";

export default function Similar() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  const [probe, setProbe] = useState("");
  const [res, setRes] = useState<QueryResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);

  async function check() {
    setBusy(true); setErr(null); setRes(null);
    try { setRes(await checkSimilar(key, probe)); }
    catch (e: any) { setErr(e?.response?.data?.detail ?? String(e)); }
    finally { setBusy(false); }
  }

  const top = res?.rows?.[0];
  const verdict = !top ? null
    : Number(top.similarity) >= 0.85 ? { tone: "text-mark font-medium", text: "This has been asked before, near-verbatim." }
    : Number(top.similarity) >= 0.6 ? { tone: "text-warn", text: "A close variant of this exists in the archive." }
    : { tone: "text-ink-2", text: "Nothing closely matching. This reads as new." };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <PageHead title="Has this been asked?"
        blurb="Paste a question you are drafting. Matching is weighted by how rare each word is in this subject, so “virtualization” counts and “explain” barely does."
        right={<SubjectPicker subjects={subjects} value={key} onChange={setKey} />} />

      <div className="flex flex-col gap-2">
        <textarea value={probe} onChange={(e) => setProbe(e.target.value)} rows={3}
          placeholder="e.g. Define virtualization and explain the need for it with a neat diagram"
          className="border border-line rounded-lg bg-paper-2 px-3 py-2.5 text-[14px] serif resize-y" />
        <div className="flex items-center gap-3">
          <button onClick={check} disabled={busy || probe.trim().length < 8}
            className="bg-mark text-paper rounded-md px-5 py-2 text-[14px] disabled:opacity-40">
            {busy ? "Checking…" : "Check the archive"}
          </button>
          {verdict && <span className={`text-[13px] ${verdict.tone}`}>{verdict.text}</span>}
        </div>
      </div>

      {err && <div className="mt-4"><Banner>{err}</Banner></div>}
      {busy && <div className="mt-4"><Skeleton className="h-56" /></div>}

      {res && (res.rows.length === 0 ? (
        <div className="mt-4">
          <Empty title="No question shares enough distinctive words" hint="This looks new for this subject." />
        </div>
      ) : (
        <div className="flex flex-col gap-2 mt-5">
          {res.rows.map((r) => (
            <div key={String(r.question_id)}
              className="border border-line rounded-lg bg-paper-2 p-3 flex gap-4 items-start">
              <div className="shrink-0 w-14 text-center">
                <div className={`font-mono text-lg leading-none tabular-nums ${
                  Number(r.similarity) >= 0.85 ? "text-mark"
                  : Number(r.similarity) >= 0.6 ? "text-warn" : "text-ink-2"}`}>
                  {Math.round(Number(r.similarity) * 100)}%
                </div>
                <div className="text-[10px] text-ink-2 mt-0.5">match</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="serif text-[14px] leading-snug">{r.question_text}</p>
                <p className="font-mono text-[11px] text-ink-2 mt-1.5">
                  {r.exam_year} · {r.exam_session} · {r.marks ?? "—"} marks · unit {r.unit_no ?? "—"}
                  {r.course_outcome ? ` · CO${r.course_outcome}` : ""}
                  {r.repeat_cluster_id ? " · in a repeat cluster" : ""}
                </p>
                <p className="font-mono text-[10px] text-ink-2 mt-1">shared: {r.shared_terms}</p>
                <p className="font-mono text-[10px] text-ink-2 truncate" title={String(r.source_file)}>
                  {r.source_file}
                </p>
              </div>
            </div>
          ))}
          <SqlToggle sql={res.sql} ms={res.ms} />
        </div>
      ))}
    </div>
  );
}
