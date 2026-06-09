// ===========================================================================
// App.jsx
// ---------------------------------------------------------------------------
// Top-level shell: holds shared state, provides it via context, and renders
// the active page. Navigation is plain state (no router dependency) which
// keeps the Netlify deploy trivial — netlify.toml already routes all paths to
// index.html for safety.
// ===========================================================================

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import Disclaimer from "./components/Disclaimer.jsx";

import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import RequestAnalyzer from "./pages/RequestAnalyzer.jsx";
import BuildGuidance from "./pages/BuildGuidance.jsx";
import PdfChecker from "./pages/PdfChecker.jsx";
import ReviewReport from "./pages/ReviewReport.jsx";
import History from "./pages/History.jsx";
import Settings from "./pages/Settings.jsx";

import {
  getUser,
  saveUser,
  clearUser,
  getRequests,
  getReports,
  getSettings,
  saveSettings,
} from "./utils/storage.js";
import { DEFAULT_RULES } from "./utils/coiRules.js";

// Shared app context so pages/components can navigate and read/update state.
const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

function hydrateSettings(saved) {
  const merged = {
    ...DEFAULT_RULES,
    ...(saved || {}),
    endorsementKeywords: {
      ...DEFAULT_RULES.endorsementKeywords,
      ...((saved || {}).endorsementKeywords || {}),
    },
  };
  merged.endorsementKeywords.additionalInsured = (
    merged.endorsementKeywords.additionalInsured || DEFAULT_RULES.endorsementKeywords.additionalInsured
  ).filter((keyword) => keyword.trim().toLowerCase() !== "ai");
  return merged;
}

export default function App() {
  const [user, setUser] = useState(() => getUser());
  const [page, setPage] = useState("dashboard");

  // Settings persist; default to the rule set in coiRules.js on first run.
  // hydrateSettings also migrates older localStorage rules, especially removing
  // the old bare "ai" keyword that caused false Additional Insured matches.
  const [settings, setSettings] = useState(() => hydrateSettings(getSettings()));

  // Live copies (refreshed on changes) of stored collections.
  const [requests, setRequests] = useState(() => getRequests());
  const [reports, setReports] = useState(() => getReports());

  // In-flight workflow state shared across pages.
  const [activeAnalysis, setActiveAnalysis] = useState(null); // from RequestAnalyzer
  const [activeReport, setActiveReport] = useState(null); // from PdfChecker

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const navigate = (p) => setPage(p);

  const login = (u) => {
    saveUser(u);
    setUser(u);
    setPage("dashboard");
  };

  const logout = () => {
    clearUser();
    setUser(null);
  };

  const refreshRequests = () => setRequests(getRequests());
  const refreshReports = () => setReports(getReports());

  const ctx = useMemo(
    () => ({
      user,
      settings,
      setSettings,
      requests,
      refreshRequests,
      reports,
      refreshReports,
      activeAnalysis,
      setActiveAnalysis,
      activeReport,
      setActiveReport,
      navigate,
    }),
    [user, settings, requests, reports, activeAnalysis, activeReport]
  );

  if (!user) {
    return (
      <AppContext.Provider value={ctx}>
        <Login onLogin={login} settings={settings} />
      </AppContext.Provider>
    );
  }

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <Dashboard />;
      case "analyzer":
        return <RequestAnalyzer />;
      case "guidance":
        return <BuildGuidance />;
      case "checker":
        return <PdfChecker />;
      case "report":
        return <ReviewReport />;
      case "history":
        return <History />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <AppContext.Provider value={ctx}>
      <div className="app-shell">
        <Sidebar current={page} onNavigate={navigate} user={user} onLogout={logout} />
        <div className="app-main">
          <Header current={page} onNavigate={navigate} />
          <main className="app-content">{renderPage()}</main>
          <footer className="app-footer">
            <Disclaimer settings={settings} />
            <span className="footer-copy">
              LAVA COI AI Checker · Internal training tool · v1.0
            </span>
          </footer>
        </div>
      </div>
    </AppContext.Provider>
  );
}
