// Status / severity badge with color coding.
import React from "react";

const TONE = {
  // Statuses
  Pending: "badge-pending",
  "Ready to Create": "badge-ready",
  "Needs Correction": "badge-correction",
  "Needs Review": "badge-review",
  Escalate: "badge-escalate",
  Passed: "badge-pass",
  "Critical Error": "badge-critical",
  // Severities
  Critical: "badge-critical",
  Moderate: "badge-correction",
  Minor: "badge-review",
  Info: "badge-info",
};

export default function StatusBadge({ status }) {
  const cls = TONE[status] || "badge-info";
  return <span className={`badge ${cls}`}>{status}</span>;
}
