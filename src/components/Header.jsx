// Top header bar with page title and primary actions.
import React from "react";

const TITLES = {
  dashboard: "Dashboard",
  analyzer: "COI Request Analyzer",
  guidance: "COI Build Guidance",
  checker: "Completed COI PDF Checker",
  report: "COI Review Report",
  history: "Review History",
  settings: "Settings / Rules",
};

export default function Header({ current, onNavigate }) {
  return (
    <header className="topbar">
      <div>
        <h1 className="topbar-title">{TITLES[current] || "LAVA COI AI Checker"}</h1>
        <p className="topbar-sub">Training &amp; quality-control assistant for ACORD 25 certificates</p>
      </div>
      <div className="topbar-actions">
        <button className="btn btn-outline btn-sm" onClick={() => onNavigate("analyzer")}>
          Analyze Request
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => onNavigate("checker")}>
          Upload Completed COI
        </button>
      </div>
    </header>
  );
}
