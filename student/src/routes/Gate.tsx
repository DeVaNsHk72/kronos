import { useNavigate } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";
import { HOME, setRole, type Role } from "@/lib/role";

/**
 * The first sheet.
 *
 * Two people ask the same agent for opposite things, and every
 * screen behind this one is shaped by which of them is asking. So the question
 * is put first, on a bare sheet, with nothing else competing for the answer —
 * no headline to read past, no figures to weigh, no field behind it.
 *
 * The choice is remembered, so this sheet is seen once and then never again.
 */

const DOORS: { role: Role; label: string; line: string }[] = [
  {
    role: "student",
    label: "I'm studying",
    line: "Ask where to start, and it works out what carries the marks — showing the SQL and the papers it read.",
  },
  {
    role: "teacher",
    label: "I set the papers",
    line: "Have it assemble a paper from real past questions, flag what has been asked to death, and hand you the evidence.",
  },
];

export default function Gate() {
  const nav = useNavigate();

  function choose(role: Role) {
    setRole(role);
    nav(HOME[role], { replace: true });
  }

  return (
    <div className="relative flex min-h-screen flex-col px-5 py-6 sm:px-10 sm:py-8">
      {/* The drawing frame, and nothing else on the sheet. */}
      <div aria-hidden className="pointer-events-none absolute inset-5 hidden sm:block">
        {[
          "left-0 top-0 border-l border-t",
          "right-0 top-0 border-r border-t",
          "left-0 bottom-0 border-l border-b",
          "right-0 bottom-0 border-r border-b",
        ].map((c) => (
          <span key={c} className={`absolute h-4 w-4 border-line ${c}`} />
        ))}
      </div>

      <header className="relative flex items-baseline gap-3">
        <span className="wordmark text-[15px] text-ink">Kronos</span>
        <span aria-hidden className="h-[7px] w-[7px] translate-y-[-2px] bg-ink-2" />
        <span className="draft-caps ml-auto hidden sm:block">
          B.M.S. College of Engineering
        </span>
      </header>

      <main className="relative flex flex-1 flex-col justify-center py-12">
        <h1 className="serif-display max-w-[16ch] text-[clamp(2rem,5vw,3.4rem)] text-ink">
          Who is asking?
        </h1>
        <p className="serif mt-4 max-w-[48ch] text-[15px] text-ink-2">
          Kronos is the same agent either way. What you need it to work out is not.
        </p>

        {/* Two ruled cells, equal weight. Neither is the recommended one —
            the whole point of asking is that the answer is not guessable. */}
        <div className="mt-10 grid max-w-[820px] gap-px border border-line bg-line sm:grid-cols-2">
          {DOORS.map(({ role, label, line }) => (
            <button
              key={role}
              onClick={() => choose(role)}
              className="group flex flex-col bg-paper px-5 py-6 text-left transition-colors duration-150 hover:bg-paper-2"
            >
              <span className="title-section flex items-center gap-2">
                {label}
                <ArrowRight
                  size={16}
                  weight="bold"
                  className="translate-x-0 text-ink-2 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-ink"
                />
              </span>
              <span className="serif mt-3 max-w-[34ch] text-[13.5px] text-ink-2">{line}</span>
            </button>
          ))}
        </div>
      </main>

      <footer className="relative flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
        <span className="draft-caps">You can change this later</span>
        <button
          onClick={() => nav("/welcome")}
          className="ml-auto text-[13px] text-ink-2 transition-colors duration-150 hover:text-ink"
        >
          What is Kronos?
        </button>
      </footer>
    </div>
  );
}
