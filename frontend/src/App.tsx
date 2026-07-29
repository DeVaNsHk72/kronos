import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Masthead from "./components/Masthead";
import Home from "./routes/Home";
import Ask from "./routes/Ask";
import Stats from "./routes/Stats";
import Download from "./routes/Download";

export default function App() {
  // Home's hero fills the viewport under the fixed nav on purpose (the pill
  // floats over the image); every other screen needs room reserved for it.
  const needsNavGap = useLocation().pathname !== "/home";

  return (
    <div className="min-h-screen">
      <Masthead />
      <div className={needsNavGap ? "pt-[76px]" : ""}>
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/download" element={<Download />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>
    </div>
  );
}
