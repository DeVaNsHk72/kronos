import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Masthead from "./components/Masthead";
import Home from "./routes/Home";
import Landing from "./routes/Landing";
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
  useLocation(); // re-render on navigation so the active tab tracks the route

  return (
    <div className="min-h-screen">
      <Masthead />
      {/* Every screen sits below the fixed nav pill — including the landing,
          now that no screen bleeds a full-height image under it. */}
      <div className="pt-[56px]">
        <Routes>
          <Route path="/" element={<Landing />} />
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
    </div>
  );
}
