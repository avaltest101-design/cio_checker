// ===========================================================================
// aiClient.js
// ---------------------------------------------------------------------------
// The frontend NEVER calls the Anthropic API directly and NEVER holds a key.
// It calls the Netlify serverless function at /.netlify/functions/analyze-coi,
// which holds the key server-side (process.env.ANTHROPIC_API_KEY).
//
// If the function is unavailable (e.g. local `npm run dev` with no key, or the
// MVP preview), we transparently fall back to the deterministic mock engine in
// coiRules.js so the app is always usable.
//
// TO CONNECT REAL CLAUDE AI LATER:
//   1. Set ANTHROPIC_API_KEY in the Netlify dashboard (or .env for netlify dev).
//   2. Implement the model call inside netlify/functions/analyze-coi.js
//      (a ready-to-fill placeholder is already there).
//   3. No frontend change is required — this client already prefers the
//      function and only falls back to mock when it is missing.
// ===========================================================================

import { analyzeRequest } from "./coiRules.js";

const FUNCTION_URL = "/.netlify/functions/analyze-coi";

// requestAnalysis: send form + combined text, get structured analysis.
export async function aiAnalyzeRequest({ form, combinedText, rules }) {
  try {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisType: "request_analysis",
        requestText: combinedText,
        form,
      }),
    });
    if (!res.ok) throw new Error(`Function responded ${res.status}`);
    const data = await res.json();
    if (data && data.analysis) {
      return { ...data.analysis, engine: "claude" };
    }
    throw new Error("Function returned no analysis");
  } catch (err) {
    // Expected during MVP / local preview — fall back to the mock engine.
    console.info("Using mock request analysis (serverless function not used):", err.message);
    return analyzeRequest(form, combinedText, rules);
  }
}

// coiPdfCheck: the comparison itself runs locally in coiRules.compareCoi();
// this hook exists so a future version can optionally ask Claude to summarize
// or re-rank findings. For now it returns the local findings unchanged.
export async function aiSummarizeFindings({ findings, extractedText }) {
  try {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisType: "coi_pdf_check",
        extractedPdfText: extractedText,
        findings,
      }),
    });
    if (!res.ok) throw new Error(`Function responded ${res.status}`);
    const data = await res.json();
    return data.summary || null;
  } catch (err) {
    console.info("Skipping AI finding summary (serverless function not used):", err.message);
    return null;
  }
}
