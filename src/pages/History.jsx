// History page - previous COI checks (localStorage + seed data).
import React, { useMemo } from "react";
import { useApp } from "../App.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import { MOCK_REPORTS } from "../data/mockReports.js";
import { deriveRecommendation } from "../utils/scoring.js";

function mergeReports(stored) {
  const byId = new Map();
  for (const r of MOCK_REPORTS) byId.set(r.id, r);
  for (const r of stored) byId.set(r.id, r);
  return Array.from(byId.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
}

export default function History() {
  const { reports, setActiveReport, navigate, settings } = useApp();
  const all = useMemo(() => mergeReports(reports), [reports]);

  const view = (r) => {
    // Seeds may not carry full findings; build a minimal report shape.
    setActiveReport({
      ...r,
      recommendation: deriveRecommendation(r.status).label,
      findings: r.findings || [],
      extracted: r.extracted || {},
    });
    navigate("report");
  };

  return (
    <div className="page">
      <Disclaimer settings={settings} inline />
      <div className="card">
        <div className="card-head"><h3>Review history</h3></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>User</th>
                <th>Insured</th>
                <th>Certificate holder</th>
                <th>Score</th>
                <th>Status</th>
                <th>Crit</th>
                <th>Mod</th>
                <th>Min</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {all.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.date).toLocaleDateString()}</td>
                  <td>{r.user}</td>
                  <td>{r.insuredName}</td>
                  <td>{r.certHolderName}</td>
                  <td>{r.score}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="num crit">{r.counts?.Critical ?? 0}</td>
                  <td className="num mod">{r.counts?.Moderate ?? 0}</td>
                  <td className="num min">{r.counts?.Minor ?? 0}</td>
                  <td>
                    <button className="link-btn" onClick={() => view(r)}>View report</button>
                  </td>
                </tr>
              ))}
              {all.length === 0 && (
                <tr><td colSpan={10} className="empty-cell">No history yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="tiny">
          History is stored locally for the MVP. {/* SUPABASE: replace with a
          query against the coi_reports table keyed on the org/user. */}
        </p>
      </div>
    </div>
  );
}
