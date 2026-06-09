// ===========================================================================
// scoring.js
// ---------------------------------------------------------------------------
// Turns a list of findings into an overall score, a status label, and a
// final recommendation.
//
// IMPORTANT COMPLIANCE NOTE:
// The score reflects only how well the uploaded COI appears to MATCH the
// analyzed request and the QC checklist. It is NOT a statement that coverage
// exists, that the certificate is legally correct, or that the policy
// responds. It is a training / quality-control signal only.
// ===========================================================================

// Point penalty applied per finding, by severity.
const PENALTY = {
  Critical: 25,
  Moderate: 10,
  Minor: 3,
  Info: 0,
};

export const SEVERITY_ORDER = ["Critical", "Moderate", "Minor", "Info"];

// Score thresholds from the spec.
//   95-100 : Passed
//   80-94  : Needs Review
//   60-79  : Needs Correction
//   < 60   : Critical Error / Escalate
export function computeScore(findings = []) {
  let score = 100;
  for (const f of findings) {
    score -= PENALTY[f.severity] ?? 0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function countBySeverity(findings = []) {
  const counts = { Critical: 0, Moderate: 0, Minor: 0, Info: 0 };
  for (const f of findings) {
    if (counts[f.severity] !== undefined) counts[f.severity] += 1;
  }
  return counts;
}

// Status drives the badge color and the dashboard rollups.
export function deriveStatus(score, findings = []) {
  const counts = countBySeverity(findings);
  const anyEscalation = findings.some((f) => f.escalation && f.escalation.required);

  if (counts.Critical > 0 || score < 60) return "Critical Error";
  if (anyEscalation) return "Escalate";
  if (score < 80) return "Needs Correction";
  if (score < 95) return "Needs Review";
  return "Passed";
}

// Plain-English action the reviewer should take next.
export function deriveRecommendation(status) {
  switch (status) {
    case "Passed":
      return {
        label: "Ready to Send",
        tone: "pass",
        detail:
          "The COI appears to match the analyzed request and the QC checklist. A licensed reviewer still owns the final decision.",
      };
    case "Needs Review":
      return {
        label: "Review Before Sending",
        tone: "review",
        detail:
          "Minor or moderate items were found. Review the notes below before sending to the certificate holder.",
      };
    case "Needs Correction":
      return {
        label: "Correct Before Sending",
        tone: "correction",
        detail:
          "Several items do not appear to match the request. Correct them and re-run the check before sending.",
      };
    case "Escalate":
      return {
        label: "Escalate to Licensed Agent / Trainer / Team Lead",
        tone: "escalate",
        detail:
          "This request includes items a non-licensed VA cannot decide alone. Escalate before proceeding.",
      };
    case "Critical Error":
    default:
      return {
        label: "Escalate to Licensed Agent / Trainer / Team Lead",
        tone: "critical",
        detail:
          "Critical mismatches were found. Do not send. Escalate to a licensed agent, Account Manager, Trainer, or Team Lead.",
      };
  }
}
