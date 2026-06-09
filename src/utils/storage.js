// ===========================================================================
// storage.js
// ---------------------------------------------------------------------------
// Thin persistence layer for the LAVA COI AI Checker MVP.
//
// For the MVP everything is stored in the browser's localStorage. The function
// signatures below are intentionally async-friendly and centralized so that a
// future upgrade to Supabase only requires changing the body of these helpers,
// not every call site.
//
// SUPABASE UPGRADE NOTES (future):
//   import { createClient } from "@supabase/supabase-js";
//   const supabase = createClient(
//     import.meta.env.VITE_SUPABASE_URL,
//     import.meta.env.VITE_SUPABASE_ANON_KEY
//   );
//   - saveReport()    -> await supabase.from("coi_reports").insert(report)
//   - getReports()    -> await supabase.from("coi_reports").select("*")
//   - saveRequest()   -> await supabase.from("coi_requests").insert(request)
//   Use Row Level Security keyed on the authenticated user / org id.
// ===========================================================================

const KEYS = {
  USER: "lava_coi_user",
  REQUESTS: "lava_coi_requests",
  REPORTS: "lava_coi_reports",
  SETTINGS: "lava_coi_settings",
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`storage: failed to read ${key}`, err);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`storage: failed to write ${key}`, err);
    return false;
  }
}

// ----- Current user -------------------------------------------------------
export function getUser() {
  return read(KEYS.USER, null);
}
export function saveUser(user) {
  return write(KEYS.USER, user);
}
export function clearUser() {
  localStorage.removeItem(KEYS.USER);
}

// ----- Saved COI requests -------------------------------------------------
export function getRequests() {
  return read(KEYS.REQUESTS, []);
}
export function saveRequest(request) {
  const requests = getRequests();
  const existingIndex = requests.findIndex((r) => r.id === request.id);
  if (existingIndex >= 0) {
    requests[existingIndex] = request;
  } else {
    requests.unshift(request);
  }
  write(KEYS.REQUESTS, requests);
  return request;
}
export function getRequestById(id) {
  return getRequests().find((r) => r.id === id) || null;
}

// ----- COI review reports (history) ---------------------------------------
export function getReports() {
  return read(KEYS.REPORTS, []);
}
export function saveReport(report) {
  const reports = getReports();
  const existingIndex = reports.findIndex((r) => r.id === report.id);
  if (existingIndex >= 0) {
    reports[existingIndex] = report;
  } else {
    reports.unshift(report);
  }
  write(KEYS.REPORTS, reports);
  return report;
}
export function getReportById(id) {
  return getReports().find((r) => r.id === id) || null;
}

// ----- Settings / rules ---------------------------------------------------
export function getSettings() {
  return read(KEYS.SETTINGS, null);
}
export function saveSettings(settings) {
  return write(KEYS.SETTINGS, settings);
}

// ----- Utility ------------------------------------------------------------
export function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
