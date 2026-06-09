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
