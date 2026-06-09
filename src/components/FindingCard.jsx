// Renders one comparison finding with severity color and details.
import React from "react";
import StatusBadge from "./StatusBadge.jsx";

export default function FindingCard({ finding }) {
  return (
    <div className={`finding finding-${finding.severity.toLowerCase()}`}>
      <div className="finding-head">
        <StatusBadge status={finding.severity} />
        <span className="finding-field">{finding.field}</span>
        <span className="finding-source">Source: {finding.source}</span>
      </div>
      <p className="finding-issue">{finding.issue}</p>
      <div className="finding-grid">
        <div>
          <span className="finding-key">Why it matters</span>
          <p>{finding.why}</p>
        </div>
        <div>
          <span className="finding-key">Suggested correction</span>
          <p>{finding.suggestion}</p>
        </div>
      </div>
      {finding.escalation?.required && (
        <div className="finding-escalate">
          ⚑ Escalate to: {finding.escalation.to}
        </div>
      )}
    </div>
  );
}
