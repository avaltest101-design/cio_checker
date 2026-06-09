// ===========================================================================
// coiRules.js
// ---------------------------------------------------------------------------
// The heart of the LAVA COI AI Checker:
//   1. DEFAULT_RULES   - editable keyword lists (mirrored on the Settings page)
//   2. analyzeRequest()- a deterministic "mock AI" that reads a COI request and
//                        produces a structured summary, checklist, missing-info
//                        list, escalation warnings, and a suggested Description
//                        of Operations draft.
//   3. compareCoi()    - the comparison engine that checks an analyzed request
//                        against the fields extracted from a completed ACORD 25
//                        PDF and returns severity-tagged findings.
//
// COMPLIANCE: none of this confirms or binds coverage, interprets policy
// language, or replaces a licensed professional. It only flags whether a COI
// *appears* to match a request and a QC checklist, and what to escalate.
// ===========================================================================

import { generateId } from "./storage.js";

// ---------------------------------------------------------------------------
// 1. DEFAULT RULES  (also surfaced + editable on the Settings page)
// ---------------------------------------------------------------------------
export const DEFAULT_RULES = {
  // Checklist fields a reviewer should confirm exist on every COI.
  requiredChecklistFields: [
    "Insured name",
    "Certificate holder name",
    "Certificate holder address",
    "Policy effective dates",
    "Policy expiration dates",
    "Coverage limits",
    "Authorized representative",
    "Date issued",
  ],
  endorsementKeywords: {
    additionalInsured: ["additional insured", "ai", "cg 20 10", "cg 20 37"],
    waiverOfSubrogation: ["waiver of subrogation", "wos", "subrogation waived"],
    primaryNonContributory: [
      "primary and non-contributory",
      "primary & non-contributory",
      "pnc",
    ],
    completedOperations: ["completed operations", "ongoing and completed operations"],
    lossPayeeMortgagee: ["loss payee", "lender's loss payable", "mortgagee"],
  },
  // Phrases in a request that should stop a non-licensed VA and trigger escalation.
  escalationKeywords: [
    "confirm coverage",
    "verify coverage",
    "increase limit",
    "raise limit",
    "change limit",
    "higher limit",
    "bind",
    "guarantee",
    "we require coverage of",
    "must carry",
    "amend the policy",
    "endorse the policy",
  ],
  // Description of Operations keywords used when drafting / validating wording.
  descriptionOfOperationsKeywords: [
    "additional insured",
    "waiver of subrogation",
    "primary and non-contributory",
    "completed operations",
    "re:",
    "project",
  ],
  // Editable disclaimer wording shown across the app.
  disclaimer:
    "This AI checker is a training and quality-control tool only. It does not confirm coverage, bind coverage, interpret policy language, or replace review by a licensed insurance professional.",
};

// ---------------------------------------------------------------------------
// Small text helpers
// ---------------------------------------------------------------------------
function norm(value) {
  return (value || "").toString().toLowerCase();
}

function hasAny(haystack, keywords = []) {
  const text = norm(haystack);
  return keywords.some((k) => text.includes(norm(k)));
}

// Loose match used for name/address comparison: ignores case, punctuation,
// extra whitespace, and common entity suffixes.
function loose(value) {
  return norm(value)
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|ltd|company)\b/g, "")
    .replace(/[.,#&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looseMatch(a, b) {
  const la = loose(a);
  const lb = loose(b);
  if (!la || !lb) return false;
  if (la === lb) return true;
  // Treat as a match if one clearly contains the other (handles partial
  // addresses, suite lines, etc.).
  return la.includes(lb) || lb.includes(la);
}

// ---------------------------------------------------------------------------
// 2. analyzeRequest() - deterministic mock AI request analyzer
// ---------------------------------------------------------------------------
// Accepts the RequestAnalyzer form values (any field may be blank) plus the
// combined free text (pasted request + notes + extracted PDF/image text).
// Returns a structured analysis the rest of the app consumes.
export function analyzeRequest(form = {}, combinedText = "", rules = DEFAULT_RULES) {
  const text = `${combinedText} ${form.requiredCoverage || ""} ${
    form.requiredEndorsements || ""
  } ${form.specialWording || ""}`;

  const kw = rules.endorsementKeywords;

  const detected = {
    generalLiability: hasAny(text, ["general liability", "cgl", "gl ", "commercial general"]),
    autoLiability: hasAny(text, ["auto liability", "automobile", "business auto", "auto "]),
    umbrella: hasAny(text, ["umbrella", "excess liability", "excess"]),
    workersComp: hasAny(text, ["workers comp", "workers' comp", "workers compensation", "wc ", "employers liability"]),
    additionalInsured: hasAny(text, kw.additionalInsured),
    waiverOfSubrogation: hasAny(text, kw.waiverOfSubrogation),
    primaryNonContributory: hasAny(text, kw.primaryNonContributory),
    completedOperations: hasAny(text, kw.completedOperations),
    lossPayeeMortgagee: hasAny(text, kw.lossPayeeMortgagee),
    cancellationNotice: hasAny(text, ["cancellation notice", "notice of cancellation", "30 day", "30-day", "days notice"]),
  };

  // ----- Escalation detection -----
  const escalations = [];
  for (const phrase of rules.escalationKeywords) {
    if (norm(text).includes(norm(phrase))) {
      escalations.push(
        `Request language "${phrase}" may ask a non-licensed VA to confirm, change, or bind coverage. Escalate to a licensed agent.`
      );
    }
  }
  if (detected.lossPayeeMortgagee) {
    escalations.push(
      "Loss payee / mortgagee wording was requested. This may not belong on an ACORD 25 alone (an ACORD 27/28 evidence form may be required). Escalate to confirm the correct form."
    );
  }

  // ----- Missing information -----
  const missingInfo = [];
  if (!form.insuredName) missingInfo.push("Named insured was not provided.");
  if (!form.certHolderName) missingInfo.push("Certificate holder name was not provided.");
  if (!form.certHolderAddress)
    missingInfo.push("Certificate holder address was not provided.");
  if (
    !detected.generalLiability &&
    !detected.autoLiability &&
    !detected.umbrella &&
    !detected.workersComp
  ) {
    missingInfo.push(
      "No specific line of business (GL, Auto, Umbrella, WC) was clearly identified in the request."
    );
  }
  if (!form.projectName && hasAny(text, ["project", "job", "re:"])) {
    missingInfo.push(
      "The request references a project/job but no project name was captured. Confirm the exact project reference."
    );
  }

  // ----- Ambiguities -----
  const ambiguities = [];
  if (hasAny(text, ["as required", "as needed", "per contract", "standard wording"])) {
    ambiguities.push(
      'Request uses open-ended language (e.g. "as required" / "per contract"). Confirm the exact wording with the requester or your Account Manager.'
    );
  }
  if (detected.additionalInsured && !hasAny(text, ["in favor of", "for", "name as"])) {
    ambiguities.push(
      "Additional Insured was requested but the entity to be named is not clearly stated. Confirm who should be added."
    );
  }

  // ----- COI creation checklist -----
  const checklist = [];
  checklist.push("Confirm the named insured matches the active policy.");
  checklist.push("Confirm the certificate holder name and address.");
  checklist.push("Confirm active policy term (effective + expiration dates).");
  if (detected.generalLiability) checklist.push("Include General Liability line.");
  if (detected.autoLiability) checklist.push("Include Auto Liability line.");
  if (detected.umbrella) checklist.push("Include Umbrella / Excess line.");
  if (detected.workersComp) checklist.push("Include Workers Compensation line.");
  if (detected.additionalInsured)
    checklist.push("Verify Additional Insured endorsement is on the policy before adding AI wording / checkbox.");
  if (detected.waiverOfSubrogation)
    checklist.push("Verify Waiver of Subrogation endorsement before adding WOS wording / checkbox.");
  if (detected.primaryNonContributory)
    checklist.push("Add Primary & Non-Contributory wording to Description of Operations only if supported by endorsement.");
  if (detected.completedOperations)
    checklist.push("Confirm Completed Operations is included where requested.");
  checklist.push("Add only supported wording to the Description of Operations.");
  checklist.push("Confirm the certificate holder appears in the CERTIFICATE HOLDER box (not Description).");
  checklist.push("Generate the COI in the agency management system and download the ACORD 25 PDF.");
  checklist.push("Upload the completed PDF to the Completed COI PDF Checker.");

  // ----- Suggested Description of Operations draft (supported wording only) -----
  const descLines = [];
  if (form.projectName) descLines.push(`RE: ${form.projectName}.`);
  if (detected.additionalInsured)
    descLines.push(
      `${form.certHolderName || "[Certificate Holder]"} is included as Additional Insured where required by written contract, subject to policy terms and applicable endorsement.`
    );
  if (detected.waiverOfSubrogation)
    descLines.push(
      "Waiver of Subrogation applies where required by written contract, subject to policy terms and applicable endorsement."
    );
  if (detected.primaryNonContributory)
    descLines.push(
      "Coverage is Primary & Non-Contributory where required by written contract, subject to policy terms and applicable endorsement."
    );
  if (form.specialWording) descLines.push(form.specialWording.trim());
  const suggestedDescription =
    descLines.length > 0
      ? descLines.join(" ")
      : "No special Description of Operations wording was requested. Use standard agency wording.";

  // ----- Plain-English summary -----
  const lines = [];
  lines.push(
    `Request received from ${form.requestFrom || "an unspecified requester"} for ${
      form.insuredName || "the insured"
    }.`
  );
  const coverages = [
    detected.generalLiability && "General Liability",
    detected.autoLiability && "Auto Liability",
    detected.umbrella && "Umbrella / Excess",
    detected.workersComp && "Workers Compensation",
  ].filter(Boolean);
  lines.push(
    coverages.length
      ? `Requested coverage lines: ${coverages.join(", ")}.`
      : "No specific coverage line was clearly identified — confirm with the requester."
  );
  const endorsements = [
    detected.additionalInsured && "Additional Insured",
    detected.waiverOfSubrogation && "Waiver of Subrogation",
    detected.primaryNonContributory && "Primary & Non-Contributory",
    detected.completedOperations && "Completed Operations",
    detected.lossPayeeMortgagee && "Loss Payee / Mortgagee",
  ].filter(Boolean);
  if (endorsements.length)
    lines.push(`Requested endorsement-related items: ${endorsements.join(", ")}.`);
  if (form.certHolderName)
    lines.push(`Certificate holder: ${form.certHolderName}${form.certHolderAddress ? `, ${form.certHolderAddress}` : ""}.`);
  if (escalations.length)
    lines.push(`${escalations.length} item(s) require escalation before proceeding.`);
  const summary = lines.join(" ");

  // ----- Reminders of what the VA cannot decide alone -----
  const reminders = [
    "A non-licensed VA cannot confirm, interpret, change, or bind coverage.",
    "Do not add Additional Insured, Waiver of Subrogation, or Primary & Non-Contributory wording unless it is supported by the policy or an endorsement.",
    "If the request asks to change limits or confirm coverage, escalate to a licensed agent.",
    rules.disclaimer,
  ];

  return {
    detected,
    fields: {
      requestFrom: form.requestFrom || "",
      insuredName: form.insuredName || "",
      certHolderName: form.certHolderName || "",
      certHolderAddress: form.certHolderAddress || "",
      projectName: form.projectName || "",
      specialWording: form.specialWording || "",
      deliveryInstructions: form.deliveryInstructions || "",
      dueDate: form.dueDate || "",
    },
    summary,
    checklist,
    missingInfo,
    ambiguities,
    escalations,
    suggestedDescription,
    reminders,
    engine: "mock", // becomes "claude" when the serverless function answers
  };
}

// ---------------------------------------------------------------------------
// 3. compareCoi() - the comparison engine
// ---------------------------------------------------------------------------
// analysis  : the object returned by analyzeRequest()
// coi       : the field object returned by the PDF checker (see pdfExtractor)
// returns   : { findings: [...] }
//
// Each finding: { id, severity, field, issue, why, suggestion, source,
//                 escalation: { required, to } }
// ---------------------------------------------------------------------------
export function compareCoi(analysis, coi, rules = DEFAULT_RULES) {
  const findings = [];
  const det = analysis?.detected || {};
  const req = analysis?.fields || {};
  const coiText = norm(coi?.rawText || "");

  const add = (severity, field, issue, why, suggestion, source, escalateTo = null) =>
    findings.push({
      id: generateId("find"),
      severity,
      field,
      issue,
      why,
      suggestion,
      source,
      escalation: { required: Boolean(escalateTo), to: escalateTo },
    });

  // 1-3. Certificate holder / insured matching
  if (req.certHolderName) {
    if (!coi.certHolderName) {
      add(
        "Critical",
        "Certificate Holder",
        "No certificate holder was detected on the COI.",
        "The certificate holder box must name the requester so the COI reaches the right party.",
        `Add "${req.certHolderName}" to the CERTIFICATE HOLDER box.`,
        "COI PDF"
      );
    } else if (!looseMatch(req.certHolderName, coi.certHolderName)) {
      add(
        "Critical",
        "Certificate Holder",
        `COI shows "${coi.certHolderName}" but the request asked for "${req.certHolderName}".`,
        "A wrong certificate holder means the COI may go to the wrong party and not satisfy the request.",
        `Correct the certificate holder to "${req.certHolderName}".`,
        "Request"
      );
    }
  }

  if (req.certHolderAddress && coi.certHolderAddress) {
    if (!looseMatch(req.certHolderAddress, coi.certHolderAddress)) {
      add(
        "Moderate",
        "Certificate Holder Address",
        "Certificate holder address on the COI does not appear to match the request.",
        "An incorrect address can cause delivery and compliance issues.",
        `Confirm the address. Request shows: "${req.certHolderAddress}".`,
        "Request"
      );
    }
  }

  if (req.insuredName) {
    if (!coi.insuredName) {
      add(
        "Critical",
        "Insured Name",
        "No insured name detected on the COI.",
        "The named insured must match the entity the request is about.",
        `Confirm the insured. Request shows: "${req.insuredName}".`,
        "COI PDF"
      );
    } else if (!looseMatch(req.insuredName, coi.insuredName)) {
      add(
        "Critical",
        "Insured Name",
        `COI insured "${coi.insuredName}" does not match requested insured "${req.insuredName}".`,
        "A mismatched insured may mean the wrong account's policies were certified.",
        `Verify the correct insured and reissue if needed.`,
        "Request",
        "Licensed Agent / Account Manager"
      );
    }
  }

  // 4. Required coverage lines present
  const lineChecks = [
    ["generalLiability", "General Liability", ["general liability", "commercial general", "cgl", "each occurrence"]],
    ["autoLiability", "Auto Liability", ["automobile liability", "auto liability", "any auto", "hired", "non-owned"]],
    ["umbrella", "Umbrella / Excess", ["umbrella", "excess liab"]],
    ["workersComp", "Workers Compensation", ["workers compensation", "workers' compensation", "employers' liability", "wc statutory"]],
  ];
  for (const [key, label, kws] of lineChecks) {
    if (det[key]) {
      const present = hasAny(coiText, kws);
      if (!present) {
        add(
          "Critical",
          label,
          `${label} was requested but does not appear on the COI.`,
          "A missing required coverage line means the COI does not satisfy the request.",
          `Add the ${label} line with policy number, term dates, and limits.`,
          "Request"
        );
      }
    }
  }

  // 5-8. Policy numbers / dates / limits present (general presence checks)
  if (!coi.hasPolicyNumber) {
    add(
      "Critical",
      "Policy Number",
      "No policy number was detected on the COI.",
      "Each certified line should reference a policy number.",
      "Confirm policy numbers are populated for every line of business.",
      "COI PDF"
    );
  }
  if (!coi.hasEffectiveDate || !coi.hasExpirationDate) {
    add(
      "Critical",
      "Policy Term",
      "Effective and/or expiration dates were not clearly detected.",
      "An incomplete policy term makes the certificate unreliable for the holder.",
      "Confirm both effective (eff) and expiration (exp) dates appear for each line.",
      "COI PDF"
    );
  }
  if (!coi.hasLimits) {
    add(
      "Critical",
      "Limits",
      "No coverage limits were detected on the COI.",
      "Requesters rely on the limits to confirm the insured meets their requirement.",
      "Confirm limit amounts (e.g. each occurrence, aggregate) are shown.",
      "COI PDF"
    );
  }

  // 9. Additional Insured
  if (det.additionalInsured) {
    const present =
      hasAny(coiText, rules.endorsementKeywords.additionalInsured) ||
      coi.additionalInsuredChecked;
    if (!present) {
      add(
        "Critical",
        "Additional Insured",
        "Additional Insured was requested but no AI checkbox or wording was detected.",
        "Without AI status the certificate holder is not protected as the request requires.",
        "Confirm the AI endorsement is on the policy, then check the ADD'L INSD box and/or add AI wording to the Description.",
        "Request",
        "Licensed Agent (if endorsement status is unclear)"
      );
    }
  }

  // 10. Waiver of Subrogation
  if (det.waiverOfSubrogation) {
    const present =
      hasAny(coiText, rules.endorsementKeywords.waiverOfSubrogation) ||
      coi.waiverChecked;
    if (!present) {
      add(
        "Critical",
        "Waiver of Subrogation",
        "Waiver of Subrogation was requested but no WOS checkbox or wording was detected.",
        "A missing waiver may breach the contract the requester is enforcing.",
        "Confirm the WOS endorsement, then check the SUBR WVD box and/or add WOS wording to the Description.",
        "Request",
        "Licensed Agent (if endorsement status is unclear)"
      );
    }
  }

  // 11. Primary & Non-Contributory
  if (det.primaryNonContributory) {
    const present = hasAny(coiText, rules.endorsementKeywords.primaryNonContributory);
    if (!present) {
      add(
        "Critical",
        "Primary & Non-Contributory",
        "Primary & Non-Contributory wording was requested but not found in the Description.",
        "PNC wording is often a contractual requirement for the certificate holder.",
        'Add P&NC wording to the Description of Operations if supported by endorsement.',
        "Request"
      );
    }
  }

  // 12. Special wording requested
  if (req.specialWording) {
    const found = looseMatch(coi.description || coiText, req.specialWording);
    if (!found) {
      add(
        "Critical",
        "Special Wording",
        "Requested special wording does not appear in the Description of Operations.",
        "Specific contract wording is frequently mandatory for acceptance.",
        `Add the requested wording (only if supported): "${req.specialWording}".`,
        "Request"
      );
    }
  }

  // 13. Project / job reference
  if (req.projectName) {
    const found = hasAny(coi.description || coiText, [req.projectName]);
    if (!found) {
      add(
        "Moderate",
        "Project / Job Reference",
        `Project reference "${req.projectName}" was not found in the Description.`,
        "Many holders require the project named so the COI is tied to the correct job.",
        `Add "RE: ${req.projectName}" to the Description of Operations.`,
        "Request"
      );
    }
  }

  // 14. Certificate holder placement
  if (coi.certHolderName && coi.description && hasAny(coi.description, [coi.certHolderName])) {
    add(
      "Moderate",
      "Certificate Holder Placement",
      "Certificate holder name also appears inside the Description of Operations.",
      "The holder belongs in the CERTIFICATE HOLDER box; duplicate placement can confuse the record.",
      "Confirm the holder is in the correct box and remove duplicates if unintended.",
      "Rule"
    );
  }

  // 15. Authorized representative
  if (!coi.hasAuthorizedRep) {
    add(
      "Moderate",
      "Authorized Representative",
      "No authorized representative signature/line was detected.",
      "An unsigned certificate may be rejected by the holder.",
      "Confirm the authorized representative is present before sending.",
      "COI PDF"
    );
  }

  // 16. Issue date
  if (!coi.dateIssued) {
    add(
      "Moderate",
      "Date Issued",
      "No issue date was detected on the COI.",
      "The issue date establishes when the certificate was produced.",
      "Confirm the DATE (MM/DD/YYYY) field is populated.",
      "COI PDF"
    );
  }

  // 17. NAIC / producer contact (moderate completeness checks)
  if (!coi.hasNaic) {
    add(
      "Moderate",
      "NAIC Number",
      "No NAIC number was detected for the insurer(s).",
      "Some holders require the NAIC # to verify the carrier.",
      "Confirm NAIC # is populated for each insurer used.",
      "COI PDF"
    );
  }

  // Cancellation notice requested
  if (det.cancellationNotice) {
    const found = hasAny(coiText, ["cancellation", "notice"]);
    if (!found) {
      add(
        "Moderate",
        "Cancellation Notice",
        "Cancellation notice wording was requested but the standard cancellation block was not detected.",
        "Holders sometimes require explicit notice language where the policy allows it.",
        "Confirm the cancellation block is present. Do not promise notice the policy does not provide — escalate if unclear.",
        "Request",
        "Licensed Agent (if specific notice terms are requested)"
      );
    }
  }

  // Always-on training reminders (Info severity, no score penalty)
  add(
    "Info",
    "Escalation Reminder",
    "Endorsement status must be verified on the policy, not assumed from the request.",
    "Adding AI/WOS/PNC wording without a supporting endorsement misrepresents coverage.",
    "If any endorsement status is unclear, escalate before sending.",
    "Rule"
  );
  add(
    "Info",
    "Compliance Reminder",
    rules.disclaimer,
    "This tool supports QC and training; it does not make coverage decisions.",
    "A licensed professional owns the final decision.",
    "Rule"
  );

  return { findings };
}
