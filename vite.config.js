import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { ocrServicePlugin } from './scripts/ocrService.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Starts the local PaddleOCR service with the dev server (and stops it
    // with it) so the analysis pipeline can never be "unreachable" because
    // a separate service launch step was forgotten. No-ops when
    // VITE_OCR_ENDPOINT is not a local endpoint (tesseract-browser fallback).
    ocrServicePlugin(),
    react(),
  ],
})
