// Completed COI PDF Checker - second major workflow.
import React, { useState } from "react";
import { useApp } from "../App.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import UploadBox from "../components/UploadBox.jsx";
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

  const onFile = (f) => {
    setFile(f);
    setStatus(`Selected: ${f.name}`);
  };

  const reset = () => {
    setFile(null);
    setUseOcr(false);
    setSelectedRequestId("");
    setStatus("");
    setOcrProgress(0);
  };

  const resolveAnalysis = () => {
    // Priority: a saved request the user picked, then the active analysis.
    if (selectedRequestId) {
      const req = requests.find((r) => r.id === selectedRequestId);
      if (req) {
        return req.analysis || analyzeRequest(req, req.rawText || "", settings);
      }
    }
    if (activeAnalysis) return activeAnalysis;
    return null;
  };

  const runCheck = async () => {
    if (!file) {
      setStatus("Upload a completed COI PDF first.");
      return;
    }
    setBusy(true);
    setStatus(useOcr ? "Running OCR…" : "Reading PDF text…");
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

      const analysis = resolveAnalysis() || {
        detected: {},
        fields: {},
      };

      const { findings } = compareCoi(analysis, parsed.fields, settings);
      const score = computeScore(findings);
      const statusLabel = deriveStatus(score, findings);
      const recommendation = deriveRecommendation(statusLabel);
      const counts = countBySeverity(findings);

      const report = {
        id: generateId("report"),
        date: new Date().toISOString(),
        user: `${user.name} (${user.role})`,
        insuredName: parsed.fields.insuredName || analysis.fields?.insuredName || "Unknown insured",
        certHolderName:
          parsed.fields.certHolderName || analysis.fields?.certHolderName || "Unknown holder",
        score,
        status: statusLabel,
        recommendation: recommendation.label,
        counts,
        findings,
        extracted: parsed.fields,
        analysis,
        fileName: file.name,
      };

      setActiveReport(report);
      setBusy(false);
      navigate("report");
    } catch (err) {
      console.error(err);
      setStatus("Something went wrong reading the PDF. Try OCR mode or a clearer file.");
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Disclaimer settings={settings} inline />

      <div className="card narrow">
        <div className="card-head"><h3>Upload completed ACORD 25</h3></div>

        <UploadBox
          accept=".pdf"
          label="Upload completed COI PDF"
          hint="Drag & drop or click · text-based ACORD 25 PDF"
          onFile={onFile}
          fileName={file?.name}
        />

        <label className="field">
          <span>Related saved request (optional)</span>
          <select value={selectedRequestId} onChange={(e) => setSelectedRequestId(e.target.value)}>
            <option value="">
              {activeAnalysis ? "Use current analyzed request" : "None — presence checks only"}
            </option>
            {requests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.insuredName || "Unnamed"} → {r.certHolderName || "Unnamed holder"}
              </option>
            ))}
          </select>
        </label>

        <label className="checkbox-line">
          <input type="checkbox" checked={useOcr} onChange={(e) => setUseOcr(e.target.checked)} />
          <span>Use OCR mode (for scanned PDFs / screenshots — optional tesseract.js)</span>
        </label>

        {busy && useOcr && ocrProgress > 0 && (
          <div className="progress"><div style={{ width: `${ocrProgress}%` }} /></div>
        )}

        <div className="btn-row">
          <button className="btn btn-primary" onClick={runCheck} disabled={busy}>
            {busy ? "Checking…" : "Run COI Check"}
          </button>
          <button className="btn btn-ghost" onClick={reset}>Reset</button>
        </div>
        {status && <p className="status-line">{status}</p>}

        <p className="tiny">
          The checker reads the PDF text, extracts ACORD 25 fields, and compares them to the
          analyzed request and QC checklist. It reports only whether the COI <em>appears</em> to
          match — it does not confirm coverage.
        </p>
      </div>
    </div>
  );
}
