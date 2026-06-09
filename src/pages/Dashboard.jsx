// Main dashboard: rollup stats + recent history + primary actions.
import React, { useMemo } from "react";
import { useApp } from "../App.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { MOCK_REPORTS } from "../data/mockReports.js";

// Merge seed reports with stored reports (stored win on id collision).
function mergeReports(stored) {
  const byId = new Map();
  for (const r of MOCK_REPORTS) byId.set(r.id, r);
  for (const r of stored) byId.set(r.id, r);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
}

export default function Dashboard() {
  const { user, reports, navigate } = useApp();
  const all = useMemo(() => mergeReports(reports), [reports]);

  const stats = useMemo(() => {
    const s = {
      total: all.length,
      pending: 0,
      passed: 0,
      needsCorrection: 0,
      critical: 0,
    };
    for (const r of all) {
      if (r.status === "Passed") s.passed += 1;
      if (r.status === "Needs Correction" || r.status === "Needs Review")
        s.needsCorrection += 1;
      if (r.status === "Critical Error") s.critical += 1;
      if (r.status === "Escalate" || r.status === "Pending") s.pending += 1;
    }
    return s;
  }, [all]);

  return (
    <div className="page">
      <h2 className="page-greeting">
        Welcome back, {user.name.split(" ")[0]} <span className="muted">· {user.role}</span>
      </h2>

      <div className="stat-grid">
        <StatCard label="Total COIs checked" value={stats.total} tone="neutral" />
        <StatCard label="Pending / escalate" value={stats.pending} tone="escalate" />
        <StatCard label="Passed checks" value={stats.passed} tone="pass" />
        <StatCard label="Needs correction" value={stats.needsCorrection} tone="correction" />
        <StatCard label="Critical errors" value={stats.critical} tone="critical" />
      </div>

      <div className="action-row">
        <button className="btn btn-primary" onClick={() => navigate("analyzer")}>
          Analyze New COI Request
        </button>
        <button className="btn btn-outline" onClick={() => navigate("checker")}>
          Upload Completed COI PDF
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Recent COI review history</h3>
          <button className="link-btn" onClick={() => navigate("history")}>
            View all
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Insured</th>
                <th>Certificate holder</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {all.slice(0, 6).map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.date).toLocaleDateString()}</td>
                  <td>{r.insuredName}</td>
                  <td>{r.certHolderName}</td>
                  <td>{r.score}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
              {all.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No reviews yet. Run your first COI check to populate history.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
