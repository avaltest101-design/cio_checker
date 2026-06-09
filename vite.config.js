import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite configuration for the LAVA COI AI Checker.
// pdfjs-dist ships an ESM worker that we load with the ?url suffix in
// src/utils/pdfExtractor.js, so no special worker plugin config is required.
export default defineConfig({
  plugins: [react()],
  // tesseract.js is an optional dependency loaded only when the user chooses
  // OCR mode. We exclude it from pre-bundling so the main build stays light
  // and never fails if the optional dep is not installed.
  optimizeDeps: {
    exclude: ["tesseract.js"],
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1500,
  },
});
