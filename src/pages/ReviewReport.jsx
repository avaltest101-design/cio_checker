// COI Review Report - shows findings, score, recommendation; download + save.
import React, { useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import ReportSummary from "../components/ReportSummary.jsx";
import FindingCard from "../components/FindingCard.jsx";
import { deriveRecommendation, SEVERITY_ORDER } from "../utils/scoring.js";
import { saveReport } from "../utils/storage.js";

export default function ReviewReport() {
  const { settings, activeReport, refreshReports, navigate } = useApp();
  const [saved, setSaved] = useState(false);

  const r = activeReport;
  const recommendation = r ? deriveRecommendation(r.status) : null;

  // Critical findings first. Keep hooks before any conditional return to avoid
  // React hook-order issues when navigating from an empty report to a loaded one.
  const sortedFindings = useMemo(
    () =>
      [...(r?.findings || [])].sort(
        (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      ),
    [r?.findings]
  );

  const fieldChecklist = useMemo(() => {
    const f = r?.extracted || {};
    return [
      ["Date issued", f.dateIssued],
      ["Producer name", f.producerName],
      ["Insured name", f.insuredName],
      ["Certificate holder", f.certHolderName],
      ["Certificate holder address", f.certHolderAddress],
      ["Policy numbers", f.policyNumbers?.length ? f.policyNumbers.join(", ") : "Not detected"],
      ["Effective date present", f.hasEffectiveDate ? "Yes" : "Not detected"],
      ["Expiration date present", f.hasExpirationDate ? "Yes" : "Not detected"],
      ["Limit values", f.dollarAmounts?.length ? f.dollarAmounts.join(", ") : "Not detected"],
      ["NAIC values", f.naicNumbers?.length ? f.naicNumbers.join(", ") : "Not detected"],
      ["General Liability line", f.generalLiabilityPresent ? "Detected" : "Not detected"],
      ["Auto Liability line", f.autoLiabilityPresent ? "Detected" : "Not detected"],
      ["Umbrella / Excess line", f.umbrellaPresent ? "Detected" : "Not detected"],
      ["Workers Compensation line", f.workersCompPresent ? "Detected" : "Not detected"],
      ["Additional Insured indicator", f.additionalInsuredChecked ? "Yes" : "Not detected"],
      ["Waiver of Subrogation indicator", f.waiverChecked ? "Yes" : "Not detected"],
      ["Authorized representative", f.hasAuthorizedRep ? "Yes" : "Needs visual review"],
      ["Description of Operations", f.description ? "Captured" : "Not detected"],
    ];
  }, [r?.extracted]);

  if (!activeReport) {
    return (
      <div className="page">
        <div className="card notice">
          No active report. Run a check from the{" "}
          <button className="link-btn" onClick={() => navigate("checker")}>Completed COI Checker</button>.
        </div>
      </div>
    );
  }

  const saveToHistory = () => {
    saveReport({
      id: r.id,
      date: r.date,
      user: r.user,
      insuredName: r.insuredName,
      certHolderName: r.certHolderName,
      score: r.score,
      status: r.status,
      recommendation: r.recommendation,
      counts: r.counts,
      findings: r.findings,
      extracted: r.extracted,
      fileName: r.fileName,
    });
    refreshReports();
    setSaved(true);
  };

  const download = () => {
    const lines = [];
    lines.push("LAVA COI AI CHECKER — REVIEW REPORT");
    lines.push("=".repeat(50));
    lines.push(`Date: ${new Date(r.date).toLocaleString()}`);
    lines.push(`Reviewer: ${r.user}`);
    lines.push(`File: ${r.fileName}`);
    lines.push(`Insured: ${r.insuredName}`);
    lines.push(`Certificate holder: ${r.certHolderName}`);
    lines.push("");
    lines.push(`SCORE: ${r.score}/100`);
    lines.push(`STATUS: ${r.status}`);
    lines.push(`RECOMMENDATION: ${recommendation.label}`);
    lines.push(
      `Findings — Critical: ${r.counts.Critical}, Moderate: ${r.counts.Moderate}, Minor: ${r.counts.Minor}, Info: ${r.counts.Info}`
    );
    lines.push("");
    lines.push("FINDINGS");
    lines.push("-".repeat(50));
    sortedFindings.forEach((f, i) => {
      lines.push(`${i + 1}. [${f.severity}] ${f.field}`);
      lines.push(`   Issue: ${f.issue}`);
      lines.push(`   Why it matters: ${f.why}`);
      lines.push(`   Suggested correction: ${f.suggestion}`);
      lines.push(`   Source: ${f.source}`);
      if (f.escalation?.required) lines.push(`   ESCALATE TO: ${f.escalation.to}`);
      lines.push("");
    });
    lines.push("-".repeat(50));
    lines.push(settings?.disclaimer || "");
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `COI-Report-${r.insuredName.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <Disclaimer settings={settings} inline />

      <ReportSummary
        score={r.score}
        status={r.status}
        recommendation={recommendation}
        counts={r.counts}
      />

      <p className="compliance-note">
        This report reflects only whether the COI <strong>appears to match</strong> the uploaded
        request and checklist. It does not state that the COI is legally correct or that coverage
        exists.
      </p>

      <div className="btn-row">
        <button className="btn btn-primary" onClick={download}>Download report</button>
        <button className="btn btn-outline" onClick={saveToHistory} disabled={saved}>
          {saved ? "Saved to history ✓" : "Save to history"}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate("checker")}>Check another</button>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-head"><h3>Findings (critical first)</h3></div>
          <div className="findings-list">
            {sortedFindings.map((f) => <FindingCard key={f.id} finding={f} />)}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Field-by-field checklist</h3></div>
          <table className="data-table compact">
            <tbody>
              {fieldChecklist.map(([label, val]) => {
                const missing = !val || val === "Not detected";
                return (
                  <tr key={label}>
                    <td className="fc-label">{label}</td>
                    <td className={missing ? "fc-missing" : "fc-ok"}>
                      {val || "Not detected"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
