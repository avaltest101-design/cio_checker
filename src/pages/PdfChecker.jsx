// Completed COI PDF Checker - second major workflow.
// This page receives the completed ACORD 25 PDF and compares it to the saved
// client request from the COI Request Analyzer.
import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import UploadBox from "../components/UploadBox.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { readAndParseCoi } from "../utils/pdfExtractor.js";
import { compareCoi, analyzeRequest } from "../utils/coiRules.js";
import { computeScore, deriveStatus, deriveRecommendation, countBySeverity } from "../utils/scoring.js";
import { generateId } from "../utils/storage.js";

export default function PdfChecker() {
  const { user, settings, requests, activeAnalysis, setActiveReport, navigate } = useApp();
  const [file, setFile] = useState(null);
  const [useOcr, setUseOcr] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [lastPreview, setLastPreview] = useState(null);

  useEffect(() => {
    if (activeAnalysis?._requestId) setSelectedRequestId(activeAnalysis._requestId);
  }, [activeAnalysis?._requestId]);

  const linkedRequest = useMemo(() => {
    if (selectedRequestId) return requests.find((r) => r.id === selectedRequestId) || null;
    return null;
  }, [requests, selectedRequestId]);

  const resolvedAnalysis = useMemo(() => resolveAnalysis({ selectedRequestId, requests, activeAnalysis, settings }), [selectedRequestId, requests, activeAnalysis, settings]);
  const hasLinkedInstructions = Boolean(resolvedAnalysis && (resolvedAnalysis.fields?.certHolderName || resolvedAnalysis.fields?.insuredName || Object.values(resolvedAnalysis.detected || {}).some(Boolean)));

  const onFile = (f) => {
    setFile(f);
    setLastPreview(null);
    setStatus(`Selected: ${f.name}`);
  };

  const reset = () => {
    setFile(null);
    setUseOcr(false);
    setSelectedRequestId(activeAnalysis?._requestId || "");
    setStatus("");
    setOcrProgress(0);
    setLastPreview(null);
  };

  const runCheck = async () => {
    if (!file) {
      setStatus("Upload the completed COI PDF first.");
      return;
    }
    if (!hasLinkedInstructions) {
      setStatus("Select or analyze the client request first so the checker can compare the COI against the exact instructions.");
      return;
    }

    setBusy(true);
    setStatus(useOcr ? "Running OCR and scanning the completed COI…" : "Reading and scanning the completed COI PDF…");
    try {
      const parsed = await readAndParseCoi(file, {
        useOcr,
        onProgress: (p) => setOcrProgress(p),
      });

      if (!parsed.ok) {
        setStatus(parsed.reason);
        setBusy(false);
        return;
      }

      const { findings } = compareCoi(resolvedAnalysis, parsed.fields, settings);
      const matchSummary = buildMatchSummary(resolvedAnalysis, parsed.fields);
      const extractionConfidence = getExtractionConfidence(parsed.fields);
      const score = computeScore(findings);
      const statusLabel = deriveStatus(score, findings);
      const recommendation = deriveRecommendation(statusLabel);
      const counts = countBySeverity(findings);

      const report = {
        id: generateId("report"),
        date: new Date().toISOString(),
        user: `${user.name} (${user.role})`,
        insuredName: parsed.fields.insuredName || resolvedAnalysis.fields?.insuredName || "Unknown insured",
        certHolderName: parsed.fields.certHolderName || resolvedAnalysis.fields?.certHolderName || "Unknown holder",
        score,
        status: statusLabel,
        recommendation: recommendation.label,
        counts,
        findings,
        matchSummary,
        extractionConfidence,
        extracted: parsed.fields,
        analysis: resolvedAnalysis,
        linkedRequestId: selectedRequestId || resolvedAnalysis._requestId || "",
        fileName: file.name,
      };

      setLastPreview({ parsed: parsed.fields, matchSummary, extractionConfidence });
      setActiveReport(report);
      setBusy(false);
      navigate("report");
    } catch (err) {
      console.error(err);
      setStatus("Something went wrong reading the PDF. Try OCR mode, export a clearer PDF, or visually review the COI before sending.");
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Disclaimer settings={settings} inline />
      <WorkflowSteps active="checker" />

      {!hasLinkedInstructions && (
        <div className="card notice">
          The checker needs the client instruction first. Go to{" "}
          <button className="link-btn" onClick={() => navigate("analyzer")}>COI Request Analyzer</button>{" "}
          and analyze the request before uploading the completed COI.
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <div className="card-head"><h3>3 · Upload completed ACORD 25 PDF</h3></div>

          <RequestLinkPanel
            activeAnalysis={activeAnalysis}
            linkedRequest={linkedRequest}
            requests={requests}
            selectedRequestId={selectedRequestId}
            setSelectedRequestId={setSelectedRequestId}
            resolvedAnalysis={resolvedAnalysis}
          />

          <UploadBox
            accept=".pdf"
            label="Upload completed COI PDF"
            hint="Upload the final ACORD 25 PDF after you create it in the agency system"
            onFile={onFile}
            fileName={file?.name}
          />

          <label className="checkbox-line">
            <input type="checkbox" checked={useOcr} onChange={(e) => setUseOcr(e.target.checked)} />
            <span>Use OCR mode only if the PDF is scanned or text extraction fails</span>
          </label>

          {busy && useOcr && ocrProgress > 0 && (
            <div className="progress"><div style={{ width: `${ocrProgress}%` }} /></div>
          )}

          <div className="scan-checklist">
            <strong>The checker will compare:</strong>
            <ul>
              <li>Insured name and certificate holder name/address</li>
              <li>Requested coverage lines, policy numbers, dates, and limits</li>
              <li>Additional Insured, WOS, PNC, Completed Operations, and special wording</li>
              <li>Description of Operations and project/job reference</li>
              <li>Issue date, authorized representative, NAIC, and PDF extraction confidence</li>
            </ul>
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" onClick={runCheck} disabled={busy || !hasLinkedInstructions}>
              {busy ? "Scanning COI…" : "Run COI Check Against Client Instructions"}
            </button>
            <button className="btn btn-ghost" onClick={reset}>Reset</button>
          </div>
          {status && <p className="status-line">{status}</p>}
        </div>

        <div className="card">
          <div className="card-head"><h3>Linked client instructions</h3></div>
          {resolvedAnalysis ? (
            <div className="analysis">
              <p>{resolvedAnalysis.summary || "Saved request selected."}</p>
              <div className="detected-chips">
                {Object.entries(resolvedAnalysis.detected || {}).filter(([, v]) => v).length === 0 && <span className="tiny">No requirements detected.</span>}
                {Object.entries(resolvedAnalysis.detected || {}).map(([key, value]) => value ? <span className="chip" key={key}>{labelFor(key)}</span> : null)}
              </div>
              <div className="request-summary-box">
                <div><strong>Insured:</strong> {resolvedAnalysis.fields?.insuredName || "Not captured"}</div>
                <div><strong>Certificate holder:</strong> {resolvedAnalysis.fields?.certHolderName || "Not captured"}</div>
                <div><strong>Holder address:</strong> {resolvedAnalysis.fields?.certHolderAddress || "Not captured"}</div>
                <div><strong>Project:</strong> {resolvedAnalysis.fields?.projectName || "Not captured"}</div>
              </div>
              <button className="btn btn-outline" onClick={() => navigate("analyzer")}>Edit / re-analyze request</button>
            </div>
          ) : (
            <div className="empty-state">
              <p>No client request is linked yet.</p>
              <button className="btn btn-primary" onClick={() => navigate("analyzer")}>Analyze Client Request First</button>
            </div>
          )}

          {lastPreview && (
            <div className="analysis-section">
              <h4>Last scan preview</h4>
              <p className="tiny">Extraction confidence: {lastPreview.extractionConfidence}%</p>
              <div className="match-preview-list">
                {lastPreview.matchSummary.slice(0, 5).map((m) => (
                  <div key={m.field} className={`match-preview match-${toneForMatch(m.status)}`}>
                    <strong>{m.field}</strong>
                    <span>{m.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function resolveAnalysis({ selectedRequestId, requests, activeAnalysis, settings }) {
  if (selectedRequestId) {
    const req = requests.find((r) => r.id === selectedRequestId);
    if (req) return req.analysis || analyzeRequest(req, req.rawText || "", settings);
  }
  return activeAnalysis || null;
}

function RequestLinkPanel({ requests, selectedRequestId, setSelectedRequestId, resolvedAnalysis }) {
  return (
    <div className="request-link-panel">
      <label className="field">
        <span>Client request to compare against</span>
        <select value={selectedRequestId} onChange={(e) => setSelectedRequestId(e.target.value)}>
          <option value="">Use current analyzed request</option>
          {requests.map((r) => (
            <option key={r.id} value={r.id}>
              {r.insuredName || "Unnamed insured"} → {r.certHolderName || "Unnamed holder"}
            </option>
          ))}
        </select>
      </label>
      <div className="request-link-status">
        <StatusBadge status={resolvedAnalysis ? "Ready to Create" : "Pending"} />
        <span>{resolvedAnalysis ? "Client instructions are linked for comparison." : "No analyzed request linked."}</span>
      </div>
    </div>
  );
}

function buildMatchSummary(analysis, coi = {}) {
  const d = analysis?.detected || {};
  const f = analysis?.fields || {};
  const text = `${coi.description || ""} ${coi.rawText || ""}`;
  const rows = [];
  const add = (field, required, status, requestValue, coiValue, note) => {
    if (!required) return;
    rows.push({ field, status, requestValue: requestValue || "Required", coiValue: coiValue || "Not detected", note });
  };

  add("Insured name", Boolean(f.insuredName), matchLoose(f.insuredName, `${coi.insuredName || ""} ${coi.insuredAddress || ""}`) ? "Matched" : "Mismatch", f.insuredName, coi.insuredName, "Must match the account/policy named insured.");
  add("Certificate holder", Boolean(f.certHolderName), matchLoose(f.certHolderName, `${coi.certHolderName || ""} ${coi.certHolderAddress || ""}`) ? "Matched" : "Mismatch", f.certHolderName, coi.certHolderName, "Holder must be in the CERTIFICATE HOLDER box.");
  add("Certificate holder address", Boolean(f.certHolderAddress), matchLoose(f.certHolderAddress, coi.certHolderAddress) ? "Matched" : "Needs Review", f.certHolderAddress, coi.certHolderAddress, "Address may require visual confirmation.");
  add("General Liability", d.generalLiability, coi.generalLiabilityPresent ? "Detected" : "Missing", "General Liability requested", coi.generalLiabilityPresent ? "Detected on PDF" : "Not detected", "Verify policy number, dates, and limits.");
  add("Auto Liability", d.autoLiability, coi.autoLiabilityPresent ? "Detected" : "Missing", "Auto Liability requested", coi.autoLiabilityPresent ? "Detected on PDF" : "Not detected", "Verify policy number, dates, and limits.");
  add("Umbrella / Excess", d.umbrella, coi.umbrellaPresent ? "Detected" : "Missing", "Umbrella / Excess requested", coi.umbrellaPresent ? "Detected on PDF" : "Not detected", "Verify policy number, dates, and limits.");
  add("Workers Compensation", d.workersComp, coi.workersCompPresent ? "Detected" : "Missing", "Workers Compensation requested", coi.workersCompPresent ? "Detected on PDF" : "Not detected", "Verify policy number, dates, and limits.");
  add("Additional Insured", d.additionalInsured, (coi.additionalInsuredChecked || hasPhrase(text, ["additional insured", "add'l insured", "addl insured", "cg 20 10", "cg 20 37"])) ? "Detected" : "Missing", "Additional Insured requested", coi.additionalInsuredEvidence?.join("; ") || (hasPhrase(text, ["additional insured"]) ? "Wording detected" : "Not detected"), "Verify endorsement support before sending.");
  add("Waiver of Subrogation", d.waiverOfSubrogation, (coi.waiverChecked || hasPhrase(text, ["waiver of subrogation", "subrogation waived", "subr wvd"])) ? "Detected" : "Missing", "Waiver requested", coi.waiverEvidence?.join("; ") || "Not detected", "Verify endorsement support before sending.");
  add("Primary & Non-Contributory", d.primaryNonContributory, hasPhrase(text, ["primary and non-contributory", "primary & non-contributory", "primary non-contributory", "p&nc", "pnc"]) ? "Detected" : "Missing", "PNC requested", hasPhrase(text, ["primary", "non-contributory", "pnc"]) ? "Possible wording detected" : "Not detected", "Verify support before adding wording.");
  add("Completed Operations", d.completedOperations, hasPhrase(text, ["completed operations", "ongoing and completed operations"]) ? "Detected" : "Needs Review", "Completed Operations requested", hasPhrase(text, ["completed operations"]) ? "Wording detected" : "Not detected", "Confirm exact wording/support.");
  add("Project / job reference", Boolean(f.projectName), matchLoose(f.projectName, text) ? "Detected" : "Needs Review", f.projectName, coi.description || "Not detected", "Project reference is usually expected in Description of Operations.");
  add("Special wording", Boolean(f.specialWording), matchLoose(f.specialWording, text) ? "Detected" : "Mismatch", f.specialWording, coi.description || "Not detected", "Special wording must match if supported.");

  rows.push({ field: "Policy numbers", status: coi.hasPolicyNumber ? "Detected" : "Missing", requestValue: "Required for included lines", coiValue: coi.policyNumbers?.join(", ") || "Not detected", note: "Blank ACORD labels do not count." });
  rows.push({ field: "Policy dates", status: coi.hasEffectiveDate && coi.hasExpirationDate ? "Detected" : "Missing", requestValue: "Required for included lines", coiValue: coi.dates?.join(", ") || "Not detected", note: "Confirm effective and expiration dates for every included line." });
  rows.push({ field: "Limits", status: coi.hasLimits ? "Detected" : "Missing", requestValue: "Required for included lines", coiValue: coi.dollarAmounts?.join(", ") || "Not detected", note: "Confirm limits meet the request and account standards." });
  rows.push({ field: "Authorized representative", status: coi.hasAuthorizedRep ? "Detected" : "Needs Review", requestValue: "Required", coiValue: coi.hasAuthorizedRep ? "Detected" : "Needs visual review", note: "Image signatures may not extract as text." });

  return rows;
}

function getExtractionConfidence(fields = {}) {
  const checks = [
    fields.insuredName,
    fields.certHolderName,
    fields.hasPolicyNumber,
    fields.hasEffectiveDate,
    fields.hasExpirationDate,
    fields.hasLimits,
    fields.description,
    fields.rawLines?.length > 15,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function hasPhrase(text, phrases) {
  const raw = text || "";
  return phrases.some((p) => new RegExp(`\\b${escapeRegExp(p).replace(/\\ /g, "\\s+")}\\b`, "i").test(raw));
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function simplify(value) { return (value || "").toLowerCase().replace(/\b(llc|inc|incorporated|corp|corporation|co|ltd|company|the)\b/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function matchLoose(a, b) {
  const left = simplify(a);
  const right = simplify(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}
function toneForMatch(status) {
  if (["Matched", "Detected"].includes(status)) return "pass";
  if (["Needs Review"].includes(status)) return "review";
  return "critical";
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
