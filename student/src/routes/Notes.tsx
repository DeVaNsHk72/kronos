import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FilePdf, DownloadSimple } from "@phosphor-icons/react";

const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || "" });
const API = import.meta.env.VITE_API_URL || "";

type Doc = {
  sha: string; subject: string; file: string;
  asset: "notes" | "exam_paper";
  pages: number | null; size_mb: number | null;
  branches: string[]; sems: string[]; code: string | null;
};

/**
 * The notes and papers themselves, not just what the tables say about them.
 *
 * Listed from the OCR manifest, so a document appears here only if it was
 * actually read — the list never offers a file the rest of the system has no
 * text for.
 */
export default function Notes() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "notes" | "exam_paper">("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    http.get<{ documents: Doc[] }>("/api/notes")
      .then((r) => setDocs(r.data.documents))
      .catch(() => setDocs([]));
  }, []);

  const bySubject = useMemo(() => {
    if (!docs) return [];
    const t = q.trim().toLowerCase();
    const rows = docs.filter((d) =>
      (kind === "all" || d.asset === kind) &&
      (!t || d.subject.toLowerCase().includes(t) || d.file.toLowerCase().includes(t)));
    const m = new Map<string, Doc[]>();
    for (const d of rows) (m.get(d.subject) ?? m.set(d.subject, []).get(d.subject)!).push(d);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [docs, q, kind]);

  return (
    <div className="page py-8">
      <h1 className="title-page mb-6">Notes &amp; papers</h1>

      <div className="card flex gap-2 flex-wrap items-center p-3 mb-5">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search subject or file…"
          className="field flex-1 min-w-[200px]" />
        {(["all", "notes", "exam_paper"] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)}
            className={`btn ${kind === k ? "border-ink text-ink" : "text-ink-2"}`}>
            {k === "all" ? "Everything" : k === "notes" ? "Notes" : "Papers"}
          </button>
        ))}
      </div>

      {!docs ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-line-2 rounded animate-pulse" />)}
        </div>
      ) : bySubject.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg py-12 text-center">
          <p className="text-[14px] text-ink-2">Nothing matches</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bySubject.map(([subject, items]) => {
            const isOpen = open === subject;
            const notes = items.filter((d) => d.asset === "notes").length;
            const papers = items.length - notes;
            return (
              <div key={subject} className="card overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : subject)}
                  className="w-full text-left px-4 py-3 flex items-baseline gap-3
                             hover:bg-line-2/40 transition-colors duration-150">
                  <span className="text-[14px] text-ink flex-1">{subject}</span>
                  <span className="font-mono text-[11px] text-ink-2 tabular-nums">
                    {notes > 0 && `${notes} notes`}{notes > 0 && papers > 0 && " · "}
                    {papers > 0 && `${papers} papers`}
                  </span>
                </button>

                <div className="disclosure" data-open={isOpen}>
                  <div>
                    <div className="border-t border-line-2">
                      {items.map((d) => (
                        <div key={d.sha}
                          className="flex items-center gap-3 px-4 py-2 border-b border-line-2 last:border-0">
                          <FilePdf size={16} weight="regular"
                            className={d.asset === "notes" ? "text-mark" : "text-ink-2"} />
                          <a href={`${API}/api/notes/file/${d.sha}`} target="_blank" rel="noreferrer"
                            className="text-[13.5px] text-ink hover:text-mark flex-1 truncate">
                            {d.file}
                          </a>
                          <span className="font-mono text-[11px] text-ink-2 tabular-nums whitespace-nowrap">
                            {d.pages ?? "—"}p{d.size_mb ? ` · ${d.size_mb}MB` : ""}
                          </span>
                          <a href={`${API}/api/notes/file/${d.sha}?download=true`}
                            className="text-ink-2 hover:text-mark" aria-label={`Download ${d.file}`}>
                            <DownloadSimple size={15} />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
