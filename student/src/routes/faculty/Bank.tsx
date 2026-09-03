import { fmt } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { searchBank, type QueryResult } from "../../facultyApi";
import { PageHead, SubjectPicker, useSubjects, SqlToggle, Skeleton, Empty }
  from "../../components/faculty/Shared";

const BLOOMS = ["remember", "understand", "apply", "analyse", "evaluate", "unclassified"];
const SITTINGS = ["Main", "Supplementary", "Makeup", "Reappear", "Grade Improvement"];
const LIMIT = 50;

type Filters = {
  unit?: string; marks?: string;
  bloom?: string; year?: string; sitting?: string;
};

export default function Bank() {
  const { subjects, err: subjectsErr } = useSubjects();
  const [key, setKey] = useState("");
  const [f, setF] = useState<Filters>({ sitting: "Main" });
  const [q, setQ] = useState("");
  const [data, setData] = useState<QueryResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [openRow, setOpenRow] = useState<string | null>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);

  const load = useCallback(async () => {
    if (!key) return;
    setBusy(true);
    try {
      setData(await searchBank({
        subject_key: key, q: q || null,
        unit: f.unit ? Number(f.unit) : null,
        marks: f.marks ? Number(f.marks) : null,
        year: f.year ? Number(f.year) : null,
        bloom: f.bloom ?? null, sitting: f.sitting ?? null,
        limit: LIMIT, offset: page * LIMIT,
      }));
    } finally { setBusy(false); }
  }, [key, f, q, page]);

  useEffect(() => { setPage(0); }, [key, f, q]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  function exportCsv() {
    const cols = ["question_id", "question_text", "marks", "unit_no",
                  "bloom_level", "exam_year", "exam_session", "source_file"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${key}-questions.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page py-8">
      <PageHead title="Question bank"
        right={<SubjectPicker subjects={subjects} value={key} onChange={setKey} failed={!!subjectsErr} />} />

      <div className="card flex gap-2 flex-wrap items-center p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search question text…"
          className="field flex-1 min-w-[220px]" />
        <Sel label="Unit" value={f.unit} onChange={(v) => setF({ ...f, unit: v })}
             options={["1","2","3","4","5","6","7"]} />
        <Sel label="Marks" value={f.marks} onChange={(v) => setF({ ...f, marks: v })}
             options={["2","4","5","6","7","8","10","12","15","20"]} />
        <Sel label="Bloom" value={f.bloom} onChange={(v) => setF({ ...f, bloom: v })} options={BLOOMS} />
        <Sel label="Year" value={f.year} onChange={(v) => setF({ ...f, year: v })}
             options={Array.from({ length: 9 }, (_, i) => String(2024 - i))} />
        <Sel label="Sitting" value={f.sitting} onChange={(v) => setF({ ...f, sitting: v })} options={SITTINGS} />
        <button onClick={exportCsv} disabled={!rows.length} className="btn">Export CSV</button>
        <button onClick={() => { setF({ sitting: "Main" }); setQ(""); }}
          className="text-[12px] text-ink-2 hover:text-mark">Reset</button>
      </div>

      <p className="font-mono text-[11px] text-ink-2 my-3">
        {busy ? "loading…" : `${fmt(total)} questions match`}
        {total > LIMIT && ` · showing ${page * LIMIT + 1}–${Math.min((page + 1) * LIMIT, total)}`}
      </p>

      {busy && !rows.length ? <Skeleton className="h-96" /> : rows.length === 0 ? (
        <Empty title="Nothing matches these filters" />
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table>
              <thead><tr>
                <th>Question</th>
                <th>Unit</th>
                <th className="text-right">Marks</th>
                <th>Bloom</th>
                <th>Year</th>
                <th>Source</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const id = String(r.question_id);
                  return (
                    <motion.tr key={id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30, delay: Math.min(i * 0.02, 0.3) }}
                      onClick={() => setOpenRow(openRow === id ? null : id)}
                      className="cursor-pointer align-top"
                    >
                      <td className="max-w-[520px]">{r.question_text}</td>
                      <td className="font-mono text-ink-2">{r.unit_no ?? "—"}</td>
                      <td className="font-mono text-right">{r.marks ?? "—"}</td>
                      <td className="text-ink-2 text-[12px]">{r.bloom_level ?? "—"}</td>
                      <td className="font-mono text-ink-2">{r.exam_year}</td>
                      <td className="font-mono text-[11px] text-ink-2 max-w-[170px] truncate"
                          title={String(r.source_file)}>{String(r.source_file).split("/").pop()}</td>
                    </motion.tr>
                  );
                })}
                {openRow && rows.find((r) => String(r.question_id) === openRow) && (() => {
                  const r = rows.find((r) => String(r.question_id) === openRow)!;
                  return (
                    <tr key={openRow + "-d"} className="bg-paper">
                      <td colSpan={6}>
                        <div className="font-mono text-[11px] text-ink-2 space-y-0.5">
                          <div>question_id: {r.question_id}</div>
                          <div>source_file: {r.source_file}</div>
                          <div>source_page: {r.source_page ?? "— not recorded in the corpus"}</div>
                          <div>sitting: {r.sitting} · session: {r.exam_session}</div>
                          <div>topic_id: {r.topic_id ?? "— unmapped"}</div>
                          <div>repeat_cluster: {r.repeat_cluster_id ?? "— no near-duplicate"}</div>
                        </div>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 p-3 border-t border-line">
            <button disabled={page === 0} onClick={() => setPage(page - 1)} className="btn">Previous</button>
            <button disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(page + 1)} className="btn">Next</button>
            <span className="font-mono text-[11px] text-ink-2 ml-auto">page {page + 1}</span>
          </div>
          <div className="px-3 pb-3"><SqlToggle sql={data?.sql} ms={data?.ms} engine={data?.engine} fallbackReason={data?.fallback_reason} /></div>
        </div>
      )}
    </div>
  );
}

type SelProps = {
  label: string; value: string | undefined;
  onChange: (v: string | undefined) => void; options: string[];
};

function Sel({ label, value, onChange, options }: SelProps) {
  return (
    <select value={value ?? "all"}
      onChange={(e) => onChange(e.target.value === "all" ? undefined : e.target.value)}
      className="field">
      <option value="all">{label}: any</option>
      {options.map((o) => <option key={o} value={o}>{label}: {o}</option>)}
    </select>
  );
}
