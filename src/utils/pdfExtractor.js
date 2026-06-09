// ===========================================================================
// pdfExtractor.js
// ---------------------------------------------------------------------------
// Reads completed ACORD 25 PDFs in the browser and extracts field-level data.
// The parser is conservative: it preserves line structure and avoids counting
// printed ACORD labels as populated values.
// ===========================================================================

import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const DATE_RE = /\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:\d{2}|\d{4})\b/g;
const MONEY_RE = /\$\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})+\b/g;
const LABEL_NOISE = [
  "producer", "insured", "insurer", "insurer(s) affording coverage", "naic",
  "certificate holder", "cancellation", "authorized representative", "description of operations",
  "locations / vehicles", "acord 25", "coverages", "policy number", "policy eff",
  "policy exp", "type of insurance", "limits", "this certificate is issued", "should any of the above"
];

export async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item) => (item.str || "").trim())
      .map((item) => {
        const tx = item.transform || [1, 0, 0, 1, 0, 0];
        return { text: item.str.trim(), x: Number(tx[4] || 0), y: Number(tx[5] || 0) };
      });
    pages.push(groupTextItemsIntoLines(items).join("\n"));
  }
  return pages.join("\n--- PAGE BREAK ---\n").trim();
}

function groupTextItemsIntoLines(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  const yTolerance = 3.5;
  for (const item of sorted) {
    let row = rows.find((r) => Math.abs(r.y - item.y) <= yTolerance);
    if (!row) {
      row = { y: item.y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export async function extractTextWithOcr(file, onProgress) {
  try {
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker("eng", 1, {
      logger: (m) => {
        if (onProgress && m.status === "recognizing text") onProgress(Math.round((m.progress || 0) * 100));
      },
    });
    const { data } = await worker.recognize(file);
    await worker.terminate();
    return (data.text || "").replace(/\s+/g, " ").trim();
  } catch (err) {
    console.error("OCR unavailable:", err);
    throw new Error("OCR mode is not available in this browser/build. Paste the request text manually or upload a text-based PDF.");
  }
}

export function parseAcord25(rawText) {
  const text = normalizeText(rawText);
  const lines = text.split(/\n+/).map((line) => cleanLine(line)).filter(Boolean);
  const lower = text.toLowerCase();
  const dates = getUniqueMatches(text, DATE_RE);
  const dollarAmounts = getUniqueMatches(text, MONEY_RE);

  const producerBlock = getBlock(lines, ["producer"], ["insured", "insurer(s)", "insurer a", "coverages"]);
  const insuredBlock = getBlock(lines, ["insured"], ["insurer(s)", "insurer a", "coverages", "type of insurance"]);
  const descriptionBlock = getBlock(lines, ["description of operations", "description of operations / locations", "remarks"], ["certificate holder", "cancellation", "authorized representative", "acord 25"]);
  const certHolderBlock = getCertificateHolderBlock(lines);

  const policyNumbers = extractPolicyNumbers(text);
  const coverageRows = extractCoverageRows(lines);
  const issueDate = findIssueDate(lines, dates);
  const actualPolicyDates = dates.filter((date) => date !== issueDate);
  const additionalInsuredIndicators = detectAdditionalInsured(lines, text);
  const waiverIndicators = detectWaiver(lines, text);
  const naicNumbers = extractNaicNumbers(lines, text);

  return {
    rawText: text,
    rawLines: lines,
    dateIssued: issueDate,
    producerName: firstMeaningfulValue(producerBlock),
    producerAddress: producerBlock.join(" "),
    insuredName: firstMeaningfulValue(insuredBlock),
    insuredAddress: insuredBlock.join(" "),
    certHolderName: firstMeaningfulValue(certHolderBlock),
    certHolderAddress: certHolderBlock.join(" "),
    description: descriptionBlock.join(" "),
    insurerNames: extractInsurers(lines),
    naicNumbers,
    policyNumbers,
    coverageRows,
    dates,
    dollarAmounts,
    hasPolicyNumber: policyNumbers.length > 0 || coverageRows.some((r) => r.policyNumber),
    hasEffectiveDate: actualPolicyDates.length >= 1 || coverageRows.some((r) => r.effectiveDate),
    hasExpirationDate: actualPolicyDates.length >= 2 || coverageRows.some((r) => r.expirationDate),
    hasLimits: dollarAmounts.length > 0 || coverageRows.some((r) => r.limits.length > 0),
    hasNaic: naicNumbers.length > 0,
    hasAuthorizedRep: detectSignature(lines, text),
    generalLiabilityPresent: detectCoverageLine(lower, "generalLiability"),
    autoLiabilityPresent: detectCoverageLine(lower, "autoLiability"),
    umbrellaPresent: detectCoverageLine(lower, "umbrella"),
    workersCompPresent: detectCoverageLine(lower, "workersComp"),
    additionalInsuredChecked: additionalInsuredIndicators.detected,
    additionalInsuredEvidence: additionalInsuredIndicators.evidence,
    waiverChecked: waiverIndicators.detected,
    waiverEvidence: waiverIndicators.evidence,
  };
}

export async function readAndParseCoi(file, { useOcr = false, onProgress } = {}) {
  const rawText = useOcr ? await extractTextWithOcr(file, onProgress) : await extractTextFromPdf(file);
  const cleaned = (rawText || "").trim();
  if (!cleaned || cleaned.length < 25) {
    return { ok: false, reason: "We could not read usable text from this PDF. Please upload a clearer text-based PDF or use OCR mode.", fields: null, rawText: "" };
  }
  return { ok: true, fields: parseAcord25(cleaned), rawText: cleaned };
}

function normalizeText(value) {
  return (value || "").replace(/\r/g, "\n").replace(/[\t\u00a0]+/g, " ").replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
function cleanLine(line) {
  return (line || "").replace(/\s+/g, " ").replace(/^[:\-\s]+|[:\-\s]+$/g, "").trim();
}
function getUniqueMatches(text, regex) {
  const found = [];
  for (const match of text.matchAll(regex)) {
    const value = match[0].replace(/\s+/g, " ").trim();
    if (!found.includes(value)) found.push(value);
  }
  return found;
}
function getBlock(lines, startMarkers, endMarkers) {
  const start = findLineIndex(lines, startMarkers);
  if (start < 0) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lineHasMarker(lines[i], endMarkers)) { end = i; break; }
  }
  return lines.slice(start + 1, end).filter(isMeaningfulDataLine);
}
function getCertificateHolderBlock(lines) {
  const start = findLastLineIndex(lines, ["certificate holder"]);
  if (start < 0) return [];
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lineHasMarker(lines[i], ["cancellation", "authorized representative", "acord 25", "©", "all rights reserved"])) { end = i; break; }
  }
  return lines.slice(start + 1, end).filter(isMeaningfulDataLine);
}
function findLineIndex(lines, markers) { return lines.findIndex((line) => lineHasMarker(line, markers)); }
function findLastLineIndex(lines, markers) { for (let i = lines.length - 1; i >= 0; i--) if (lineHasMarker(lines[i], markers)) return i; return -1; }
function lineHasMarker(line, markers) { const value = line.toLowerCase(); return markers.some((marker) => value.includes(marker.toLowerCase())); }
function isMeaningfulDataLine(line) {
  const value = cleanLine(line); if (!value) return false;
  const lower = value.toLowerCase();
  if (value.length <= 1 || /^[-_]+$/.test(value)) return false;
  if (LABEL_NOISE.some((label) => lower === label || lower.startsWith(`${label}:`))) return false;
  if (/^\(?mm\/dd\/yyyy\)?$/i.test(value) || /^(y|n|x)$/i.test(value)) return false;
  return true;
}
function firstMeaningfulValue(block) {
  return (block || []).find((line) => {
    const cleaned = cleanLine(line); if (!cleaned) return false;
    if (/\b(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:\d{2}|\d{4})\b/.test(cleaned)) return false;
    if (/^\d{3,6}$/.test(cleaned)) return false;
    return true;
  }) || "";
}
function findIssueDate(lines, dates) {
  for (const line of lines) {
    if (/\bdate\b/i.test(line) && /mm\/dd\/yyyy/i.test(line)) {
      const match = line.match(DATE_RE); if (match?.[0]) return match[0];
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (/\bdate\b/i.test(lines[i]) && /mm\/dd\/yyyy/i.test(lines[i])) {
      const next = lines[i + 1]?.match(DATE_RE); if (next?.[0]) return next[0];
    }
  }
  return dates[0] || "";
}
function extractPolicyNumbers(text) {
  const matches = getUniqueMatches(text, /\b(?=[A-Z0-9-]{6,}\b)(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g);
  const blocked = new Set(["ACORD25", "CERTIFICATE", "COMMERCIAL", "GENERAL", "LIABILITY"]);
  return matches.filter((value) => {
    const upper = value.toUpperCase();
    if (blocked.has(upper)) return false;
    if (/^CG\d{4,}$/i.test(value) || /^\d{1,2}-\d{1,2}-\d{2,4}$/.test(value) || /^NAIC\d+/i.test(value)) return false;
    return true;
  });
}
function extractCoverageRows(lines) {
  return lines.filter((line) => /liability|umbrella|excess|workers|compensation|employers/i.test(line)).map((line) => {
    const dates = getUniqueMatches(line, DATE_RE); const limits = getUniqueMatches(line, MONEY_RE); const policyNumbers = extractPolicyNumbers(line);
    return { raw: line, policyNumber: policyNumbers[0] || "", effectiveDate: dates[0] || "", expirationDate: dates[1] || "", limits };
  });
}
function extractNaicNumbers(lines, text) {
  const values = [];
  for (const line of lines) {
    const match = line.match(/\bNAIC\s*#?\s*(\d{3,6})\b/i);
    if (match?.[1] && !values.includes(match[1])) values.push(match[1]);
  }
  const naicLabelIndex = findLineIndex(lines, ["naic"]);
  if (naicLabelIndex >= 0) {
    for (const line of lines.slice(naicLabelIndex, naicLabelIndex + 8)) {
      for (const m of line.matchAll(/\b\d{5}\b/g)) if (!values.includes(m[0])) values.push(m[0]);
    }
  }
  if (!values.length) for (const m of text.matchAll(/\bNAIC\s*#?\s*(\d{3,6})\b/gi)) if (!values.includes(m[1])) values.push(m[1]);
  return values;
}
function extractInsurers(lines) {
  const insurers = [];
  for (const line of lines) {
    const match = line.match(/insurer\s*[a-f]\s*:?\s*(.+?)(?:\s+\d{5})?$/i);
    if (match?.[1]) { const value = cleanLine(match[1]); if (value && isMeaningfulDataLine(value)) insurers.push(value); }
  }
  return insurers;
}
function detectCoverageLine(lowerText, type) {
  const map = {
    generalLiability: ["commercial general liability", "general liability", "cgl", "each occurrence"],
    autoLiability: ["automobile liability", "auto liability", "any auto", "owned autos", "hired autos", "non-owned autos"],
    umbrella: ["umbrella liab", "excess liab", "umbrella", "excess liability"],
    workersComp: ["workers compensation", "workers' compensation", "employers liability", "e.l. each accident", "wc statutory"],
  };
  return map[type].some((keyword) => lowerText.includes(keyword));
}
function detectAdditionalInsured(lines, text) {
  const evidence = [];
  if (/\badditional\s+insured\b/i.test(text) || /add'?l\s+insured/i.test(text)) evidence.push("Additional Insured wording found");
  if (/\bCG\s*20\s*10\b/i.test(text) || /\bCG\s*20\s*37\b/i.test(text)) evidence.push("AI endorsement form reference found");
  for (const line of lines.filter((line) => /add'?l\s+insd|additional\s+insured/i.test(line))) {
    if (/\b(X|Y|YES)\b/i.test(line)) evidence.push(`AI indicator near checkbox: ${line}`);
  }
  const labelOnly = /add'?l\s+insd/i.test(text.toLowerCase()) && evidence.length === 0;
  return { detected: evidence.length > 0 && !labelOnly, evidence };
}
function detectWaiver(lines, text) {
  const evidence = [];
  if (/\bwaiver\s+of\s+subrogation\b/i.test(text)) evidence.push("Waiver of Subrogation wording found");
  if (/\bsubrogation\s+waived\b/i.test(text)) evidence.push("Subrogation waived wording found");
  for (const line of lines.filter((line) => /subr\s+wvd|waiver\s+of\s+subrogation/i.test(line))) {
    if (/\b(X|Y|YES)\b/i.test(line)) evidence.push(`WOS indicator near checkbox: ${line}`);
  }
  const labelOnly = /subr\s+wvd/i.test(text.toLowerCase()) && evidence.length === 0;
  return { detected: evidence.length > 0 && !labelOnly, evidence };
}
function detectSignature(lines, text) {
  const authIndex = findLineIndex(lines, ["authorized representative"]);
  if (authIndex >= 0) {
    const nearby = lines.slice(Math.max(0, authIndex - 3), authIndex + 4).filter(isMeaningfulDataLine);
    if (nearby.some((line) => !/authorized representative|©|acord/i.test(line) && (/[A-Za-z]{3,}/.test(line) || /\/s\//i.test(line) || /signature/i.test(line)))) return true;
  }
  return /\/s\/\s*[A-Za-z]/.test(text);
}
