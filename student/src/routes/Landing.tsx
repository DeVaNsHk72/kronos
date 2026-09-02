import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, GraduationCap, Chalkboard } from "@phosphor-icons/react";
import { runQuery } from "@/facultyApi";
import FluidOrb from "@/components/ui/fluid-orb";

/**
 * The front door. The archive's own scale is the hero — 15,888 questions is a
 * more persuasive opening than any headline about them — and the agent sits
 * directly under it, because asking is the primary verb here, not browsing.
 *
 * The two doors are asked for explicitly rather than inferred: a student and a
 * lecturer want opposite things from the same rows, and guessing wrong sends
 * someone to a paper generator when they wanted revision.
 */

const STUDENT_ASKS = [
  "I have the Cloud Computing exam in three days — where do I start?",
  "What repeats in operating systems deadlock questions?",
  "Which DBMS topics carry the most marks?",
];

const FACULTY_ASKS = [
  "Which topics are examined heavily but taught thinly?",
  "Which questions have been asked to death in Machine Learning?",
  "How are marks distributed across COs in Cryptography?",
];

export default function Landing() {
  const nav = useNavigate();
  const [who, setWho] = useState<"student" | "faculty">("student");
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<{ subjects: number; questions: number } | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    runQuery("subjects")
      .then((r) => setStats({
        subjects: r.rows.length,
        questions: r.rows.reduce((s: number, x: any) => s + Number(x.questions ?? 0), 0),
      }))
      .catch(() => setStats(null));
  }, []);

  function send(text: string) {
    const t = text.trim();
    if (!t) return;
    nav(who === "faculty" ? "/faculty" : "/ask", { state: { question: t } });
  }

  const asks = who === "faculty" ? FACULTY_ASKS : STUDENT_ASKS;

  return (
    <div className="min-h-[calc(100vh-76px)] flex flex-col">
      <div className="flex-1 mx-auto w-full max-w-3xl px-6 pt-16 pb-10 flex flex-col justify-center">

        {/* ---- the archive states its own size ---- */}
        <div className="mb-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-2 mb-5">
            B.M.S. College of Engineering
          </p>
          <h1 className="serif-display text-[clamp(2.6rem,7vw,4.4rem)] text-ink">
            Nine years of papers,
            <br />
            <span className="text-mark">asked directly.</span>
          </h1>
          {stats && (
            <p className="font-mono text-[12px] text-ink-2 mt-5 tabular-nums">
              {stats.questions.toLocaleString()} questions · {stats.subjects} subjects · 2016&ndash;2024
              <span className="text-mark"> · every answer cites its source paper</span>
            </p>
          )}
        </div>

        {/* ---- who is asking ---- */}
        <div className="flex gap-2 mb-3">
          {([
            { k: "student", label: "I'm a student", Icon: GraduationCap,
              sub: "what to revise, and why" },
            { k: "faculty", label: "I'm faculty", Icon: Chalkboard,
              sub: "set a paper, see the gaps" },
          ] as const).map(({ k, label, Icon, sub }) => (
            <button key={k} onClick={() => { setWho(k); box.current?.focus(); }}
              aria-pressed={who === k}
              className={`flex-1 text-left border rounded-lg px-4 py-3 transition-colors
                ${who === k
                  ? "border-mark bg-mark/[0.05]"
                  : "border-line bg-paper-2 hover:border-ink-2"}`}>
              <span className="flex items-center gap-2">
                <Icon size={16} weight={who === k ? "fill" : "regular"}
                      className={who === k ? "text-mark" : "text-ink-2"} />
                <span className={`text-[14px] ${who === k ? "text-ink font-medium" : "text-ink-2"}`}>
                  {label}
                </span>
              </span>
              <span className="block text-[12px] text-ink-2 mt-0.5 pl-6">{sub}</span>
            </button>
          ))}
        </div>

        {/* ---- the agent, front and centre ---- */}
        <form onSubmit={(e) => { e.preventDefault(); send(q); }}
          className="border border-line rounded-xl bg-paper-2 focus-within:border-ink-2 transition-colors">
          <textarea ref={box} value={q} rows={2}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(q); }
            }}
            placeholder={who === "faculty"
              ? "Ask about the exam — what is over-asked, where coverage is thin…"
              : "Ask about a subject — what repeats, what carries marks…"}
            className="w-full bg-transparent px-4 pt-3.5 pb-2 text-[15px] serif resize-none
                       outline-none placeholder:text-ink-2/70" />
          <div className="flex items-center gap-2 px-3 pb-3">
            {/* The orb is the agent's presence — one instance, at the point of
                asking. Hidden under reduced-motion, where a perpetually
                animating WebGL canvas is exactly what the setting is for. */}
            <span className="motion-reduce:hidden grid place-items-center" aria-hidden="true">
              <FluidOrb size={22} color="#b02c33" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-2">
              agent · supervisor &rarr; genie
            </span>
            <button type="submit" disabled={!q.trim()}
              aria-label="Ask"
              className="ml-auto h-8 w-8 rounded-full bg-mark text-paper grid place-items-center
                         disabled:opacity-30 transition-opacity">
              <ArrowUp size={15} weight="bold" />
            </button>
          </div>
        </form>

        {/* ---- example questions, per audience ---- */}
        <div className="flex flex-col gap-1.5 mt-4">
          {asks.map((a) => (
            <button key={a} onClick={() => send(a)}
              className="text-left text-[13.5px] serif text-ink-2 hover:text-ink
                         border-b border-transparent hover:border-line py-1 transition-colors">
              <span className="text-mark mr-2">&rarr;</span>{a}
            </button>
          ))}
        </div>

        {/* ---- the other ways in ---- */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-10 pt-5 border-t border-line">
          {(who === "faculty"
            ? [["/faculty", "Dashboard"], ["/faculty/generate", "Generate a paper"],
               ["/faculty/coverage", "Coverage gaps"], ["/faculty/similar", "Asked before?"]]
            : [["/home", "Search every question"], ["/stats", "What to study"],
               ["/download", "Bulk download"]]
          ).map(([to, label]) => (
            <button key={to} onClick={() => nav(to)}
              className="font-mono text-[11px] uppercase tracking-wider text-ink-2 hover:text-mark">
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
