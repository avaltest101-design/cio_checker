// Settings / Rules page - admin & trainers manage the rule lists.
import React, { useState } from "react";
import { useApp } from "../App.jsx";
import Disclaimer from "../components/Disclaimer.jsx";
import { DEFAULT_RULES } from "../utils/coiRules.js";

// Helpers to edit comma/newline lists as plain text.
const toText = (arr) => (arr || []).join("\n");
const fromText = (txt) => txt.split("\n").map((s) => s.trim()).filter(Boolean);

export default function Settings() {
  const { settings, setSettings, user } = useApp();
  const [draft, setDraft] = useState(settings);
  const [status, setStatus] = useState("");

  const canEdit = ["Trainer", "Team Lead", "Manager"].includes(user.role);

  const updateList = (path, txt) => {
    const next = structuredClone(draft);
    if (path.includes(".")) {
      const [a, b] = path.split(".");
      next[a][b] = fromText(txt);
    } else {
      next[path] = fromText(txt);
    }
    setDraft(next);
  };

  const save = () => {
    setSettings(draft);
    setStatus("Settings saved.");
  };

  const reset = () => {
    setDraft(DEFAULT_RULES);
    setStatus("Reset to defaults (not yet saved).");
  };

  return (
    <div className="page">
      <Disclaimer settings={settings} inline />

      {!canEdit && (
        <div className="card notice">
          You are signed in as <strong>{user.role}</strong>. Settings are read-only for your role.
          Trainers, Team Leads, and Managers can edit.
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <div className="card-head"><h3>Required checklist fields</h3></div>
          <textarea
            rows={8}
            disabled={!canEdit}
            value={toText(draft.requiredChecklistFields)}
            onChange={(e) => updateList("requiredChecklistFields", e.target.value)}
          />

          <div className="card-head"><h3>Escalation keywords</h3></div>
          <textarea
            rows={8}
            disabled={!canEdit}
            value={toText(draft.escalationKeywords)}
            onChange={(e) => updateList("escalationKeywords", e.target.value)}
          />

          <div className="card-head"><h3>Description of Operations keywords</h3></div>
          <textarea
            rows={5}
            disabled={!canEdit}
            value={toText(draft.descriptionOfOperationsKeywords)}
            onChange={(e) => updateList("descriptionOfOperationsKeywords", e.target.value)}
          />
        </div>

        <div className="card">
          <div className="card-head"><h3>Endorsement keywords</h3></div>

          <KeywordBlock label="Additional Insured" disabled={!canEdit}
            value={toText(draft.endorsementKeywords.additionalInsured)}
            onChange={(t) => updateList("endorsementKeywords.additionalInsured", t)} />
          <KeywordBlock label="Waiver of Subrogation" disabled={!canEdit}
            value={toText(draft.endorsementKeywords.waiverOfSubrogation)}
            onChange={(t) => updateList("endorsementKeywords.waiverOfSubrogation", t)} />
          <KeywordBlock label="Primary & Non-Contributory" disabled={!canEdit}
            value={toText(draft.endorsementKeywords.primaryNonContributory)}
            onChange={(t) => updateList("endorsementKeywords.primaryNonContributory", t)} />
          <KeywordBlock label="Completed Operations" disabled={!canEdit}
            value={toText(draft.endorsementKeywords.completedOperations)}
            onChange={(t) => updateList("endorsementKeywords.completedOperations", t)} />
          <KeywordBlock label="Loss Payee / Mortgagee" disabled={!canEdit}
            value={toText(draft.endorsementKeywords.lossPayeeMortgagee)}
            onChange={(t) => updateList("endorsementKeywords.lossPayeeMortgagee", t)} />

          <div className="card-head"><h3>Carrier / agency disclaimer wording</h3></div>
          <textarea
            rows={4}
            disabled={!canEdit}
            value={draft.disclaimer}
            onChange={(e) => setDraft({ ...draft, disclaimer: e.target.value })}
          />
        </div>
      </div>

      {canEdit && (
        <div className="btn-row">
          <button className="btn btn-primary" onClick={save}>Save settings</button>
          <button className="btn btn-ghost" onClick={reset}>Reset to defaults</button>
        </div>
      )}
      {status && <p className="status-line">{status}</p>}
    </div>
  );
}

function KeywordBlock({ label, value, onChange, disabled }) {
  return (
    <label className="field">
      <span>{label} (one per line)</span>
      <textarea rows={3} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
