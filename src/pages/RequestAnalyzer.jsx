// COI Request Analyzer - first major workflow.
// The analyzer converts a client's COI instruction into a guided VA action plan.
import React, { useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import UploadBox from "../components/UploadBox.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
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
  const [currentRequestId, setCurrentRequestId] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const hasRequestText = useMemo(
    () => Boolean(`${form.rawText} ${form.internalNotes} ${form.certHolderName} ${form.requiredCoverage} ${form.requiredEndorsements}`.trim()),
    [form]
  );

  const loadSample = (id) => {
    const s = MOCK_REQUESTS.find((r) => r.id === id);
    if (s) {
      setForm({ ...EMPTY, ...s });
      setAnalysis(null);
      setCurrentRequestId("");
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
        text = await extractTextWithOcr(file);
      }
      if (text) {
        setForm((f) => ({ ...f, rawText: `${f.rawText}\n${text}`.trim() }));
        setAnalysis(null);
        setCurrentRequestId("");
        setStatus("Extracted text was added to the client request box. Review it, then click Analyze Request.");
      } else {
        setStatus("No text could be read from that file. Paste the request manually.");
      }
    } catch (err) {
      setStatus(err.message || "Could not read that file. Paste the request manually.");
    }
  };

  const analyze = async () => {
    if (!hasRequestText) {
      setStatus("Paste the client's COI request, upload a screenshot/PDF, or fill in the request fields first.");
      return;
    }
    setBusy(true);
    setStatus("Analyzing client instructions…");
    try {
      const combinedText = `${form.rawText}\n${form.internalNotes}`.trim();
      const result = await aiAnalyzeRequest({ form, combinedText, rules: settings });
      const enriched = {
        ...result,
        _form: form,
        workflowStage: "request_analyzed",
        analyzedAt: new Date().toISOString(),
      };
      setAnalysis(enriched);
      setActiveAnalysis(enriched);
      setCurrentRequestId("");
      setStatus(
        result.engine === "claude"
          ? "Client instructions analyzed with Claude AI. Follow the build plan, then continue to upload the completed COI."
          : "Client instructions analyzed with the built-in mock engine. Follow the build plan, then continue to upload the completed COI."
      );
    } catch (err) {
      console.error(err);
      setStatus("Analysis failed. Please try again or paste the request manually.");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setForm(EMPTY);
    setAnalysis(null);
    setCurrentRequestId("");
    setStatus("Cleared.");
  };

  const saveCurrentRequest = () => {
    const active = analysis || { fields: form, detected: {}, checklist: [], missingInfo: [], escalations: [] };
    const id = currentRequestId || generateId("req");
    const record = {
      id,
      ...form,
      analysis: { ...active, _form: form, _requestId: id },
      savedAt: new Date().toISOString(),
      status: analysis ? "Ready to Create" : "Pending",
    };
    saveRequest(record);
    refreshRequests();
    setCurrentRequestId(id);
    setActiveAnalysis(record.analysis);
    setStatus("Request saved and linked to this workflow.");
    return record;
  };

  const continueToChecker = () => {
    if (!analysis) {
      setStatus("Analyze the client's request first. The PDF checker needs the analyzed instructions to compare against.");
      return;
    }
    const record = saveCurrentRequest();
    setActiveAnalysis(record.analysis);
    navigate("checker");
  };

  const continueToGuidance = () => {
    if (!analysis) {
      setStatus("Analyze the request first.");
      return;
    }
    const record = saveCurrentRequest();
    setActiveAnalysis(record.analysis);
    navigate("guidance");
  };

  return (
    <div className="page">
      <Disclaimer settings={settings} inline />
      <WorkflowSteps active="analyzer" />

      <div className="two-col">
        <div className="card">
          <div className="card-head">
            <h3>1 · Paste Client COI Request / Instructions Here</h3>
            <select
              className="select-sm"
              defaultValue=""
              onChange={(e) => e.target.value && loadSample(e.target.value)}
            >
              <option value="">Load sample…</option>
              {MOCK_REQUESTS.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>

          <p className="helper-text">
            Paste the email, chat message, or certificate holder instructions below. The app will turn it into a VA-ready COI build plan.
          </p>

          <label className="field request-textarea">
            <span>Client request / instructions</span>
            <textarea
              rows={8}
              value={form.rawText}
              onChange={(e) => {
                setForm({ ...form, rawText: e.target.value });
                setAnalysis(null);
                setCurrentRequestId("");
              }}
              placeholder="Example: Please issue a COI for ABC Construction. Certificate Holder: XYZ Property Management, 123 Main Street, Dallas, TX. Please include GL and Auto. Add Additional Insured and Waiver of Subrogation if available. Project: 123 Main Street Renovation."
            />
          </label>

          <UploadBox
            accept=".pdf,image/*"
            label="Or upload request PDF / screenshot"
            hint="PDF text is read automatically · screenshots use OCR mode"
            onFile={handleUpload}
          />

          <div className="divider-label">Optional fields to improve accuracy</div>
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
            <span>Internal notes</span>
            <textarea rows={3} value={form.internalNotes} onChange={set("internalNotes")} placeholder="Add VA notes, AMS/client notes, or escalation context." />
          </label>

          <div className="btn-row">
            <button className="btn btn-primary" onClick={analyze} disabled={busy}>
              {busy ? "Analyzing…" : "Analyze Request"}
            </button>
            <button className="btn btn-ghost" onClick={clear}>Clear</button>
            <button className="btn btn-outline" onClick={saveCurrentRequest}>Save Request</button>
          </div>
          {status && <p className="status-line">{status}</p>}
        </div>

        <div className="card result-card">
          <div className="card-head">
            <h3>2 · Instructions from the Web App</h3>
            {analysis && (
              <span className="engine-tag">{analysis.engine === "claude" ? "Claude AI" : "Mock engine"}</span>
            )}
          </div>

          {!analysis && (
            <div className="empty-state">
              <p><strong>Paste the client request and click Analyze Request.</strong></p>
              <p>The app will show exactly what to verify, what to enter on the COI, what wording may be needed, and what must be escalated.</p>
            </div>
          )}

          {analysis && (
            <div className="analysis">
              <Section title="Client request summary">
                <p>{analysis.summary}</p>
              </Section>

              <Section title="VA action plan before creating the COI">
                <InstructionCards analysis={analysis} />
              </Section>

              <Section title="COI creation checklist">
                <ul className="bullet">
                  {analysis.checklist.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </Section>

              <Section title="Missing information / questions to resolve">
                {analysis.missingInfo.length ? (
                  <ul className="bullet warn">{analysis.missingInfo.map((m, i) => <li key={i}>{m}</li>)}</ul>
                ) : <p className="ok-text">No required fields appear to be missing.</p>}
              </Section>

              {analysis.ambiguities?.length > 0 && (
                <Section title="Ambiguous request language">
                  <ul className="bullet warn">{analysis.ambiguities.map((m, i) => <li key={i}>{m}</li>)}</ul>
                </Section>
              )}

              <Section title="Escalation warnings">
                {analysis.escalations.length ? (
                  <ul className="bullet escalate">{analysis.escalations.map((m, i) => <li key={i}>{m}</li>)}</ul>
                ) : <p className="ok-text">No escalation triggers detected. Continue with standard process.</p>}
              </Section>

              <Section title="Suggested Description of Operations draft">
                <div className="doo-box">{analysis.suggestedDescription}</div>
                <p className="tiny">Use only wording supported by the policy or an endorsement.</p>
              </Section>

              <Section title="Detected requirements">
                <div className="detected-chips">
                  {Object.entries(analysis.detected).filter(([, v]) => v).length === 0 && <span className="tiny">None detected.</span>}
                  {Object.entries(analysis.detected).map(([k, v]) => v ? <span key={k} className="chip">{labelFor(k)}</span> : null)}
                </div>
              </Section>

              <div className="next-step-panel">
                <div>
                  <strong>After you follow the instructions and create the COI:</strong>
                  <p>Click Continue, upload the completed ACORD 25 PDF, and the checker will compare it against this client request.</p>
                </div>
                <button className="btn btn-primary" onClick={continueToChecker}>
                  Continue → Upload Completed COI PDF
                </button>
                <button className="btn btn-outline" onClick={continueToGuidance}>
                  Open detailed build checklist
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkflowSteps({ active }) {
  const steps = [
    ["analyzer", "1", "Paste request"],
    ["instructions", "2", "Follow instructions"],
    ["checker", "3", "Upload completed COI"],
    ["report", "4", "Review corrections"],
  ];
  return (
    <div className="workflow-steps">
      {steps.map(([key, num, label]) => (
        <div key={key} className={`workflow-step ${key === active || (active === "analyzer" && key === "instructions") ? "active" : ""}`}>
          <span>{num}</span>{label}
        </div>
      ))}
    </div>
  );
}

function InstructionCards({ analysis }) {
  const d = analysis.detected || {};
  const f = analysis.fields || {};
  const instructions = [
    { title: "Confirm account", body: `Use the correct account/named insured: ${f.insuredName || "confirm the exact insured name before issuing"}.` },
    { title: "Enter certificate holder", body: `${f.certHolderName || "Add the certificate holder exactly as requested"}${f.certHolderAddress ? ` — ${f.certHolderAddress}` : " and confirm the full holder address."}` },
    { title: "Add requested lines", body: coverageText(d) },
    { title: "Verify endorsements", body: endorsementText(d) },
    { title: "Description of Operations", body: f.projectName ? `Include the project reference if appropriate: RE: ${f.projectName}.` : "Add special wording only when supported and required." },
    { title: "Final step", body: "After creating the COI, download the completed ACORD 25 PDF and upload it on the next page for checking." },
  ];
  return (
    <div className="instruction-grid">
      {instructions.map((item, index) => (
        <div className="instruction-card" key={item.title}>
          <span className="instruction-num">{index + 1}</span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function coverageText(d) {
  const coverage = [
    d.generalLiability && "General Liability",
    d.autoLiability && "Auto Liability",
    d.umbrella && "Umbrella / Excess",
    d.workersComp && "Workers Compensation",
  ].filter(Boolean);
  return coverage.length ? `Include and verify: ${coverage.join(", ")}.` : "No specific coverage line was clearly detected. Confirm before creating the COI.";
}

function endorsementText(d) {
  const endorsements = [
    d.additionalInsured && "Additional Insured",
    d.waiverOfSubrogation && "Waiver of Subrogation",
    d.primaryNonContributory && "Primary & Non-Contributory",
    d.completedOperations && "Completed Operations",
  ].filter(Boolean);
  return endorsements.length ? `Do not add these unless supported: ${endorsements.join(", ")}. Escalate if support is unclear.` : "No endorsement wording was clearly requested. Do not add AI/WOS/PNC unless requested and supported.";
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
      <input value={value} onChange={onChange} placeholder={placeholder || ""} />
    </label>
  );
}

function Section({ title, children }) {
  return (
    <section className="analysis-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}
