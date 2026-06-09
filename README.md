# LAVA COI AI Checker

A React + Vite training and quality-control tool for insurance VAs, CSRs, and
training staff. It helps you (1) **analyze incoming Certificate of Insurance
requests** and (2) **check completed ACORD 25 COI PDFs** against those requests
before they go out to a client.

> **Compliance notice**
> This AI checker is a training and quality-control tool only. It does not
> confirm coverage, bind coverage, interpret policy language, or replace review
> by a licensed insurance professional.

The app ships with a built-in **mock AI engine**, so it runs and demos fully
offline with no API key. When you're ready, drop in an Anthropic API key on
Netlify and the included serverless function takes over automatically.

---

## What's inside

- **Login** — name / email / role (VA, CSR, Trainer, Team Lead, Manager), stored in `localStorage`.
- **Dashboard** — totals for checked / pending / passed / needs-correction / critical, plus recent history.
- **COI Request Analyzer** — paste text, upload a request PDF/image, or fill the form; produces a plain-English summary, a creation checklist, a missing-info list, escalation warnings, a suggested Description of Operations draft, and a reminder of what a non-licensed VA cannot decide.
- **COI Build Guidance** — 11-step build workflow plus warning cards.
- **Completed COI PDF Checker** — upload the finished ACORD 25 PDF, pick the related saved request, run the comparison engine.
- **Review Report** — score, status, critical-first findings, field-by-field checklist, downloadable `.txt` report, save to history.
- **History** — every past check with score, status, and issue counts.
- **Settings / Rules** — editable endorsement / escalation / Description keywords and disclaimer wording (read-only for VA/CSR roles).

---

## 1. Setup instructions

**Requirements:** Node 18+ (built and tested on Node 22) and npm.

```bash
# from the project root
npm install      # install dependencies
npm run dev      # start the dev server (usually http://localhost:5173)
npm run build    # produce a production build in dist/
npm run preview  # preview the production build locally
```

The MVP needs **no backend and no API key** — it uses the mock AI engine and
`localStorage`. Just `npm install` then `npm run dev`.

---

## 2. Netlify deployment instructions

This repo is Netlify-ready (`netlify.toml` is included).

**Option A — Git-based (recommended)**
1. Push this project to a GitHub/GitLab repo.
2. In Netlify: **Add new site → Import an existing project** and pick the repo.
3. Netlify reads `netlify.toml` automatically:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
   - SPA redirect (all routes → `index.html`) is already configured.
4. Deploy.

**Option B — Netlify CLI**
```bash
npm install -g netlify-cli
netlify deploy --build         # draft URL
netlify deploy --build --prod  # production
```

The serverless function deploys automatically at
`/.netlify/functions/analyze-coi`. With no API key set it returns a
`{ mock: true }` response and the app falls back to the local engine, so the
deployed site works immediately even before you add a key.

---

## 3. Environment variable instructions

No key is committed anywhere, and the **frontend never reads the key** — only
the serverless function does (`process.env.ANTHROPIC_API_KEY`).

**Local dev (optional):** copy `.env.example` to `.env` and fill in:
```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-sonnet-4-20250514   # optional override
```

**On Netlify:** Site → **Settings → Environment variables**, add:
- `ANTHROPIC_API_KEY` — your real key (required for live AI)
- `ANTHROPIC_MODEL` — optional; defaults to `claude-sonnet-4-20250514`

Redeploy after adding variables so the function picks them up.

---

## 4. How to test the app

1. `npm run dev` and open the local URL.
2. **Log in** with any name/email and a role (try `Trainer` to get edit rights on the Settings page).
3. **Request Analyzer:** click **Load example** (or paste a request) and **Analyze Request**. Try each of the three samples — the third (lender / mortgagee) is designed to trigger an escalation warning.
4. Click **Save Request**, then **Continue to COI Build Guidance** to see the step-by-step build flow.
5. **PDF Checker:** upload any ACORD 25 PDF, select the saved request, and **Run COI Check**.
   - For a scanned image-only PDF you'll see the "could not read text… use OCR mode" message; toggle **OCR mode** to attempt `tesseract.js` extraction.
6. **Review Report:** confirm the score, status, critical-first findings, and field checklist. Use **Download report** and **Save to history**.
7. **History / Dashboard:** confirm the saved report appears and the dashboard counters update.

Everything above works on the mock engine — no key needed.

---

## 5. How to connect the real Claude API later

The wiring is already done; you only add a key.

1. Add `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in Netlify env vars (see §3).
2. Redeploy.

How it flows:
- The frontend (`src/utils/aiClient.js`) always calls the serverless function at `/.netlify/functions/analyze-coi`, never the Anthropic API directly.
- `netlify/functions/analyze-coi.js` checks for `ANTHROPIC_API_KEY`. If absent it returns `{ mock: true }` and the frontend uses the local engine in `src/utils/coiRules.js`. If present it calls `https://api.anthropic.com/v1/messages` with a compliance-enforcing system prompt and returns structured JSON.
- To customize the AI behavior, edit the system prompt and JSON shape in `netlify/functions/analyze-coi.js`. To run AI locally too, use `netlify dev` (which serves functions) instead of `npm run dev`.

No frontend changes are required to go live.

---

## 6. COI checking rules included

The comparison engine (`src/utils/coiRules.js`) runs these 17 checks, each
returning a finding with **severity, field, issue, why it matters, suggested
correction, source, and an escalation recommendation**:

1. Certificate holder name matches the request
2. Certificate holder address matches the request
3. Insured name matches the request
4. Required coverage lines are present (GL / Auto / Umbrella / WC as requested)
5. Policy numbers are present
6. Effective dates are present
7. Expiration dates are present
8. Limits are present
9. Additional Insured wording/checkbox present when requested
10. Waiver of Subrogation wording/checkbox present when requested
11. Primary & Non-Contributory wording present in the Description when requested
12. Special wording present in the Description when requested
13. Project/job reference present in the Description when requested
14. Certificate holder appears in the correct section
15. Authorized representative present
16. COI issue date present
17. Possible typos / mismatches between request and COI

**Severity model**
- **Critical** — wrong cert holder/insured, missing required coverage line, missing requested AI / WOS / PNC wording, wrong or missing policy term, wrong limits, missing required special wording.
- **Moderate** — address mismatch, incomplete project description, missing delivery instruction, unclear endorsement status, missing NAIC, missing producer contact.
- **Minor** — formatting, spacing, typos, capitalization, missing phone number.
- **Info** — escalation, training, and best-practice reminders.

**Scoring → status**
- 95–100 → **Passed** → "Ready to Send"
- 80–94 → **Needs Review** → "Correct Before Sending"
- 60–79 → **Needs Correction** → "Correct Before Sending"
- below 60 → **Critical Error / Escalate** → "Escalate to Licensed Agent / Trainer / Team Lead"

**Default endorsement keywords** (editable in Settings):
- *Additional Insured:* additional insured, AI, CG 20 10, CG 20 37
- *Waiver of Subrogation:* waiver of subrogation, WOS, subrogation waived
- *Primary & Non-Contributory:* primary and non-contributory, primary & non-contributory, PNC
- *Completed Operations:* completed operations, ongoing and completed operations
- *Loss Payee / Mortgagee:* loss payee, lender's loss payable, mortgagee

The report never asserts the COI is legally correct — only whether it appears to
match the uploaded request and checklist.

---

## Project structure

```
src/
  App.jsx, main.jsx, styles.css
  data/      mockRequests.js, mockReports.js
  utils/     coiRules.js, pdfExtractor.js, storage.js, scoring.js, aiClient.js
  components/ Sidebar, Header, StatusBadge, UploadBox, FindingCard,
             ChecklistItem, ReportSummary, Disclaimer
  pages/     Login, Dashboard, RequestAnalyzer, BuildGuidance,
             PdfChecker, ReviewReport, History, Settings
netlify/
  functions/ analyze-coi.js
```

## Upgrading to Supabase (future)

History and requests currently live in `localStorage` via `src/utils/storage.js`,
which contains inline comments marking exactly where to swap in Supabase calls
(tables for `requests` and `reports`). The UI already reads/writes through that
single module, so the migration is isolated to one file plus the serverless layer.

## Tech notes

- State-based navigation via a small React Context (no router) keeps Netlify
  deploys trivial; the SPA redirect in `netlify.toml` covers direct hits anyway.
- PDF text extraction uses `pdfjs-dist`; OCR uses `tesseract.js` (optional dependency, loaded only when OCR mode is used).
