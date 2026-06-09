// COI Build Guidance - detailed step-by-step guide + warnings.
import React, { useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import ChecklistItem from "../components/ChecklistItem.jsx";

const BASE_STEPS = [
  "Confirm the named insured and account before issuing the COI.",
  "Confirm the certificate holder name and address exactly as requested.",
  "Check active policy term dates for every line of business you will list.",
  "Confirm policy number and limits are populated for each included coverage line.",
  "Verify endorsement support before showing Additional Insured, Waiver of Subrogation, or Primary & Non-Contributory wording.",
  "Add only approved wording to the Description of Operations.",
  "Place the holder in the CERTIFICATE HOLDER box, not only in Description of Operations.",
  "Create the COI in the agency management system.",
  "Download the completed ACORD 25 PDF.",
  "Upload the completed PDF to the COI Checker for comparison against this request.",
];

const WARNINGS = [
  "Do not add coverage wording unless supported by policy or endorsement.",
  "Escalate if the request asks to increase/change limits or confirm coverage.",
  "Escalate if endorsement status is unclear.",
  "Do not promise specific cancellation notice beyond policy terms.",
  "Non-licensed staff should not advise, interpret, bind, or change coverage.",
];

export default function BuildGuidance() {
  const { settings, activeAnalysis, navigate } = useApp();
  const [checked, setChecked] = useState({});

  const steps = useMemo(() => buildSteps(activeAnalysis), [activeAnalysis]);
  const toggle = (i) => setChecked((c) => ({ ...c, [i]: !c[i] }));
  const doneCount = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  const allDone = doneCount >= steps.length;

  return (
    <div className="page">
      <Disclaimer settings={settings} inline />
      <WorkflowSteps active="guidance" />

      {!activeAnalysis && (
        <div className="card notice">
          No analyzed request is linked yet. For best results, go back and{" "}
          <button className="link-btn" onClick={() => navigate("analyzer")}>analyze a client request first</button>.
        </div>
      )}

      {activeAnalysis && (
        <div className="card workflow-summary-card">
          <div className="card-head"><h3>Client instruction summary</h3></div>
          <p>{activeAnalysis.summary}</p>
          <div className="detected-chips">
            {Object.entries(activeAnalysis.detected || {}).map(([key, value]) => value ? <span className="chip" key={key}>{labelFor(key)}</span> : null)}
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <div className="card-head">
            <h3>Follow these instructions before creating the COI</h3>
            <span className="muted">{doneCount}/{steps.length} done</span>
          </div>
          <div className="steps">
            {steps.map((s, i) => (
              <div className="step-row" key={`${i}-${s}`}>
                <span className="step-num">{i + 1}</span>
                <ChecklistItem text={s} checked={checked[i]} onToggle={() => toggle(i)} />
              </div>
            ))}
          </div>

          {activeAnalysis?.suggestedDescription && (
            <div className="analysis-section">
              <h4>Suggested Description of Operations</h4>
              <div className="doo-box">{activeAnalysis.suggestedDescription}</div>
              <p className="tiny">Add only wording supported by the policy or an endorsement.</p>
            </div>
          )}

          <div className="next-step-panel">
            <div>
              <strong>When the COI is created and downloaded:</strong>
              <p>Continue to the completed COI upload page. The checker will compare the PDF to this saved client request.</p>
            </div>
            <button className="btn btn-primary" onClick={() => navigate("checker")}>
              Continue → Upload Completed COI PDF
            </button>
            {!allDone && <p className="tiny">You can continue anytime, but complete the checklist first for better accuracy.</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Warnings & escalation</h3></div>
          <div className="warn-cards">
            {WARNINGS.map((w, i) => (
              <div className="warn-card" key={i}>
                <span className="warn-bar" aria-hidden="true" />
                <span>{w}</span>
              </div>
            ))}
          </div>

          {activeAnalysis?.missingInfo?.length > 0 && (
            <div className="analysis-section">
              <h4>Missing information to resolve</h4>
              <ul className="bullet warn">
                {activeAnalysis.missingInfo.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {activeAnalysis?.escalations?.length > 0 && (
            <div className="analysis-section">
              <h4>Escalation items from this request</h4>
              <ul className="bullet escalate">
                {activeAnalysis.escalations.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildSteps(activeAnalysis) {
  if (!activeAnalysis) return BASE_STEPS;
  const d = activeAnalysis.detected || {};
  const f = activeAnalysis.fields || {};
  const steps = [];
  steps.push(`Confirm the named insured: ${f.insuredName || "verify exact insured name from account/policy"}.`);
  steps.push(`Enter the certificate holder exactly as requested: ${f.certHolderName || "confirm holder name"}${f.certHolderAddress ? `, ${f.certHolderAddress}` : " and confirm full address"}.`);
  if (f.projectName) steps.push(`Include project/job reference if appropriate: RE: ${f.projectName}.`);
  if (d.generalLiability) steps.push("Add General Liability line with policy number, term dates, and limits.");
  if (d.autoLiability) steps.push("Add Auto Liability line with policy number, term dates, and limits.");
  if (d.umbrella) steps.push("Add Umbrella / Excess line if active and requested.");
  if (d.workersComp) steps.push("Add Workers Compensation line if active and requested.");
  if (!d.generalLiability && !d.autoLiability && !d.umbrella && !d.workersComp) steps.push("Confirm which coverage lines are required before creating the certificate.");
  if (d.additionalInsured) steps.push("Verify Additional Insured support before marking ADD'L INSD or adding AI wording.");
  if (d.waiverOfSubrogation) steps.push("Verify Waiver of Subrogation support before marking SUBR WVD or adding WOS wording.");
  if (d.primaryNonContributory) steps.push("Verify Primary & Non-Contributory support before adding PNC wording.");
  if (d.completedOperations) steps.push("Confirm Completed Operations wording is supported before including it.");
  steps.push("Confirm Date Issued, Authorized Representative, and holder placement before downloading the PDF.");
  steps.push("Download the completed ACORD 25 PDF.");
  steps.push("Upload the completed PDF to the COI Checker for comparison against the client request.");
  return steps;
}

function WorkflowSteps({ active }) {
  const steps = [
    ["analyzer", "1", "Paste request"],
    ["guidance", "2", "Follow instructions"],
    ["checker", "3", "Upload completed COI"],
    ["report", "4", "Review corrections"],
  ];
  const activeIndex = steps.findIndex(([key]) => key === active);
  return (
    <div className="workflow-steps">
      {steps.map(([key, num, label], index) => (
        <div key={key} className={`workflow-step ${index <= activeIndex ? "active" : ""}`}>
          <span>{num}</span>{label}
        </div>
      ))}
    </div>
  );
}

function labelFor(key) {
  const map = {
    generalLiability: "General Liability",
    autoLiability: "Auto Liability",
    umbrella: "Umbrella / Excess",
    workersComp: "Workers Comp",
    additionalInsured: "Additional Insured",
    waiverOfSubrogation: "Waiver of Subrogation",
    primaryNonContributory: "Primary & Non-Contributory",
    completedOperations: "Completed Operations",
    lossPayeeMortgagee: "Loss Payee / Mortgagee",
    cancellationNotice: "Cancellation Notice",
  };
  return map[key] || key;
}
