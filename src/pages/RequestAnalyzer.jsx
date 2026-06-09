// COI Request Analyzer - first major workflow.
import React, { useState } from "react";
import { useApp } from "../App.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import UploadBox from "../components/UploadBox.jsx";
import { MOCK_REQUESTS } from "../data/mockRequests.js";
import { aiAnalyzeRequest } from "../utils/aiClient.js";
import { extractTextFromPdf, extractTextWithOcr } from "../utils/pdfExtractor.js";
import { saveRequest, generateId } from "../utils/storage.js";

const EMPTY = {
  requestFrom: "",
  insuredName: "",
  certHolderName: "",
  certHolderAddress: "",
  projectName: "",
  requiredCoverage: "",
  requiredEndorsements: "",
  specialWording: "",
  deliveryInstructions: "",
  dueDate: "",
  internalNotes: "",
  rawText: "",
};

export default function RequestAnalyzer() {
  const { settings, setActiveAnalysis, refreshRequests, navigate } = useApp();
  const [form, setForm] = useState(EMPTY);
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const loadSample = (id) => {
    const s = MOCK_REQUESTS.find((r) => r.id === id);
    if (s) {
      setForm({ ...EMPTY, ...s });
      setAnalysis(null);
      setStatus(`Loaded "${s.label}".`);
    }
  };

  const handleUpload = async (file) => {
    setStatus("Reading uploaded file…");
    try {
      let text = "";
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        text = await extractTextFromPdf(file);
      } else {
        // Image/screenshot -> OCR (optional dependency).
        text = await extractTextWithOcr(file);
      }
      if (text) {
        setForm((f) => ({ ...f, rawText: `${f.rawText}\n${text}`.trim() }));
        setStatus("Extracted text added to the request text box below.");
      } else {
        setStatus("No text could be read from that file. Paste the request manually.");
      }
    } catch (err) {
      setStatus(err.message || "Could not read that file. Paste the request manually.");
    }
  };

  const analyze = async () => {
    setBusy(true);
    setStatus("Analyzing request…");
    try {
      const combinedText = `${form.rawText}\n${form.internalNotes}`.trim();
      const result = await aiAnalyzeRequest({ form, combinedText, rules: settings });
      setAnalysis(result);
      setActiveAnalysis({ ...result, _form: form });
      setStatus(
        result.engine === "claude"
          ? "Analysis complete (Claude AI)."
          : "Analysis complete (mock engine — connect Claude later)."
      );
    } catch (err) {
      setStatus("Analysis failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setForm(EMPTY);
    setAnalysis(null);
    setStatus("Cleared.");
  };

  const save = () => {
    const record = {
      id: generateId("req"),
      ...form,
      analysis,
      savedAt: new Date().toISOString(),
    };
    saveRequest(record);
    refreshRequests();
    setStatus("Request saved. It will appear in the Completed COI Checker.");
  };

  const continueToGuidance = () => {
    if (!analysis) {
      setStatus("Analyze the request first.");
      return;
    }
    setActiveAnalysis({ ...analysis, _form: form });
    navigate("guidance");
  };

  return (
    <div className="page">
      <Disclaimer settings={settings} inline />

      <div className="two-col">
        {/* ---- Input column ---- */}
        <div className="card">
          <div className="card-head">
            <h3>COI request</h3>
            <select
              className="select-sm"
              defaultValue=""
              onChange={(e) => e.target.value && loadSample(e.target.value)}
            >
              <option value="">Load sample…</option>
              {MOCK_REQUESTS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid-2">
            <Field label="Request received from" value={form.requestFrom} onChange={set("requestFrom")} />
            <Field label="Insured name" value={form.insuredName} onChange={set("insuredName")} />
            <Field label="Certificate holder name" value={form.certHolderName} onChange={set("certHolderName")} />
            <Field label="Certificate holder address" value={form.certHolderAddress} onChange={set("certHolderAddress")} />
            <Field label="Project / job name" value={form.projectName} onChange={set("projectName")} />
            <Field label="Due date" value={form.dueDate} onChange={set("dueDate")} placeholder="MM/DD/YYYY" />
          </div>

          <Field label="Required coverage" value={form.requiredCoverage} onChange={set("requiredCoverage")} placeholder="e.g. General Liability, Auto Liability" />
          <Field label="Required endorsements" value={form.requiredEndorsements} onChange={set("requiredEndorsements")} placeholder="e.g. Additional Insured, Waiver of Subrogation" />
          <Field label="Special wording" value={form.specialWording} onChange={set("specialWording")} />
          <Field label="Delivery instructions" value={form.deliveryInstructions} onChange={set("deliveryInstructions")} />

          <label className="field">
            <span>Paste request text</span>
            <textarea rows={5} value={form.rawText} onChange={set("rawText")} placeholder="Paste the email / request text here…" />
          </label>

          <label className="field">
            <span>Internal notes</span>
            <textarea rows={3} value={form.internalNotes} onChange={set("internalNotes")} />
          </label>

          <UploadBox
            accept=".pdf,image/*"
            label="Upload request PDF or screenshot"
            hint="PDF text is read automatically · images use OCR mode"
            onFile={handleUpload}
          />

          <div className="btn-row">
            <button className="btn btn-primary" onClick={analyze} disabled={busy}>
              {busy ? "Analyzing…" : "Analyze Request"}
            </button>
            <button className="btn btn-ghost" onClick={clear}>Clear</button>
            <button className="btn btn-outline" onClick={save}>Save Request</button>
            <button className="btn btn-outline" onClick={continueToGuidance}>
              Continue to COI Build Guidance →
            </button>
          </div>
          {status && <p className="status-line">{status}</p>}
        </div>

        {/* ---- Result column ---- */}
        <div className="card result-card">
          <div className="card-head">
            <h3>COI request summary</h3>
            {analysis && (
              <span className="engine-tag">
                {analysis.engine === "claude" ? "Claude AI" : "Mock engine"}
              </span>
            )}
          </div>

          {!analysis && (
            <div className="empty-state">
              <p>Run <strong>Analyze Request</strong> to generate a structured summary, checklist, missing-info list, and escalation warnings.</p>
            </div>
          )}

          {analysis && (
            <div className="analysis">
              <Section title="1 · Plain-English summary">
                <p>{analysis.summary}</p>
              </Section>

              <Section title="2 · COI creation checklist">
                <ul className="bullet">
                  {analysis.checklist.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </Section>

              <Section title="3 · Missing information">
                {analysis.missingInfo.length ? (
                  <ul className="bullet warn">
                    {analysis.missingInfo.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                ) : <p className="ok-text">No required fields appear to be missing.</p>}
              </Section>

              {analysis.ambiguities?.length > 0 && (
                <Section title="Ambiguous request language">
                  <ul className="bullet warn">
                    {analysis.ambiguities.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </Section>
              )}

              <Section title="4 · Escalation warnings">
                {analysis.escalations.length ? (
                  <ul className="bullet escalate">
                    {analysis.escalations.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                ) : <p className="ok-text">No escalation triggers detected. Continue with standard process.</p>}
              </Section>

              <Section title="5 · Suggested Description of Operations draft">
                <div className="doo-box">{analysis.suggestedDescription}</div>
                <p className="tiny">Use only wording supported by the policy or an endorsement.</p>
              </Section>

              <Section title="6 · What the VA cannot decide alone">
                <ul className="bullet reminder">
                  {analysis.reminders.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </Section>

              <Section title="Detected requirements">
                <div className="detected-chips">
                  {Object.entries(analysis.detected).filter(([, v]) => v).length === 0 && (
                    <span className="tiny">None detected.</span>
                  )}
                  {Object.entries(analysis.detected).map(([k, v]) =>
                    v ? <span key={k} className="chip">{labelFor(k)}</span> : null
                  )}
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
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

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="text" value={value} onChange={onChange} placeholder={placeholder} />
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div className="analysis-section">
      <h4>{title}</h4>
      {children}
    </div>
  );
}
