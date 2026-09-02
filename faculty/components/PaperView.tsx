"use client";
import { useState } from "react";
import { Banner } from "@/components/Bits";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/**
 * The paper, rendered in the BMSCE format faculty already read, with the
 * provenance of every line one click away. Constraint failures are printed on
 * the paper itself rather than tucked into a console — a paper that silently
 * misses a CO is the failure mode this whole feature exists to avoid.
 */
export function PaperView({ paper, subject, locked, setLocked, onRegenerate }: any) {
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const shortfall = paper.total_marks !== paper.target_marks;
  const missingCos = (paper.cos_required ?? []).filter(
    (c: number) => !(paper.cos_covered ?? []).includes(c));

  async function exportDocx() {
    setExporting(true);
    try {
      const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import("docx");
      const { saveAs } = await import("file-saver");
      const kids: any[] = [];
      const line = (text: string, o: any = {}) =>
        new Paragraph({ alignment: o.center ? AlignmentType.CENTER : undefined,
          spacing: { after: o.after ?? 60 },
          children: [new TextRun({ text, bold: o.bold, size: o.size ?? 22, font: "Cambria" })] });

      kids.push(line("B.M.S. College of Engineering, Bengaluru-560019", { bold: true, center: true, size: 26 }));
      kids.push(line("Autonomous Institute Affiliated to VTU", { center: true }));
      kids.push(line(`${new Date().toLocaleString("en-GB", { month: "long", year: "numeric" })} Semester End Main Examinations`, { center: true, after: 160 }));
      kids.push(line(`Programme: B.E.        Semester: ${subject?.semester ?? "—"}`));
      kids.push(line(`Course Code: ${subject?.subject_code ?? "—"}        Max Marks: ${paper.total_marks}`));
      kids.push(line(`Course: ${subject?.subject_name ?? paper.subject_key}        Duration: 3 hrs.`, { after: 160 }));
      kids.push(line("Instructions: 1. All units have internal choice, answer one complete question from each unit.", { after: 200 }));

      for (const sec of paper.sections ?? []) {
        kids.push(line(sec.label, { bold: true, after: 40 }));
        kids.push(line(sec.note, { size: 18, after: 100 }));
        for (const p of sec.picks) {
          kids.push(line(
            `${p.n}. ${p.q ? p.q.question_text.replace(/\s+/g, " ") : "[no question available]"}` +
            `    [CO${p.q?.course_outcome ?? "-"}  ${p.marks}m]`));
        }
        kids.push(line("", { after: 120 }));
      }
      for (const u of paper.units ?? []) {
        kids.push(line(`UNIT - ${ROMAN[u.unit] ?? u.unit}`, { bold: true, after: 100 }));
        u.alternatives.forEach((alt: any, i: number) => {
          if (i > 0) kids.push(line("OR", { center: true, bold: true }));
          alt.picks.forEach((p: any, j: number) => {
            const label = j === 0 ? `${alt.qno}  ${p.part})` : `   ${p.part})`;
            kids.push(line(
              `${label} ${p.q ? p.q.question_text.replace(/\s+/g, " ") : "[no question available]"}` +
              `    [CO${p.q?.course_outcome ?? "-"}  ${p.marks}m]`));
          });
        });
      }
      if (paper.warnings?.length) {
        kids.push(line("", { after: 200 }));
        kids.push(line("Constraints relaxed during assembly:", { bold: true }));
        paper.warnings.forEach((w: string) => kids.push(line(`• ${w}`, { size: 18 })));
      }
      const blob = await Packer.toBlob(new Document({ sections: [{ children: kids }] }));
      saveAs(blob, `${paper.subject_key}-${paper.exam_type}-paper.docx`);
    } finally { setExporting(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ---- constraint report, always visible ---- */}
      {(paper.warnings?.length > 0 || shortfall || missingCos.length > 0) && (
        <Banner>
          <p className="font-medium mb-1">
            {missingCos.length > 0
              ? `CO ${missingCos.join(", ")} could not be placed.`
              : shortfall
              ? `Paper totals ${paper.total_marks} marks, not ${paper.target_marks}.`
              : `${paper.warnings.length} constraint${paper.warnings.length === 1 ? "" : "s"} relaxed.`}
          </p>
          <ul className="list-disc ml-4 space-y-0.5 text-[12px] text-ink-2 max-h-40 overflow-y-auto">
            {paper.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
          </ul>
        </Banner>
      )}

      <div className="flex items-center gap-3 flex-wrap no-print">
        <span className="mono text-[11px] uppercase tracking-widest text-ink-2">
          structure: {paper.basis}
        </span>
        <span className="mono text-[11px] text-ink-2">
          {paper.total_marks} marks answerable
          {paper.printed_marks && paper.printed_marks !== paper.total_marks
            ? ` · ${paper.printed_marks} printed`
            : ""} · excluding since {paper.cutoff_year}
        </span>
        <span className="mono text-[11px] text-ink-2">
          CO {paper.cos_covered.join(",") || "none"} of {paper.cos_required.join(",")}
        </span>
        <button onClick={exportDocx} disabled={exporting}
          className="ml-auto border rounded-md px-3 py-1.5 text-[13px] hover:bg-line-2">
          {exporting ? "Exporting…" : "Export DOCX"}
        </button>
        <button onClick={() => window.print()}
          className="border rounded-md px-3 py-1.5 text-[13px] hover:bg-line-2">Print / PDF</button>
      </div>

      {/* ---- the paper ---- */}
      <article className="paper-sheet border rounded-lg bg-paper-2 p-8 serif">
        <header className="text-center border-b pb-4 mb-5">
          <p className="font-semibold text-[17px] text-ink">B.M.S. College of Engineering, Bengaluru-560019</p>
          <p className="text-[13px] text-ink-2">Autonomous Institute Affiliated to VTU</p>
          <p className="text-[13px] text-ink-2 mt-1">
            {new Date().toLocaleString("en-GB", { month: "long", year: "numeric" })} Semester End Main Examinations
          </p>
        </header>
        <div className="grid grid-cols-2 gap-y-1 text-[13px] mb-4">
          <span>Programme: <strong>B.E.</strong></span>
          <span>Semester: <strong>{subject?.semester ?? "—"}</strong></span>
          <span>Course Code: <strong className="mono">{subject?.subject_code ?? "—"}</strong></span>
          <span>Max Marks: <strong className="mono">{paper.total_marks}</strong></span>
          <span>Course: <strong>{subject?.subject_name ?? paper.subject_key}</strong></span>
          <span>Duration: <strong>3 hrs.</strong></span>
        </div>
        <p className="text-[12px] text-ink-2 border-y py-2 mb-5">
          <strong>Instructions:</strong>{" "}
          {(paper.instructions ?? [
            "All units have internal choice, answer one complete question from each unit.",
          ]).map((t: string, i: number) => <span key={i}>{i + 1}. {t} </span>)}
        </p>

        {/* Declared format (CIE): PART A / B / C with printed choice. */}
        {paper.sections?.map((sec: any) => (
          <section key={sec.label} className="mb-7">
            <div className="flex items-baseline justify-between border-b pb-1 mb-1">
              <h3 className="font-semibold text-[14px] tracking-wide">{sec.label}</h3>
              <span className="mono text-[10px] text-ink-2 uppercase tracking-wider">
                CO · PO · Marks
              </span>
            </div>
            <p className="text-[12px] text-ink-2 mb-2 italic">{sec.note}</p>
            {sec.picks.map((p: any) => {
              const k = String(p.n);
              const isLocked = Boolean(locked[k]);
              return (
                <div key={k} className="group grid grid-cols-[30px_1fr_auto] gap-2 py-1.5
                                        items-start border-b border-line-2 last:border-0">
                  <span className="mono text-[12px] text-ink-2 pt-0.5">{p.n}</span>
                  <div className="min-w-0">
                    {p.q ? (
                      <>
                        <p className="text-[14px] leading-snug">{p.q.question_text}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <button onClick={() => setOpen(open === k ? null : k)}
                            className="mono text-[10px] uppercase tracking-wider text-ink-2 hover:text-mark">
                            {open === k ? "hide source" : "source"}
                          </button>
                          <button onClick={() => {
                              const nx = { ...locked };
                              if (isLocked) delete nx[k]; else nx[k] = p.q.question_id;
                              setLocked(nx);
                            }}
                            className={`mono text-[10px] uppercase tracking-wider hover:text-mark
                              ${isLocked ? "text-mark" : "text-ink-2"}`}>
                            {isLocked ? "● locked" : "lock"}
                          </button>
                        </div>
                        {open === k && (
                          <div className="mt-2 p-2 rounded border bg-paper text-[11px] mono text-ink-2 space-y-0.5">
                            <div>question_id: {p.q.question_id}</div>
                            <div>source: {p.q.source_file}</div>
                            <div>page: {p.q.source_page ?? "— not recorded in the corpus"}</div>
                            <div>last asked: {p.q.exam_year} ({p.q.exam_session})</div>
                            <div>unit: {p.q.unit_no ?? "—"} · bloom: {p.q.bloom_level ?? "unclassified"}</div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-[14px] text-mark italic">
                        No question available for this slot — see the notice above.
                      </p>
                    )}
                  </div>
                  <span className="mono text-[12px] text-ink-2 whitespace-nowrap pt-0.5">
                    {p.q?.course_outcome ?? "—"} · {p.q?.program_outcome ?? "—"} · {p.marks}
                  </span>
                </div>
              );
            })}
          </section>
        ))}

        {paper.units?.map((u: any) => (
          <section key={u.unit} className="mb-7">
            <div className="flex items-baseline justify-between border-b pb-1 mb-2">
              <h3 className="font-semibold text-[14px] tracking-wide">UNIT - {ROMAN[u.unit] ?? u.unit}</h3>
              <span className="mono text-[10px] text-ink-2 uppercase tracking-wider">CO · PO · Marks</span>
            </div>
            {u.alternatives.map((alt: any, ai: number) => (
              <div key={alt.qno}>
                {ai > 0 && <p className="text-center my-2 text-[12px] font-semibold tracking-widest">OR</p>}
                {alt.picks.map((p: any, j: number) => {
                  const k = `${alt.qno}${p.part}`;
                  const isLocked = Boolean(locked[k]);
                  return (
                    <div key={k} className="group grid grid-cols-[34px_1fr_auto] gap-2 py-1.5 items-start
                                            border-b border-line-2 last:border-0">
                      <span className="mono text-[12px] text-ink-2 pt-0.5">
                        {j === 0 ? alt.qno : ""} {p.part})
                      </span>
                      <div className="min-w-0">
                        {p.q ? (
                          <>
                            <p className="text-[14px] leading-snug">{p.q.question_text}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <button onClick={() => setOpen(open === k ? null : k)}
                                className="mono text-[10px] uppercase tracking-wider text-ink-2 hover:text-mark">
                                {open === k ? "hide source" : "source"}
                              </button>
                              <button
                                onClick={() => {
                                  const n = { ...locked };
                                  if (isLocked) delete n[k]; else n[k] = p.q.question_id;
                                  setLocked(n);
                                }}
                                className={`mono text-[10px] uppercase tracking-wider hover:text-mark
                                  ${isLocked ? "text-mark" : "text-ink-2"}`}>
                                {isLocked ? "● locked" : "lock"}
                              </button>
                              <button onClick={onRegenerate}
                                className="mono text-[10px] uppercase tracking-wider text-ink-2 hover:text-mark
                                           opacity-0 group-hover:opacity-100 transition-opacity">
                                swap
                              </button>
                            </div>
                            {open === k && (
                              <div className="mt-2 p-2 rounded border bg-paper text-[11px] mono text-ink-2 space-y-0.5">
                                <div>question_id: {p.q.question_id}</div>
                                <div>source: {p.q.source_file}</div>
                                <div>page: {p.q.source_page ?? "— not recorded in the corpus"}</div>
                                <div>last asked: {p.q.exam_year} ({p.q.exam_session})</div>
                                <div>bloom: {p.q.bloom_level ?? "unclassified"}</div>
                                {p.q.repeat_cluster_id && <div>repeat cluster: {p.q.repeat_cluster_id}</div>}
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-[14px] text-mark italic">
                            No question available for this slot — see the notice above.
                          </p>
                        )}
                      </div>
                      <span className="mono text-[12px] text-ink-2 whitespace-nowrap pt-0.5">
                        {p.q?.course_outcome ?? "—"} · {p.q?.program_outcome ?? "—"} · {p.marks}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
