// Score + status + recommendation header used on the Review Report page.
import React from "react";
import StatusBadge from "./StatusBadge.jsx";

export default function ReportSummary({ score, status, recommendation, counts }) {
  return (
    <div className="report-summary">
      <div className={`score-ring score-${recommendation.tone}`}>
        <span className="score-num">{score}</span>
        <span className="score-of">/ 100</span>
      </div>
      <div className="report-summary-body">
        <div className="rs-status-row">
          <StatusBadge status={status} />
          <span className={`rec-pill rec-${recommendation.tone}`}>
            {recommendation.label}
          </span>
        </div>
        <p className="rs-detail">{recommendation.detail}</p>
        <div className="rs-counts">
          <span className="rs-count critical">{counts.Critical} Critical</span>
          <span className="rs-count moderate">{counts.Moderate} Moderate</span>
          <span className="rs-count minor">{counts.Minor} Minor</span>
          <span className="rs-count info">{counts.Info} Info</span>
        </div>
      </div>
    </div>
  );
}
