import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Chalkboard } from "@phosphor-icons/react";
import { runQuery } from "@/facultyApi";

/**
 * Two doors and nothing else.
 *
 * A student and a lecturer want opposite things from identical rows, so the
 * question is asked before anything is shown.
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
    { to: "/ask", Icon: GraduationCap, label: "I'm studying" },
    { to: "/faculty", Icon: Chalkboard, label: "I teach here" },
  ];

  return (
    <div className="page grid min-h-[calc(100vh-56px)] place-items-center">
      <div className="w-full max-w-xl py-16">
        <p className="label-cap mb-5">B.M.S. College of Engineering</p>
        <h1 className="serif-display text-[clamp(2.4rem,6vw,3.4rem)] text-ink">
          Your college
          <br />
          <span className="text-mark">has a memory now.</span>
        </h1>

        <div className="grid sm:grid-cols-2 gap-3 mt-10">
          {doors.map(({ to, Icon, label }) => (
            <button key={to} onClick={() => nav(to)}
              className="card p-5 text-left hover:border-mark
                         transition-[border-color] duration-150 ease-out group">
              <Icon size={20} weight="regular"
                className="text-ink-2 group-hover:text-mark transition-colors duration-150" />
              <span className="block text-[16px] font-medium text-ink mt-4">{label}</span>
            </button>
          ))}
        </div>

        {stats && (
          <p className="font-mono text-[11.5px] text-ink-2 mt-8 tabular-nums">
            {stats.questions.toLocaleString()} questions · {stats.subjects} subjects · 9 years
          </p>
        )}
      </div>
    </div>
  );
}
