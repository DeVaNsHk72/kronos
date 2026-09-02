"use client";
import { useEffect, useState } from "react";
import { runQuery } from "@/lib/util";

export type Subject = {
  subject_key: string; subject_name: string; subject_code: string;
  semester: number; branch: string; questions: number;
};

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    runQuery("subjects").then((r) => setSubjects(r.rows)).catch((e) => setErr(String(e)));
  }, []);
  return { subjects, err };
}

export function SubjectPicker({
  subjects, value, onChange,
}: { subjects: Subject[] | null; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="subj" className="text-[11px] uppercase tracking-wider text-ink-2">
        Subject
      </label>
      <select id="subj" value={value} onChange={(e) => onChange(e.target.value)}
        className="border rounded-md bg-paper-2 px-3 py-1.5 text-[14px] text-ink
                   min-w-[280px] focus:outline-none focus-visible:ring-0">
        {!subjects && <option>Loading…</option>}
        {subjects?.map((s) => (
          <option key={s.subject_key} value={s.subject_key}>
            {s.subject_name} — {s.questions.toLocaleString()} questions
          </option>
        ))}
      </select>
    </div>
  );
}
