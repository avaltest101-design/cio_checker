// ===========================================================================
// pdfExtractor.js
// ---------------------------------------------------------------------------
// Reads a completed ACORD 25 PDF in the browser using pdfjs-dist, then runs
// heuristic parsing to pull out the fields the comparison engine needs.
//
// ACORD 25 layouts vary by management system, so parsing is best-effort and
// deliberately conservative: when a field cannot be confidently located we
// leave it blank / false and the comparison engine flags it. This keeps the
// tool honest rather than inventing data.
//
// OCR: scanned (image-only) PDFs and screenshots contain no extractable text.
// extractTextWithOcr() lazily loads the OPTIONAL tesseract.js dependency so
// the main bundle never depends on it. If tesseract.js is not installed the
// caller receives a clear message instead of a crash.
// ===========================================================================

import * as pdfjsLib from "pdfjs-dist";
// Vite resolves this to a URL string for the worker file.
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// ---------------------------------------------------------------------------
// Raw text extraction from a PDF File/Blob.
// ---------------------------------------------------------------------------
export async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n";
  }
  return fullText.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// OCR placeholder for scanned PDFs / screenshots (optional tesseract.js).
// ---------------------------------------------------------------------------
export async function extractTextWithOcr(file, onProgress) {
  try {
    // Dynamic import keeps tesseract.js out of the main bundle.
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker("eng", 1, {
      logger: (m) => {
        if (onProgress && m.status === "recognizing text") {
          onProgress(Math.round((m.progress || 0) * 100));
        }
      },
    });
    const { data } = await worker.recognize(file);
    await worker.terminate();
    return (data.text || "").replace(/\s+/g, " ").trim();
  } catch (err) {
    console.error("OCR unavailable:", err);
    throw new Error(
      "OCR mode is not available. Install the optional dependency with `npm install tesseract.js`, then retry."
    );
  }
}

// ---------------------------------------------------------------------------
// Heuristic field parsing from extracted ACORD 25 text.
// ---------------------------------------------------------------------------
const DATE_RE = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g;

function findFirst(text, regex) {
  const m = text.match(regex);
  return m ? m[1].trim() : "";
}

// Pull the chunk of text that follows a label, up to the next known label.
function sliceBetween(text, startLabels, endLabels) {
  const lower = text.toLowerCase();
  let start = -1;
  for (const label of startLabels) {
    const idx = lower.indexOf(label.toLowerCase());
    if (idx >= 0) {
      start = idx + label.length;
      break;
    }
  }
  if (start < 0) return "";
  let end = text.length;
  for (const label of endLabels) {
    const idx = lower.indexOf(label.toLowerCase(), start);
    if (idx >= 0 && idx < end) end = idx;
  }
  return text.slice(start, end).trim();
}

export function parseAcord25(rawText) {
  const text = rawText || "";
  const lower = text.toLowerCase();

  const dates = text.match(DATE_RE) || [];

  // Description of Operations block (the most-used free-text area).
  const description = sliceBetween(
    text,
    ["description of operations"],
    ["certificate holder", "cancellation", "should any of the above"]
  );

  // Certificate holder block.
  const certHolderBlock = sliceBetween(
    text,
    ["certificate holder"],
    ["authorized representative", "acord 25", "should any of the above"]
  );

  // Insured block (between INSURED and INSURER label region).
  const insuredBlock = sliceBetween(
    text,
    ["insured"],
    ["insurer a", "insurer(s) affording", "coverages"]
  );

  // Producer block.
  const producerBlock = sliceBetween(text, ["producer"], ["insured"]);

  // First line of a block is usually the name; the rest is the address.
  const firstLine = (block) => (block || "").split(/\s{2,}|,/)[0].trim();

  return {
    rawText: text,

    dateIssued: findFirst(text, /date\s*\(mm\/dd\/yyyy\)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i) ||
      (dates[0] || ""),

    producerName: firstLine(producerBlock),
    insuredName: firstLine(insuredBlock),
    insuredAddress: insuredBlock,

    certHolderName: firstLine(certHolderBlock),
    certHolderAddress: certHolderBlock,

    description,

    // Presence flags used by the comparison engine.
    hasPolicyNumber: /policy\s*(number|no|#)|[A-Z]{2,}\d{4,}/i.test(text),
    hasEffectiveDate: /eff|effective/i.test(lower) || dates.length >= 1,
    hasExpirationDate: /exp|expiration/i.test(lower) || dates.length >= 2,
    hasLimits: /each occurrence|aggregate|\$?\s?[\d,]{4,}/i.test(text),
    hasNaic: /naic\s*#?\s*\d{3,}/i.test(text),
    hasAuthorizedRep: /authorized representative/i.test(lower),

    // Checkbox detection is unreliable from text alone; ACORD prints "Y"/"N"
    // columns for ADD'L INSD and SUBR WVD. We look for affirmative markers.
    additionalInsuredChecked:
      /add'?l\s*insd[^a-z]{0,6}\b(y|x)\b/i.test(text) || /additional insured/i.test(lower),
    waiverChecked:
      /subr\s*wvd[^a-z]{0,6}\b(y|x)\b/i.test(text) || /waiver of subrogation/i.test(lower),

    // Carrier identifiers (best-effort).
    naicNumbers: (text.match(/naic\s*#?\s*(\d{3,6})/gi) || []).map((s) =>
      s.replace(/[^\d]/g, "")
    ),
  };
}

// Convenience: extract + parse in one call.
export async function readAndParseCoi(file, { useOcr = false, onProgress } = {}) {
  let rawText = "";
  if (useOcr) {
    rawText = await extractTextWithOcr(file, onProgress);
  } else {
    rawText = await extractTextFromPdf(file);
  }
  const cleaned = (rawText || "").trim();
  if (!cleaned) {
    return {
      ok: false,
      reason:
        "We could not read text from this PDF. Please upload a clearer PDF or use OCR mode.",
      fields: null,
      rawText: "",
    };
  }
  return { ok: true, fields: parseAcord25(cleaned), rawText: cleaned };
}
