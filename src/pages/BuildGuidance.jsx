// COI Build Guidance - step-by-step guide + warning cards.
import React, { useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import ChecklistItem from "../components/ChecklistItem.jsx";

const STEPS = [
  "Confirm the named insured.",
  "Confirm the certificate holder name and address.",
  "Check active policy term dates.",
  "Confirm required line of business.",
  "Verify if Additional Insured is requested.",
  "Verify if Waiver of Subrogation is requested.",
  "Verify if Primary & Non-Contributory wording is requested.",
  "Add approved wording to Description of Operations only if supported.",
  "Create the COI in the agency management system.",
  "Download the completed ACORD 25 PDF.",
  "Upload the completed PDF to the COI Checker.",
];

const WARNINGS = [
  "Do not add coverage wording unless supported by policy or endorsement.",
  "Escalate if the request asks to change limits.",
  "Escalate if the request asks to confirm coverage.",
  "Escalate if endorsement status is unclear.",
  "Non-licensed staff should not advise or interpret coverage.",
];

export default function BuildGuidance() {
  const { settings, activeAnalysis, navigate } = useApp();
  const [checked, setChecked] = useState({});

  const toggle = (i) => setChecked((c) => ({ ...c, [i]: !c[i] }));
  const doneCount = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);

  return (
    <div className="page">
      <Disclaimer settings={settings} inline />

      {!activeAnalysis && (
        <div className="card notice">
          No analyzed request yet. You can still follow the general steps below, or{" "}
          <button className="link-btn" onClick={() => navigate("analyzer")}>analyze a request first</button>.
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <div className="card-head">
            <h3>Step-by-step build guide</h3>
            <span className="muted">{doneCount}/{STEPS.length} done</span>
          </div>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div className="step-row" key={i}>
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

          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => navigate("checker")}>
              Continue to Completed COI Checker →
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Warnings</h3></div>
          <div className="warn-cards">
            {WARNINGS.map((w, i) => (
              <div className="warn-card" key={i}>
                <span className="warn-bar" aria-hidden="true" />
                <span>{w}</span>
              </div>
            ))}
          </div>

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
