import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Masthead from "./components/Masthead";
import Home from "./routes/Home";
import Landing from "./routes/Landing";
import Ask from "./routes/Ask";
import Stats from "./routes/Stats";
import Download from "./routes/Download";
import FacultyDashboard from "./routes/faculty/Dashboard";
import FacultyGenerate from "./routes/faculty/Generate";
import FacultyCoverage from "./routes/faculty/Coverage";
import FacultyAttainment from "./routes/faculty/Attainment";
import FacultyBank from "./routes/faculty/Bank";
import FacultySimilar from "./routes/faculty/Similar";
import FacultyBlueprint from "./routes/faculty/Blueprint";
import FacultyOutcomes from "./routes/faculty/Outcomes";

export default function App() {
  // Home's hero fills the viewport under the fixed nav on purpose (the pill
  // floats over the image); every other screen needs room reserved for it.
  const path = useLocation().pathname;
  const needsNavGap = path !== "/home";

  return (
    <div className="min-h-screen">
      <Masthead />
      <div className={needsNavGap ? "pt-[76px]" : ""}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/home" element={<Home />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/download" element={<Download />} />
          {/* Faculty console. Same app, same design system — a different
              audience, not a different product. */}
          <Route path="/faculty" element={<FacultyDashboard />} />
          <Route path="/faculty/generate" element={<FacultyGenerate />} />
          <Route path="/faculty/coverage" element={<FacultyCoverage />} />
          <Route path="/faculty/attainment" element={<FacultyAttainment />} />
          <Route path="/faculty/bank" element={<FacultyBank />} />
          <Route path="/faculty/similar" element={<FacultySimilar />} />
          <Route path="/faculty/blueprint" element={<FacultyBlueprint />} />
          <Route path="/faculty/outcomes" element={<FacultyOutcomes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
