// Dark sidebar navigation. Pure state-based routing (no router dependency).
import React from "react";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "▣" },
  { key: "analyzer", label: "COI Request Analyzer", icon: "◧" },
  { key: "guidance", label: "COI Build Guidance", icon: "☑" },
  { key: "checker", label: "Completed COI Checker", icon: "⤓" },
  { key: "history", label: "History", icon: "≣" },
  { key: "settings", label: "Settings / Rules", icon: "⚙" },
];

export default function Sidebar({ current, onNavigate, user, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">LAVA</span>
        <span className="brand-sub">COI AI Checker</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${current === item.key ? "active" : ""}`}
            onClick={() => onNavigate(item.key)}
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <div className="su-name">{user.name}</div>
            <div className="su-role">{user.role}</div>
          </div>
        )}
        <button className="btn btn-ghost btn-sm" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
