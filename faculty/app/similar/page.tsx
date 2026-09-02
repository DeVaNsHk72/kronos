"use client";
import { useState } from "react";
import { SubjectPicker, useSubjects } from "@/components/SubjectPicker";
import { Banner, Skeleton, Empty, SqlToggle } from "@/components/Bits";

export default function Similar() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  const [probe, setProbe] = useState("");
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (subjects?.length && !key) setKey(subjects[0].subject_key);

  async function check() {
    setBusy(true); setErr(null); setRes(null);
    try {
      const r = await fetch("/api/similar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_key: key, probe }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? r.statusText);
      setRes(j);
    } catch (e) { setErr(String(e)); } finally { setBusy(false); }
  }

  const top = res?.rows?.[0];
  const verdict = !top ? null
    : top.similarity >= 0.85 ? { tone: "high", text: "This has been asked before, near-verbatim." }
    : top.similarity >= 0.6 ? { tone: "mid", text: "A close variant of this exists in the archive." }
    : { tone: "low", text: "Nothing closely matching. This reads as new." };

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="serif-display text-4xl text-ink">Has this been asked?</h1>
          <p className="text-[13px] text-ink-2 mt-2 max-w-2xl">
            Paste a question you are drafting. Matching is weighted by how rare each
            word is in this subject, so &ldquo;virtualization&rdquo; counts and
            &ldquo;explain&rdquo; barely does.
          </p>
        </div>
        <SubjectPicker subjects={subjects} value={key} onChange={setKey} />
      </div>

      <div className="flex flex-col gap-2">
        <textarea value={probe} onChange={(e) => setProbe(e.target.value)}
          rows={3} placeholder="e.g. Define virtualization and explain the need for it with a neat diagram"
          className="border rounded-lg bg-paper-2 px-3 py-2.5 text-[14px] serif resize-y" />
        <div className="flex items-center gap-3">
          <button onClick={check} disabled={busy || probe.trim().length < 8}
            className="bg-mark text-paper rounded-md px-5 py-2 text-[14px] disabled:opacity-40">
            {busy ? "Checking…" : "Check the archive"}
          </button>
          {verdict && (
            <span className={`text-[13px] ${verdict.tone === "high" ? "text-mark font-medium"
              : verdict.tone === "mid" ? "text-warn" : "text-ink-2"}`}>
              {verdict.text}
            </span>
          )}
        </div>
      </div>

      {err && <Banner>{err}</Banner>}
      {busy && <Skeleton className="h-64" />}
      {res && (res.rows.length === 0
        ? <Empty title="No question shares enough distinctive words" hint="This looks new for this subject." />
        : (
          <div className="flex flex-col gap-2">
            {res.rows.map((r: any) => (
              <div key={r.question_id}
                className="border rounded-lg bg-paper-2 p-3 flex gap-4 items-start">
                <div className="shrink-0 w-14 text-center">
                  <div className={`mono text-lg leading-none
                    ${r.similarity >= 0.85 ? "text-mark" : r.similarity >= 0.6 ? "text-warn" : "text-ink-2"}`}>
                    {Math.round(r.similarity * 100)}%
                  </div>
                  <div className="text-[10px] text-ink-2 mt-0.5">match</div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="serif text-[14px] leading-snug">{r.question_text}</p>
                  <p className="mono text-[11px] text-ink-2 mt-1.5">
                    {r.exam_year} · {r.exam_session} · {r.marks ?? "—"} marks · unit {r.unit_no ?? "—"}
                    {r.course_outcome ? ` · CO${r.course_outcome}` : ""}
                    {r.repeat_cluster_id ? " · part of a repeat cluster" : ""}
                  </p>
                  <p className="mono text-[10px] text-ink-2 mt-1">shared: {r.shared_terms}</p>
                  <p className="mono text-[10px] text-ink-2 truncate" title={r.source_file}>
                    {r.source_file}
                  </p>
                </div>
              </div>
            ))}
            <SqlToggle sql={res.sql} ms={res.ms} backend={res.backend} />
          </div>
        ))}
    </div>
  );
}
