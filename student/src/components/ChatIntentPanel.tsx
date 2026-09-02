import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import type { ChatIntent } from "../api";

const KIND_LABEL: Record<string, string> = {
  find: "Retrieve questions",
  study: "Study guidance",
  compare: "Compare years",
  pattern: "Find patterns",
  other: "General help",
};

export default function ChatIntentPanel({
  intent,
  defaultOpen = false,
}: {
  intent: ChatIntent;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const rows: [string, string][] = [];
  if (intent.kind) rows.push(["Intent", KIND_LABEL[intent.kind] ?? intent.kind]);
  if (intent.course_name || intent.course_code)
    rows.push(["Course", String(intent.course_name ?? intent.course_code)]);
  if (intent.branch) rows.push(["Branch", String(intent.branch).replace(/_/g, " ")]);
  if (intent.semester) rows.push(["Semester", String(intent.semester)]);
  if (intent.unit != null) rows.push(["Unit", String(intent.unit)]);
  const lo = intent.year_min;
  const hi = intent.year_max;
  if (lo && hi) rows.push(["Years", lo === hi ? String(lo) : `${lo}–${hi}`]);
  else if (lo) rows.push(["Years", `since ${lo}`]);
  else if (hi) rows.push(["Years", `until ${hi}`]);
  if (intent.exam_type) rows.push(["Exam", String(intent.exam_type)]);
  if (intent.has_images) rows.push(["Figures", "required"]);
  rows.push(["Search mode", "Semantic similarity"]);

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex items-center gap-1.5 rounded-md border border-line bg-paper-2 px-3 py-1.5 transition-colors hover:border-ink/25"
      >
        <span className="serif-note">Understood</span>
        {!open && rows.length > 0 && (
          <span className="ml-1 text-xs text-ink-2">
            {rows[0][1]}
            {rows.length > 1 && ` +${rows.length - 1}`}
          </span>
        )}
        <CaretDown
          size={12}
          weight="regular"
          className={`text-ink-2 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          open ? "mt-1.5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="inline-flex flex-col gap-1 rounded-md border border-line bg-paper-2 px-3 py-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-1.5 text-xs">
                  <span className="text-ink-2">{k}</span>
                  <span className="font-medium text-ink">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
