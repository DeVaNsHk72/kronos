"use client";
import { useCallback, useEffect, useState } from "react";
import { SubjectPicker, useSubjects } from "@/components/SubjectPicker";
import { SqlToggle, Skeleton, Empty } from "@/components/Bits";

const BLOOMS = ["remember", "understand", "apply", "analyse", "evaluate", "unclassified"];
const SITTINGS = ["Main", "Supplementary", "Makeup", "Reappear", "Grade Improvement"];

export default function Bank() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  type Filters = {
    unit?: string; marks?: string; co?: string;
    bloom?: string; year?: string; sitting?: string;
  };
  const [f, setF] = useState<Filters>({ sitting: "Main" });
  const [q, setQ] = useState("");
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const LIMIT = 50;

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);

  const load = useCallback(async () => {
    if (!key) return;
    setBusy(true);
    const r = await fetch("/api/bank", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_key: key, ...f, q, limit: LIMIT, offset: page * LIMIT }),
    });
    setData(await r.json()); setBusy(false);
  }, [key, f, q, page]);

  useEffect(() => { setPage(0); }, [key, f, q]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="serif-display text-4xl text-ink">Question bank</h1>
          <p className="text-[13px] text-ink-2 mt-2">
            Every question in the archive, with the paper and page it came from.
          </p>
        </div>
        <SubjectPicker subjects={subjects} value={key} onChange={setKey} />
      </div>

      <div className="flex gap-2 flex-wrap items-center border rounded-lg bg-paper-2 p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search question text…"
          className="border rounded-md bg-paper px-3 py-1.5 text-[13px] flex-1 min-w-[220px]" />
        <Sel label="Unit" value={f.unit} onChange={(v) => setF({ ...f, unit: v })}
             options={[1, 2, 3, 4, 5, 6, 7].map(String)} />
        <Sel label="Marks" value={f.marks} onChange={(v) => setF({ ...f, marks: v })}
             options={[2, 4, 5, 6, 7, 8, 10, 12, 15, 20].map(String)} />
        <Sel label="CO" value={f.co} onChange={(v) => setF({ ...f, co: v })}
             options={[1, 2, 3, 4, 5, 6].map(String)} />
        <Sel label="Bloom" value={f.bloom} onChange={(v) => setF({ ...f, bloom: v })} options={BLOOMS} />
        <Sel label="Year" value={f.year} onChange={(v) => setF({ ...f, year: v })}
             options={Array.from({ length: 10 }, (_, i) => String(2024 - i))} />
        <Sel label="Sitting" value={f.sitting} onChange={(v) => setF({ ...f, sitting: v })}
             options={SITTINGS} />
        <button onClick={() => {
            const cols = ["question_id","question_text","marks","unit_no","course_outcome",
                          "program_outcome","bloom_level","exam_year","exam_session","source_file"];
            const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
            const csv = [cols.join(","), ...rows.map((r: any) => cols.map((c) => esc(r[c])).join(","))].join("\n");
            const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
            const a = document.createElement("a");
            a.href = url; a.download = `${key}-questions.csv`; a.click();
            URL.revokeObjectURL(url);
          }}
          disabled={!rows.length}
          className="border rounded-md px-3 py-1.5 text-[12px] hover:bg-line-2 disabled:opacity-40">
          Export CSV
        </button>
        <button onClick={() => { setF({ sitting: "Main" }); setQ(""); }}
          className="text-[12px] text-ink-2 hover:text-mark underline underline-offset-2">reset</button>
      </div>

      <p className="mono text-[11px] text-ink-2">
        {busy ? "loading…" : `${total.toLocaleString()} questions match`}
        {total > LIMIT && ` · showing ${page * LIMIT + 1}–${Math.min((page + 1) * LIMIT, total)}`}
      </p>

      {busy && !rows.length ? <Skeleton className="h-96" /> : rows.length === 0 ? (
        <Empty title="Nothing matches these filters" hint="Try clearing the sitting or year filter." />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] dense">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-2">
                  <th className="px-3 py-2 font-medium">Question</th>
                  <th className="px-3 py-2 font-medium">U</th>
                  <th className="px-3 py-2 font-medium text-right">Marks</th>
                  <th className="px-3 py-2 font-medium">CO</th>
                  <th className="px-3 py-2 font-medium">Bloom</th>
                  <th className="px-3 py-2 font-medium">Year</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <>
                    <tr key={r.question_id} onClick={() => setOpenRow(openRow === r.question_id ? null : r.question_id)}
                        className="border-t hover:bg-line-2/40 cursor-pointer align-top">
                      <td className="px-3 py-2 serif max-w-[520px]">{r.question_text}</td>
                      <td className="px-3 py-2 mono text-ink-2">{r.unit_no ?? "—"}</td>
                      <td className="px-3 py-2 mono text-right">{r.marks ?? "—"}</td>
                      <td className="px-3 py-2 mono text-ink-2">{r.course_outcome ?? "—"}</td>
                      <td className="px-3 py-2 text-ink-2 text-[12px]">{r.bloom_level ?? "—"}</td>
                      <td className="px-3 py-2 mono text-ink-2">{r.exam_year}</td>
                      <td className="px-3 py-2 mono text-[11px] text-ink-2 max-w-[180px] truncate"
                          title={r.source_file}>{r.source_file?.split("/").pop()}</td>
                    </tr>
                    {openRow === r.question_id && (
                      <tr key={r.question_id + "-d"} className="bg-paper">
                        <td colSpan={7} className="px-3 py-3">
                          <div className="mono text-[11px] text-ink-2 space-y-0.5">
                            <div>question_id: {r.question_id}</div>
                            <div>source_file: {r.source_file}</div>
                            <div>source_page: {r.source_page ?? "— not recorded in the corpus"}</div>
                            <div>sitting: {r.sitting} · session: {r.exam_session}</div>
                            <div>topic_id: {r.topic_id ?? "— unmapped"}</div>
                            <div>repeat_cluster: {r.repeat_cluster_id ?? "— no near-duplicate"}</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 p-3 border-t">
            <button disabled={page === 0} onClick={() => setPage(page - 1)}
              className="border rounded-md px-3 py-1 text-[12px] disabled:opacity-40">Previous</button>
            <button disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(page + 1)}
              className="border rounded-md px-3 py-1 text-[12px] disabled:opacity-40">Next</button>
            <span className="mono text-[11px] text-ink-2 ml-auto">page {page + 1}</span>
          </div>
          {data?.sql && <div className="px-3 pb-3"><SqlToggle sql={data.sql} ms={data.ms} backend={data.backend} /></div>}
        </div>
      )}
    </div>
  );
}

type SelProps = {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: string[];
};

function Sel({ label, value, onChange, options }: SelProps) {
  return (
    <select value={value ?? "all"} onChange={(e) => onChange(e.target.value === "all" ? undefined : e.target.value)}
      className="border rounded-md bg-paper px-2 py-1.5 text-[12px] text-ink">
      <option value="all">{label}: any</option>
      {options.map((o) => <option key={o} value={o}>{label}: {o}</option>)}
    </select>
  );
}
