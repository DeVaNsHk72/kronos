import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Chalkboard } from "@phosphor-icons/react";
import { runQuery } from "@/facultyApi";

/**
 * Two doors and nothing else.
 *
 * A student and a lecturer want opposite things from identical rows, so the
 * question is asked before anything is shown. Putting a prompt box here as well
 * would ask twice: the student door opens onto one, and the teacher door onto
 * Intelligence.
 */
export default function Landing() {
  const nav = useNavigate();
  const [stats, setStats] = useState<{ subjects: number; questions: number } | null>(null);

  useEffect(() => {
    runQuery("subjects")
      .then((r) => setStats({
        subjects: r.rows.length,
        questions: r.rows.reduce((s: number, x: any) => s + Number(x.questions ?? 0), 0),
      }))
      .catch(() => setStats(null));
  }, []);

  const doors = [
    { to: "/ask", Icon: GraduationCap, label: "I'm studying",
      sub: "Ask the archive, search every question, practise, and read the notes." },
    { to: "/faculty", Icon: Chalkboard, label: "I teach here",
      sub: "Intelligence — set the next paper and see what the exam has been doing." },
  ];

  return (
    <div className="min-h-[calc(100vh-76px)] grid place-items-center px-6">
      <div className="w-full max-w-2xl py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-2 mb-5">
          B.M.S. College of Engineering · agentic academic memory
        </p>
        <h1 className="serif-display text-[clamp(2.6rem,7vw,4.2rem)] text-ink">
          Your college
          <br />
          <span className="text-mark">has a memory now.</span>
        </h1>
        <p className="serif text-[16px] text-ink-2 mt-5 max-w-xl leading-relaxed">
          Every past paper, every set of notes, every syllabus &mdash; read, parsed
          and held in one place. Kronos is the agent that thinks over it.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mt-10">
          {doors.map(({ to, Icon, label, sub }) => (
            <button key={to} onClick={() => nav(to)}
              className="text-left border border-line rounded-xl bg-paper-2 p-5
                         hover:border-mark transition-[border-color] duration-150 ease-out group">
              <Icon size={22} weight="regular"
                className="text-ink-2 group-hover:text-mark transition-colors duration-150" />
              <span className="block serif text-[19px] text-ink mt-3">{label}</span>
              <span className="block text-[13px] text-ink-2 mt-1.5 leading-relaxed">{sub}</span>
            </button>
          ))}
        </div>

        {stats && (
          <p className="font-mono text-[11.5px] text-ink-2 mt-8 tabular-nums">
            {stats.questions.toLocaleString()} questions · {stats.subjects} subjects · 9 years
            <span className="text-mark"> · every answer cites its source</span>
          </p>
        )}
      </div>
    </div>
  );
}
