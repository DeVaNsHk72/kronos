import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { AppShell, type Dims } from "./components/shell";
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

function FacultyShell({ children }: { children: React.ReactNode }) {
  return <><FacultyNav />{children}</>;
}

export default function App() {
  const loc = useLocation();
  const nav = useNavigate();
  const [dims, setDims] = useState<Dims | null>(null);

  // Fetched once for the whole app so the title block never says two things.
  useEffect(() => {
    getStats()
      .then((s) => setDims({ questions: s.questions, subjects: s.courses, papers: s.papers, years: s.year_range }))
      .catch(() => setDims(null));
  }, []);

  // Two surfaces own their whole frame: the gate and the welcome sheet.
  const bare = loc.pathname === "/" || loc.pathname === "/welcome";
  const role = getRole();
  // The composer floats on every screen except the thread itself.


  if (bare) {
    return (
      <MotionConfig reducedMotion="user">
        <Routes>
          <Route path="/" element={role ? <Navigate to={HOME[role]} replace /> : <Gate />} />
          <Route path="/welcome" element={<Landing />} />
        </Routes>
      </MotionConfig>
    );
  }

  const emptyDims: Dims = { questions: null, subjects: null, papers: null, years: null };

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen lg:pl-[14.25rem]">
      <AppShell dims={dims ?? emptyDims} />

      <div className="pt-13 pb-40 lg:pt-16">
        <Routes>
          <Route path="/ask" element={<><StudyTabs /><Ask /></>} />
          <Route path="/ask/search" element={<><StudyTabs /><Home /></>} />
          <Route path="/ask/practice" element={<><StudyTabs /><FacultyPractice /></>} />
          <Route path="/ask/notes" element={<><StudyTabs /><Notes /></>} />
          <Route path="/stats" element={<><StudyTabs /><Stats /></>} />
          <Route path="/download" element={<Download />} />
          <Route path="/faculty" element={<FacultyShell><FacultyDashboard /></FacultyShell>} />
          <Route path="/faculty/generate" element={<FacultyShell><FacultyGenerate /></FacultyShell>} />
          <Route path="/faculty/bank" element={<FacultyShell><FacultyBank /></FacultyShell>} />
          <Route path="/faculty/practice" element={<FacultyShell><FacultyPractice /></FacultyShell>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      <GlobalComposer onAsk={(q) => nav("/ask", { state: { question: q, ts: Date.now() } })} />
    </div>
    </MotionConfig>
  );
}
