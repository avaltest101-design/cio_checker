# LAVA COI AI Checker - Upgrade Notes

## What was upgraded

- Rebuilt ACORD 25 PDF extraction to preserve visual line structure using pdfjs item coordinates.
- Improved parser so it does not count blank ACORD labels as populated values.
- Added actual-value detection for policy numbers, dates, limits, NAIC values, coverage rows, certificate holder, insured, Description of Operations, AI indicators, WOS indicators, and authorized representative.
- Removed the unsafe bare `ai` keyword from default Additional Insured matching and added safer word-boundary handling.
- Added settings migration in `App.jsx` to remove older saved `ai` keyword values from localStorage.
- Upgraded COI comparison rules to be more conservative. If extraction is unclear, the app flags Needs Review instead of passing.
- Added clearer findings for PDF extraction confidence.
- Fixed the possible React hook-order issue in `ReviewReport.jsx`.
- Expanded the field-by-field review checklist to show extracted policy numbers, limit values, NAIC values, and detected coverage lines.

## Build verification

The upgraded app was tested with:

```bash
npm ci
npm run build
```

Both completed successfully.

## Important note

This app is still a quality-control and training assistant. It does not confirm coverage, bind coverage, interpret policy language, or replace review by a licensed insurance professional.

## Guided Workflow Upgrade — Request → Instructions → PDF Check

This upgrade improves the VA workflow after the client request is pasted into the COI Request Analyzer.

### What changed
- Added a clear 4-step workflow indicator:
  1. Paste request
  2. Follow instructions
  3. Upload completed COI
  4. Review corrections
- Renamed and emphasized the main input as **Paste Client COI Request / Instructions Here**.
- Added a stronger instruction panel after analysis:
  - Client request summary
  - VA action plan
  - COI creation checklist
  - Missing information/questions
  - Escalation warnings
  - Suggested Description of Operations wording
- Added a primary **Continue → Upload Completed COI PDF** button directly after the instructions.
- The app now saves/links the analyzed request before moving to the Completed COI PDF Checker.
- The Completed COI PDF Checker now requires linked client instructions before scanning, so the comparison is not just a generic presence check.
- Added a client request summary panel on the PDF checker page so the VA can confirm what the PDF is being compared against.
- Added a detailed **Client Request Match Summary** table in the final report.
- Added PDF extraction confidence to help VAs know when visual review is needed.
- Improved request text parsing so pasted client emails can automatically capture likely insured name, certificate holder, holder address, project/job reference, special wording, and due date.

### Important behavior
The checker remains conservative. If text extraction is unclear, it flags Needs Review or Critical issues rather than incorrectly passing the COI.
