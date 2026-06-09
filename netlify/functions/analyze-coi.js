// ===========================================================================
// netlify/functions/analyze-coi.js
// ---------------------------------------------------------------------------
// Server-side AI endpoint. The frontend POSTs here; the API key NEVER leaves
// the server. If ANTHROPIC_API_KEY is not set, this returns a clear signal so
// the frontend falls back to its built-in mock engine (see src/utils/aiClient.js).
//
// Expected request body (JSON):
//   {
//     analysisType: "request_analysis" | "coi_pdf_check",
//     requestText?: string,        // for request_analysis
//     form?: object,               // RequestAnalyzer form values
//     extractedPdfText?: string,   // for coi_pdf_check
//     findings?: array             // local findings to optionally summarize
//   }
//
// Response (JSON): { analysis } for request_analysis, or { summary } for
// coi_pdf_check.
// ===========================================================================

export async function handler(event) {
  // CORS / method guard
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

  // No key configured -> tell the frontend to use its mock fallback.
  if (!apiKey) {
    return json(200, {
      mock: true,
      message: "ANTHROPIC_API_KEY not set; frontend should use mock analysis.",
    });
  }

  const { analysisType, requestText, form, extractedPdfText, findings } = body;

  // ------------------------------------------------------------------
  // Build the prompt. The system prompt enforces the compliance posture:
  // QC / training only — never confirm, bind, or interpret coverage.
  // ------------------------------------------------------------------
  const system =
    "You are a quality-control assistant for insurance VAs working on ACORD 25 Certificates of Insurance. " +
    "You NEVER confirm coverage, bind coverage, interpret policy language, or replace a licensed professional. " +
    "You only summarize requests, build QC checklists, flag missing information, and recommend escalation. " +
    "Always respond with valid JSON only, no prose, no markdown fences.";

  let userPrompt;
  if (analysisType === "request_analysis") {
    userPrompt =
      "Analyze this COI request and return JSON with keys: summary (string), " +
      "checklist (string[]), missingInfo (string[]), ambiguities (string[]), " +
      "escalations (string[]), suggestedDescription (string), reminders (string[]), " +
      "detected (object of booleans: generalLiability, autoLiability, umbrella, workersComp, " +
      "additionalInsured, waiverOfSubrogation, primaryNonContributory, completedOperations, " +
      "lossPayeeMortgagee, cancellationNotice).\n\n" +
      `Form fields: ${JSON.stringify(form || {})}\n\nRequest text: ${requestText || ""}`;
  } else if (analysisType === "coi_pdf_check") {
    userPrompt =
      "Given these QC findings and extracted ACORD 25 text, return JSON with a key " +
      "'summary' (a short plain-English review summary for a VA). Do not assert coverage exists.\n\n" +
      `Findings: ${JSON.stringify(findings || [])}\n\nExtracted text: ${(extractedPdfText || "").slice(0, 6000)}`;
  } else {
    return json(400, { error: "Unknown analysisType" });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return json(502, { error: "Upstream AI error", detail: text.slice(0, 500) });
    }

    const data = await res.json();
    const textOut = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    // Strip accidental code fences, then parse.
    const clean = textOut.replace(/```json|```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // If the model didn't return clean JSON, hand raw text back as a summary.
      return json(200, { summary: textOut });
    }

    if (analysisType === "request_analysis") {
      return json(200, { analysis: { ...parsed, engine: "claude" } });
    }
    return json(200, { summary: parsed.summary || textOut });
  } catch (err) {
    return json(502, { error: "Request failed", detail: String(err).slice(0, 300) });
  }
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
}
