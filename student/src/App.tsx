import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import DraftingRail from "./components/DraftingRail";
import GlobalComposer from "./components/GlobalComposer";
import Home from "./routes/Home";
import Landing from "./routes/Landing";
import Gate from "./routes/Gate";
import Notes from "./routes/Notes";
import StudyTabs from "./components/StudyTabs";
import Ask from "./routes/Ask";
import Stats from "./routes/Stats";
import Download from "./routes/Download";
import FacultyDashboard from "./routes/faculty/Dashboard";
import FacultyGenerate from "./routes/faculty/Generate";
import FacultyBank from "./routes/faculty/Bank";
import FacultyPractice from "./routes/faculty/Practice";
import { FacultyNav } from "./components/faculty/Shared";
import { getStats } from "@/api";
import { getRole, HOME } from "@/lib/role";

/** The Intelligence tab strip, laid out exactly like StudyTabs. */
function FacultyShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* no-print: the nav itself is hidden when printing a paper, and its
          hairline wrapper has to go with it. */}
      <div className="border-b border-line no-print">
        <FacultyNav />
      </div>
      {children}
    </>
  );
}

export default function App() {
  const loc = useLocation();
  const nav = useNavigate();
  const [dims, setDims] = useState<{
    questions: number; subjects: number; papers: number; years: [number, number];
  } | null>(null);

  // The title block stamps the archive's real dimensions. It is fetched once
  // for the whole app rather than per screen, because a title block that says
  // something different on two sheets is not a title block.
  useEffect(() => {
    getStats()
      .then((s) => setDims({ questions: s.questions, subjects: s.courses, papers: s.papers, years: s.year_range }))
      .catch(() => setDims(null));
  }, []);

  // Two surfaces own their whole frame and carry no margin or composer: the
  // gate, which is asked before anything is shown, and the welcome sheet.
  const bare = loc.pathname === "/" || loc.pathname === "/welcome";

  // The gate is asked once. After that the visitor lands on their own side of
  // the product, because a student and a lecturer do not share a home screen.
  const role = getRole();

  // The agent is reachable from every screen. Only the thread itself draws its
  // own composer, because it owns the turn state; the sibling study routes
  // (/ask/search, /ask/practice, /ask/notes) are separate screens and get the
  // global one. Matching on the prefix silently swallowed all three.
  const onAsk = loc.pathname === "/ask";

  if (bare) {
    return (
      <Routes>
        <Route path="/" element={role ? <Navigate to={HOME[role]} replace /> : <Gate />} />
        <Route path="/welcome" element={<Landing />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen lg:pl-[228px]">
      <DraftingRail
        questions={dims?.questions ?? null}
        subjects={dims?.subjects ?? null}
        papers={dims?.papers ?? null}
        years={dims?.years ?? null}
      />

      {/* Mobile clears the folded margin bar; desktop clears nothing, because
          the margin is beside the sheet rather than above it. */}
      <div className={`pt-13 lg:pt-0 ${onAsk ? "" : "pb-40"}`}>
        <Routes>
          {/* Student side: one hub. Ask, search, practice and the documents
              are the same corpus reached four ways, not four destinations. */}
          <Route path="/ask" element={<><StudyTabs /><Ask /></>} />
          <Route path="/ask/search" element={<><StudyTabs /><Home /></>} />
          <Route path="/ask/practice" element={<><StudyTabs /><FacultyPractice /></>} />
          <Route path="/ask/notes" element={<><StudyTabs /><Notes /></>} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/download" element={<Download />} />
          {/* Faculty console. Same app, same design system — a different
              audience, not a different product. */}
          <Route path="/faculty" element={<FacultyShell><FacultyDashboard /></FacultyShell>} />
          <Route path="/faculty/generate" element={<FacultyShell><FacultyGenerate /></FacultyShell>} />
          <Route path="/faculty/bank" element={<FacultyShell><FacultyBank /></FacultyShell>} />
          <Route path="/faculty/practice" element={<FacultyShell><FacultyPractice /></FacultyShell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {!onAsk && (
        <GlobalComposer onAsk={(q) => nav("/ask", { state: { question: q } })} />
      )}
    </div>
  );
}
