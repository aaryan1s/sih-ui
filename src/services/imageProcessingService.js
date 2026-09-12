/**
 * imageProcessingService — IMAGE PROCESSING / CV STAGE boundary.
 *
 * Pipeline position (per the approved architecture):
 *
 *   PRODUCT IMAGE
 *     → imageProcessingService  ← this module
 *     → ocr / extraction        (extractionService — UNTOUCHED)
 *     → compliance engine       (complianceService)
 *     → inspector review
 *
 * STATUS: NOT IMPLEMENTED — PIPELINE READY.
 * The current implementation is an honest pass-through: it returns the
 * original image unchanged and reports `performed: false`. No CV results are
 * fabricated. A future implementation (deskew, crop, contrast normalization,
 * text-region detection) replaces the body of `prepare()` and — because the
 * contract returns the same shape — requires NO changes to the wizard,
 * extraction service, compliance engine, evidence, persistence or reports.
 *
 * Contract (stable):
 *   prepare({ source, onStage }) → Promise<{
 *     source:      same reference/type passed in (Blob | data URL),
 *     performed:   boolean  — false means pass-through (no CV yet),
 *     notes:       string[] — human-readable stage notes for the UI,
 *   }>
 */

export const CV_STATUS = 'NOT IMPLEMENTED — PIPELINE READY';

export const imageProcessingService = {
  /**
   * Image-processing stage. Currently a pass-through that validates the
   * source exists and forwards it unchanged.
   */
  async prepare({ source, onStage } = {}) {
    if (!source) {
      throw new Error('No image source provided to the processing stage.');
    }
    onStage?.('processing');
    // Future CV implementation replaces everything between here and the
    // return — the returned contract must stay identical.
    return {
      source, // forwarded UNCHANGED to the OCR stage
      performed: false,
      notes: ['Image forwarded unchanged — CV preprocessing not yet implemented.'],
    };
  },
};
