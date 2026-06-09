// ===========================================================================
// coiRules.js - LAVA COI AI Checker rule engine
// Conservative QC only. It does not confirm coverage, bind coverage, interpret
// policy language, or replace review by a licensed insurance professional.
// ===========================================================================

import { generateId } from "./storage.js";

export const DEFAULT_RULES = {
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
    additionalInsured: ["additional insured", "add'l insured", "addl insured", "add'l insd", "addl insd", "cg 20 10", "cg 20 37"],
    waiverOfSubrogation: ["waiver of subrogation", "subrogation waived", "subr wvd", "wos"],
    primaryNonContributory: ["primary and non-contributory", "primary & non-contributory", "primary non-contributory", "p&nc", "pnc"],
    completedOperations: ["completed operations", "ongoing and completed operations"],
    lossPayeeMortgagee: ["loss payee", "lender's loss payable", "mortgagee"],
  },
  escalationKeywords: [
    "confirm coverage", "verify coverage", "increase limit", "raise limit", "change limit", "higher limit", "bind", "guarantee", "we require coverage of", "must carry", "amend the policy", "endorse the policy", "per contract"
  ],
  descriptionOfOperationsKeywords: ["additional insured", "waiver of subrogation", "primary and non-contributory", "completed operations", "re:", "project"],
  disclaimer: "This AI checker is a training and quality-control tool only. It does not confirm coverage, bind coverage, interpret policy language, or replace review by a licensed insurance professional.",
};

function norm(value) { return (value || "").toString().toLowerCase(); }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function hasKeyword(haystack, keyword) {
  const raw = haystack || "";
  const text = norm(raw);
  const k = norm(keyword).trim();
  if (!text || !k) return false;
  if (["ai", "gl", "wc", "wos", "pnc"].includes(k) || (k.length <= 3 && /^[a-z]+$/.test(k))) {
    return new RegExp(`\\b${escapeRegExp(k)}\\b`, "i").test(raw);
  }
  return text.includes(k);
}
function hasAny(haystack, keywords = []) { return keywords.some((keyword) => hasKeyword(haystack, keyword)); }
function loose(value) {
  return norm(value).replace(/\b(llc|inc|incorporated|corp|corporation|co|ltd|company|the)\b/g, "").replace(/[.,#&/()\-]/g, " ").replace(/\s+/g, " ").trim();
}
function looseMatch(a, b) {
  const la = loose(a); const lb = loose(b);
  if (!la || !lb) return false;
  return la === lb || la.includes(lb) || lb.includes(la);
}
function lineScore(name, address) { return [name, address].filter(Boolean).join(" "); }

export function analyzeRequest(form = {}, combinedText = "", rules = DEFAULT_RULES) {
  const parsed = parseRequestFields(combinedText, form);
  const fields = {
    requestFrom: form.requestFrom || parsed.requestFrom || "",
    insuredName: form.insuredName || parsed.insuredName || "",
    certHolderName: form.certHolderName || parsed.certHolderName || "",
    certHolderAddress: form.certHolderAddress || parsed.certHolderAddress || "",
    projectName: form.projectName || parsed.projectName || "",
    specialWording: form.specialWording || parsed.specialWording || "",
    deliveryInstructions: form.deliveryInstructions || parsed.deliveryInstructions || "",
    dueDate: form.dueDate || parsed.dueDate || "",
  };

  const text = `${combinedText} ${form.requiredCoverage || ""} ${form.requiredEndorsements || ""} ${form.specialWording || ""}`;
  const kw = rules.endorsementKeywords || DEFAULT_RULES.endorsementKeywords;
  const detected = {
    generalLiability: hasAny(text, ["general liability", "commercial general liability", "cgl", "gl", "each occurrence"]),
    autoLiability: hasAny(text, ["auto liability", "automobile liability", "business auto", "any auto", "hired auto", "non-owned auto"]),
    umbrella: hasAny(text, ["umbrella", "excess liability", "excess"]),
    workersComp: hasAny(text, ["workers comp", "workers' comp", "workers compensation", "workers' compensation", "wc", "employers liability"]),
    additionalInsured: hasAny(text, kw.additionalInsured) || /\bAI\b/.test(text || ""),
    waiverOfSubrogation: hasAny(text, kw.waiverOfSubrogation),
    primaryNonContributory: hasAny(text, kw.primaryNonContributory),
    completedOperations: hasAny(text, kw.completedOperations),
    lossPayeeMortgagee: hasAny(text, kw.lossPayeeMortgagee),
    cancellationNotice: hasAny(text, ["cancellation notice", "notice of cancellation", "30 day", "30-day", "days notice"]),
  };

  const escalations = [];
  for (const phrase of rules.escalationKeywords || DEFAULT_RULES.escalationKeywords) {
    if (hasKeyword(text, phrase)) escalations.push(`Request language "${phrase}" may ask a non-licensed VA to confirm, change, or bind coverage. Escalate to a licensed agent.`);
  }
  if (detected.lossPayeeMortgagee) escalations.push("Loss payee / mortgagee wording was requested. This may not belong on an ACORD 25 alone; an Evidence of Property form may be required. Escalate to confirm the correct form.");

  const missingInfo = [];
  if (!fields.insuredName) missingInfo.push("Named insured was not clearly captured. Confirm the exact account/policy insured before issuing.");
  if (!fields.certHolderName) missingInfo.push("Certificate holder name was not clearly captured.");
  if (!fields.certHolderAddress) missingInfo.push("Certificate holder address was not clearly captured.");
  if (!detected.generalLiability && !detected.autoLiability && !detected.umbrella && !detected.workersComp) missingInfo.push("No specific line of business (GL, Auto, Umbrella, WC) was clearly identified in the request.");
  if (!fields.projectName && hasAny(text, ["project", "job", "re:"])) missingInfo.push("The request references a project/job but no project name was captured. Confirm the exact project reference.");

  const ambiguities = [];
  if (hasAny(text, ["as required", "as needed", "per contract", "standard wording"])) ambiguities.push('Request uses open-ended language such as "as required" / "per contract". Confirm the exact wording with the requester, Account Manager, or licensed agent.');
  if (detected.additionalInsured && !fields.certHolderName && !hasAny(text, ["in favor of", "name as"])) ambiguities.push("Additional Insured was requested but the entity to be named is not clearly captured. Confirm who should be named.");

  const checklist = [
    `Confirm the named insured${fields.insuredName ? `: ${fields.insuredName}` : " matches the active policy"}.`,
    `Confirm the certificate holder${fields.certHolderName ? `: ${fields.certHolderName}` : " name"}${fields.certHolderAddress ? `, ${fields.certHolderAddress}` : " and address"}.`,
    "Confirm active policy term dates before issuing the COI.",
  ];
  if (fields.projectName) checklist.push(`Include project/job reference when appropriate: RE: ${fields.projectName}.`);
  if (detected.generalLiability) checklist.push("Include General Liability line with policy number, term dates, and limits.");
  if (detected.autoLiability) checklist.push("Include Auto Liability line with policy number, term dates, and limits.");
  if (detected.umbrella) checklist.push("Include Umbrella / Excess line with policy number, term dates, and limits.");
  if (detected.workersComp) checklist.push("Include Workers Compensation line with policy number, term dates, and limits.");
  if (detected.additionalInsured) checklist.push("Verify Additional Insured endorsement/support before adding AI wording or marking ADD'L INSD.");
  if (detected.waiverOfSubrogation) checklist.push("Verify Waiver of Subrogation endorsement/support before adding WOS wording or marking SUBR WVD.");
  if (detected.primaryNonContributory) checklist.push("Add Primary & Non-Contributory wording only if supported by policy/endorsement.");
  if (detected.completedOperations) checklist.push("Confirm Completed Operations wording is supported before including it.");
  checklist.push("Add only approved/supported wording to Description of Operations.", "Place the holder in the CERTIFICATE HOLDER box, not only in Description.", "After creating the COI, upload the finished ACORD 25 PDF back into this checker.");

  const descLines = [];
  if (fields.projectName) descLines.push(`RE: ${fields.projectName}.`);
  if (detected.additionalInsured) descLines.push(`${fields.certHolderName || "[Certificate Holder]"} is included as Additional Insured where required by written contract, subject to policy terms and applicable endorsement.`);
  if (detected.waiverOfSubrogation) descLines.push("Waiver of Subrogation applies where required by written contract, subject to policy terms and applicable endorsement.");
  if (detected.primaryNonContributory) descLines.push("Coverage is Primary & Non-Contributory where required by written contract, subject to policy terms and applicable endorsement.");
  if (fields.specialWording) descLines.push(fields.specialWording.trim());

  const coverages = [detected.generalLiability && "General Liability", detected.autoLiability && "Auto Liability", detected.umbrella && "Umbrella / Excess", detected.workersComp && "Workers Compensation"].filter(Boolean);
  const endorsements = [detected.additionalInsured && "Additional Insured", detected.waiverOfSubrogation && "Waiver of Subrogation", detected.primaryNonContributory && "Primary & Non-Contributory", detected.completedOperations && "Completed Operations", detected.lossPayeeMortgagee && "Loss Payee / Mortgagee"].filter(Boolean);
  const summaryParts = [`Request received from ${fields.requestFrom || "an unspecified requester"} for ${fields.insuredName || "the insured"}.`, coverages.length ? `Requested coverage lines: ${coverages.join(", ")}.` : "No specific coverage line was clearly identified; confirm before creating the COI."];
  if (endorsements.length) summaryParts.push(`Requested endorsement-related items: ${endorsements.join(", ")}.`);
  if (fields.certHolderName) summaryParts.push(`Certificate holder: ${fields.certHolderName}${fields.certHolderAddress ? `, ${fields.certHolderAddress}` : ""}.`);
  if (fields.projectName) summaryParts.push(`Project/job reference: ${fields.projectName}.`);
  if (escalations.length) summaryParts.push(`${escalations.length} item(s) require escalation before proceeding.`);

  return {
    detected,
    fields,
    summary: summaryParts.join(" "),
    checklist,
    missingInfo,
    ambiguities,
    escalations,
    suggestedDescription: descLines.length ? descLines.join(" ") : "No special Description of Operations wording was requested. Use standard agency wording.",
    reminders: ["A non-licensed VA cannot confirm, interpret, change, or bind coverage.", "Do not add AI, WOS, PNC, Completed Operations, or special wording unless supported by the policy or endorsement.", "If the request asks to change limits or confirm coverage, escalate to a licensed agent.", rules.disclaimer || DEFAULT_RULES.disclaimer],
    engine: "mock",
  };
}

export function compareCoi(analysis, coi, rules = DEFAULT_RULES) {
  const findings = [];
  const det = analysis?.detected || {};
  const req = analysis?.fields || {};
  const coiText = coi?.rawText || "";
  const add = (severity, field, issue, why, suggestion, source, escalateTo = null) => findings.push({ id: generateId("find"), severity, field, issue, why, suggestion, source, escalation: { required: Boolean(escalateTo), to: escalateTo } });

  if (!analysis || (!req.insuredName && !req.certHolderName && Object.values(det).every((v) => !v))) {
    add("Info", "Request Match", "No analyzed request was selected for this check.", "The app can perform completeness checks, but it cannot compare the COI against the client's exact request.", "Analyze/paste the COI request first, then select it before running the PDF check.", "Rule");
  }

  if (req.certHolderName) {
    const holderText = lineScore(coi?.certHolderName, coi?.certHolderAddress);
    if (!coi?.certHolderName) add("Critical", "Certificate Holder", "No certificate holder value was confidently detected on the COI.", "The certificate holder box must match the requester or entity requiring the COI.", `Add or verify "${req.certHolderName}" in the CERTIFICATE HOLDER box.`, "COI PDF");
    else if (!looseMatch(req.certHolderName, holderText)) add("Critical", "Certificate Holder", `COI appears to show "${coi.certHolderName}" but the request asked for "${req.certHolderName}".`, "A wrong certificate holder can cause rejection and may send the certificate to the wrong party.", `Correct the certificate holder to "${req.certHolderName}".`, "Request");
  }
  if (req.certHolderAddress) {
    if (!coi?.certHolderAddress) add("Moderate", "Certificate Holder Address", "Certificate holder address was requested but not confidently detected on the COI.", "Some holders reject COIs when the holder address is missing or incomplete.", `Verify the holder address: "${req.certHolderAddress}".`, "Request");
    else if (!looseMatch(req.certHolderAddress, coi.certHolderAddress)) add("Moderate", "Certificate Holder Address", "Certificate holder address on the COI does not appear to match the request.", "An incorrect address can cause delivery and compliance issues.", `Confirm the address. Request shows: "${req.certHolderAddress}".`, "Request");
  }
  if (req.insuredName) {
    const insuredText = lineScore(coi?.insuredName, coi?.insuredAddress);
    if (!coi?.insuredName) add("Critical", "Insured Name", "No insured name was confidently detected on the COI.", "The named insured must match the account and policy being certified.", `Confirm the insured. Request shows: "${req.insuredName}".`, "COI PDF");
    else if (!looseMatch(req.insuredName, insuredText)) add("Critical", "Insured Name", `COI insured "${coi.insuredName}" does not appear to match requested insured "${req.insuredName}".`, "A mismatched insured may mean the wrong account or entity was certified.", "Verify the correct insured and reissue the COI if needed.", "Request", "Licensed Agent / Account Manager");
  }

  for (const [key, label, parsedFlag] of [["generalLiability", "General Liability", "generalLiabilityPresent"], ["autoLiability", "Auto Liability", "autoLiabilityPresent"], ["umbrella", "Umbrella / Excess", "umbrellaPresent"], ["workersComp", "Workers Compensation", "workersCompPresent"]]) {
    if (det[key] && !coi?.[parsedFlag]) add("Critical", label, `${label} was requested but does not appear to be present on the COI.`, "A missing required coverage line usually means the COI does not satisfy the request.", `Add/verify the ${label} line with policy number, term dates, and limits.`, "Request");
  }

  if (!coi?.hasPolicyNumber) add("Critical", "Policy Number", "No actual policy number value was detected.", "A blank policy-number area can make the certificate incomplete or unacceptable.", "Confirm policy numbers are populated for every included line of business.", "COI PDF");
  if (!coi?.hasEffectiveDate || !coi?.hasExpirationDate) add("Critical", "Policy Term", "Effective and/or expiration date values were not clearly detected.", "Policy term dates show when the listed policy period applies.", "Confirm both effective and expiration dates appear for each included line.", "COI PDF");
  if (!coi?.hasLimits) add("Critical", "Limits", "No actual coverage limit amounts were detected.", "Requesters rely on limits to compare the certificate against their requirements.", "Confirm limit amounts such as Each Occurrence, Aggregate, CSL, or EL limits are populated.", "COI PDF");

  const endorsementRules = rules.endorsementKeywords || DEFAULT_RULES.endorsementKeywords;
  if (det.additionalInsured && !(coi?.additionalInsuredChecked || hasAny(coi?.description || coiText, endorsementRules.additionalInsured) || /\bAI\b/.test(coi?.description || ""))) add("Critical", "Additional Insured", "Additional Insured was requested but no AI checkbox/indicator or wording was detected.", "AI status is often a contract requirement and must be supported before being shown on the COI.", "Verify endorsement/support first, then mark ADD'L INSD and/or add approved AI wording if appropriate.", "Request", "Licensed Agent / Account Manager if endorsement status is unclear");
  if (det.waiverOfSubrogation && !(coi?.waiverChecked || hasAny(coi?.description || coiText, endorsementRules.waiverOfSubrogation))) add("Critical", "Waiver of Subrogation", "Waiver of Subrogation was requested but no WOS checkbox/indicator or wording was detected.", "A missing waiver may cause the holder to reject the certificate.", "Verify endorsement/support first, then mark SUBR WVD and/or add approved WOS wording if appropriate.", "Request", "Licensed Agent / Account Manager if endorsement status is unclear");
  if (det.primaryNonContributory && !hasAny(coi?.description || coiText, endorsementRules.primaryNonContributory)) add("Critical", "Primary & Non-Contributory", "Primary & Non-Contributory wording was requested but not detected in the Description of Operations.", "PNC wording is often a contractual requirement and must be supported before being shown.", "Add approved P&NC wording only if supported by the policy/endorsement.", "Request", "Licensed Agent / Account Manager if support is unclear");
  if (det.completedOperations && !hasAny(coi?.description || coiText, endorsementRules.completedOperations)) add("Moderate", "Completed Operations", "Completed Operations was requested but the wording was not detected.", "Some contracts require ongoing and completed operations wording.", "Confirm support and add approved wording if required.", "Request");

  if (req.specialWording && !looseMatch(coi?.description || coiText, req.specialWording)) add("Critical", "Special Wording", "Requested special wording does not appear to match the Description of Operations.", "Specific wording is frequently required for certificate acceptance.", `Add/verify the requested wording only if supported: "${req.specialWording}".`, "Request");
  if (req.projectName && !looseMatch(coi?.description || coiText, req.projectName)) add("Moderate", "Project / Job Reference", `Project reference "${req.projectName}" was not detected in the Description of Operations.`, "Many holders require the project named so the COI is tied to the correct job.", `Add "RE: ${req.projectName}" to the Description of Operations if appropriate.`, "Request");
  if (coi?.certHolderName && coi?.description && looseMatch(coi.description, coi.certHolderName)) add("Minor", "Certificate Holder Placement", "Certificate holder name also appears in the Description of Operations.", "This is not always wrong, but the holder should be clearly shown in the CERTIFICATE HOLDER box.", "Confirm the holder is in the correct box and remove duplicate wording if unintended.", "Rule");
  if (!coi?.hasAuthorizedRep) add("Moderate", "Authorized Representative", "No actual authorized representative signature/value was detected.", "Some generated PDFs have image signatures that text extraction cannot read, so this should be manually verified.", "Visually confirm the Authorized Representative area before sending.", "COI PDF");
  if (!coi?.dateIssued) add("Moderate", "Date Issued", "No issue date was detected on the COI.", "The issue date establishes when the certificate was produced.", "Confirm the DATE (MM/DD/YYYY) field is populated.", "COI PDF");
  if (!coi?.hasNaic) add("Moderate", "NAIC Number", "No actual NAIC number was detected for the insurer(s).", "Some holders use NAIC numbers to verify the listed carrier.", "Confirm NAIC # is populated for each insurer used.", "COI PDF");
  if (det.cancellationNotice && !hasAny(coiText, ["cancellation", "notice"])) add("Moderate", "Cancellation Notice", "Cancellation notice wording was requested but the standard cancellation block was not detected.", "Holders sometimes ask for specific notice terms, but VAs should not promise notice beyond policy terms.", "Confirm the cancellation block is present and escalate if specific notice language is requested.", "Request", "Licensed Agent / Account Manager if specific notice terms are requested");
  if (!coi?.coverageRows?.length || !coi?.rawLines?.length) add("Moderate", "PDF Extraction Confidence", "The PDF text extraction did not capture clear coverage rows.", "Some COI PDFs flatten layout or use scanned images, which can make automated checking less reliable.", "Visually compare the COI against the request or upload a clearer text-based PDF.", "COI PDF");

  add("Info", "Escalation Reminder", "Endorsement status must be verified on the policy, not assumed from the request.", "Adding AI/WOS/PNC wording without support can misrepresent the certificate.", "If endorsement status is unclear, escalate before sending.", "Rule");
  add("Info", "Compliance Reminder", rules.disclaimer || DEFAULT_RULES.disclaimer, "This tool supports QC and training; it does not make coverage decisions.", "A licensed professional owns the final decision.", "Rule");
  return { findings };
}

function parseRequestFields(combinedText = "", form = {}) {
  const raw = (combinedText || "").replace(/\r/g, "\n");
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const certBlock = getBlockAfterLabel(lines, [/certificate\s*holder/i, /cert\.?\s*holder/i, /^holder$/i]);
  const holderName = certBlock[0] || getLabeledValue(raw, ["certificate holder", "cert holder", "holder"]);
  const holderAddress = certBlock.slice(1, 4).join(" ") || getAddressNear(raw, holderName);
  return {
    requestFrom: getLabeledValue(raw, ["request from", "requested by", "from"]),
    insuredName: getLabeledValue(raw, ["insured", "named insured", "customer", "account"]) || findAfterPhrase(raw, [/issue\s+(?:a\s+)?coi\s+(?:for|to)\s+([^\n.]+)/i, /certificate\s+(?:for|to)\s+([^\n.]+)/i]),
    certHolderName: holderName,
    certHolderAddress: holderAddress,
    projectName: getLabeledValue(raw, ["project", "job", "re"]),
    dueDate: getLabeledValue(raw, ["due date", "needed by", "deadline"]),
    specialWording: getLabeledValue(raw, ["special wording", "description", "description of operations", "wording"]),
    deliveryInstructions: getLabeledValue(raw, ["send to", "delivery", "email to"]),
  };
}
function getLabeledValue(text, labels) {
  for (const label of labels) {
    const re = new RegExp(`${escapeRegExp(label)}\\s*[:\-]\\s*([^\n]+)`, "i");
    const match = text.match(re);
    if (match?.[1]) return cleanCaptured(match[1]);
  }
  return "";
}
function getBlockAfterLabel(lines, patterns) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matched = patterns.some((p) => p.test(line));
    if (!matched) continue;
    const afterColon = line.includes(":") ? line.split(":").slice(1).join(":").trim() : "";
    const block = [];
    if (afterColon) block.push(afterColon);
    for (const next of lines.slice(i + 1, i + 5)) {
      if (/^(insured|project|job|coverage|required|special|description|delivery|due|please|include)\b/i.test(next)) break;
      block.push(next);
    }
    return block.map(cleanCaptured).filter(Boolean);
  }
  return [];
}
function findAfterPhrase(text, patterns) {
  for (const p of patterns) {
    const match = text.match(p);
    if (match?.[1]) return cleanCaptured(match[1]);
  }
  return "";
}
function getAddressNear(text, holderName) {
  if (!holderName) return "";
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const idx = lines.findIndex((line) => looseMatch(line, holderName));
  if (idx < 0) return "";
  const addressLines = [];
  for (const line of lines.slice(idx + 1, idx + 4)) {
    if (/^(insured|project|job|coverage|required|special|description|delivery|due|please|include)\b/i.test(line)) break;
    addressLines.push(cleanCaptured(line));
  }
  return addressLines.join(" ");
}
function cleanCaptured(value) {
  return (value || "").replace(/^[\-–—\s]+|[\s.;]+$/g, "").replace(/\s+/g, " ").trim();
}
