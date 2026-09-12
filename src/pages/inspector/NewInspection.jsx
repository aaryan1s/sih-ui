import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ScanBarcode,
  Upload,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileDown,
  FileEdit,
  ShieldCheck,
  Crosshair,
} from 'lucide-react';
import { Card, StatusBadge, EmptyState } from '../../components/common/ui';
import { DonutChart } from '../../components/common/charts';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { INSPECTION_STATUS } from '../../data/mockData';
import { inspectionsRepo, store } from '../../services/dataStore';
import { reportsService } from '../../services/reportsService';
import { extractionService } from '../../services/extractionService';
import { imageProcessingService } from '../../services/imageProcessingService';
import { complianceService } from '../../services/complianceEngine';

/* Staged analysis pipeline progress — keys into the i18n dictionary so the
   stage list renders in the active language. */
const ANALYSIS_STAGES = [
  'analysisUpload',
  'analysisProcess',
  'analysisOcr',
  'analysisCompliance',
  'analysisPrepare',
];

const AnalysisOverlay = ({ stageIndex }) => {
  const { t } = useLanguage();
  const app = t.app;
  return (
  <div className="analysis-overlay" role="status" aria-live="polite">
    <div className="analysis-panel">
      <div className="analysis-spinner" aria-hidden="true" />
      <h4>{app.analyzing}</h4>
      <ol className="analysis-stages">
        {ANALYSIS_STAGES.map((stageKey, index) => (
          <li key={stageKey} className={index < stageIndex ? 'done' : index === stageIndex ? 'active' : ''}>
            {index < stageIndex ? <CheckCircle2 size={13} aria-hidden="true" /> : <span className="stage-dot" aria-hidden="true" />}
            {app[stageKey]}
          </li>
        ))}
      </ol>
    </div>
  </div>
  );
};

const STEPS = [
  { id: 1, key: 'stepDetails', label: 'Details' },
  { id: 2, key: 'stepCapture', label: 'Capture' },
  { id: 3, key: 'stepExtraction', label: 'Extraction' },
  { id: 4, key: 'stepCompliance', label: 'Compliance' },
  { id: 5, key: 'stepEvidence', label: 'Evidence' },
  { id: 6, key: 'stepReport', label: 'Report' },
];

const DIM_GLYPH = { ok: '✓', warn: '⚠', bad: '✕', unknown: '?', na: '—', pass: '✓', fail: '✕', review: '⚠', unknown: '?' };
const dimClass = (v) => (v === 'ok' ? 'status-ok' : v === 'warn' ? 'status-warn' : v === 'bad' ? 'status-bad' : 'status-unknown');

const nowDate = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

/* ---------------- Step 1 — Inspection Details (reference screen 4) ---------------- */
const DetailsStep = ({ draft, setDraft, onNext }) => {
  const [errors, setErrors] = useState({});
  const { t } = useLanguage();
  const app = t.app;
  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!draft.establishment.trim()) next.establishment = 'Retailer / establishment name is required';
    if (!draft.address.trim()) next.address = 'Address is required';
    setErrors(next);
    if (Object.keys(next).length === 0) onNext();
  };

  return (
    <form onSubmit={submit}>
      <Card title="Start New Inspection">
        <p className="wizard-step-intro">Enter basic details to begin.</p>
        <div className="wizard-form-grid">
          <div className="form-field-group">
            <label className="form-label" htmlFor="wiz-establishment">Retailer / Establishment *</label>
            <input id="wiz-establishment" className={`text-input ${errors.establishment ? 'has-error' : ''}`} placeholder="Enter retailer name" value={draft.establishment} onChange={set('establishment')} />
            {errors.establishment && <p className="field-error" role="alert">{errors.establishment}</p>}
          </div>
          <div className="form-field-group">
            <label className="form-label" htmlFor="wiz-license">License No. (if available)</label>
            <input id="wiz-license" className="text-input" placeholder="Enter license number" value={draft.licenseNo} onChange={set('licenseNo')} />
          </div>
          <div className="form-field-group wizard-form-span">
            <label className="form-label" htmlFor="wiz-address">Address *</label>
            <input id="wiz-address" className={`text-input ${errors.address ? 'has-error' : ''}`} placeholder="Enter complete address" value={draft.address} onChange={set('address')} />
            {errors.address && <p className="field-error" role="alert">{errors.address}</p>}
          </div>
          <div className="form-field-group">
            <label className="form-label" htmlFor="wiz-location">Location</label>
            <div className="input-box-wrapper">
              <MapPin size={16} className="input-leading-icon" aria-hidden="true" />
              <input id="wiz-location" className="text-input" placeholder="City / district" value={draft.location} onChange={set('location')} />
            </div>
          </div>
          <fieldset className="form-field-group">
            <legend className="form-label">Inspection Type</legend>
            <div className="radio-row" role="radiogroup" aria-label="Inspection type">
              {['Routine', 'Complaint', 'Special Drive'].map((type) => (
                <label key={type} className="radio-pill">
                  <input type="radio" name="inspectionType" value={type} checked={draft.inspectionType === type} onChange={set('inspectionType')} />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="form-field-group">
            <label className="form-label" htmlFor="wiz-date">Date</label>
            <input id="wiz-date" type="date" className="text-input" value={draft.date} onChange={set('date')} />
          </div>
          <div className="form-field-group">
            <label className="form-label" htmlFor="wiz-time">Time</label>
            <input id="wiz-time" type="time" className="text-input" value={draft.time} onChange={set('time')} />
          </div>
          <div className="form-field-group wizard-form-span">
            <label className="form-label" htmlFor="wiz-remarks">Remarks (Optional)</label>
            <textarea id="wiz-remarks" className="text-input" rows={2} placeholder="Enter remarks" value={draft.remarks} onChange={set('remarks')} />
          </div>
        </div>
        <div className="wizard-actions">
          <button type="button" className="app-btn app-btn-secondary" onClick={() => window.history.back()}>{app.cancel}</button>
          <button type="submit" className="app-btn app-btn-primary">
            {app.startInspection} <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </Card>
    </form>
  );
};

/* ---------------- Step 2 — Capture Product (reference screen 5) ---------------- */
const CaptureStep = ({ draft, setDraft, onNext, onBack }) => {
  const toast = useToast();
  const { t } = useLanguage();
  const app = t.app;
  const [mode, setMode] = useState('upload');
  const fileRef = useRef(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image is too large (max 5 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast.error('Could not read that file — try another image.');
    reader.onload = () => {
      // Keep the raw File for the OCR pipeline + storage upload; imageUrl for
      // preview. Analysis state resets so the pipeline reruns for the new image.
      setDraft((d) => ({
        ...d,
        imageFile: file,
        imageUrl: reader.result,
        analyzed: false,
        findings: [],
        complianceSummary: null,
      }));
      toast.ok('Image uploaded — ready for analysis.');
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setDraft((d) => ({ ...d, imageUrl: null, imageFile: null, barcode: null }));
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Card title={app.captureTitle}>
      <p className="wizard-step-intro">{app.captureIntro}</p>
      <div className="capture-grid">
        <div>
          <div className="capture-tabs" role="tablist" aria-label="Capture method">
            <button type="button" role="tab" aria-selected={mode === 'upload'} className={`capture-tab ${mode === 'upload' ? 'active' : ''}`} onClick={() => setMode('upload')}>
              <Upload size={15} aria-hidden="true" /> {app.tabUpload}
            </button>
            <button type="button" role="tab" aria-selected={mode === 'barcode'} className={`capture-tab ${mode === 'barcode' ? 'active' : ''}`} onClick={() => setMode('barcode')}>
              <ScanBarcode size={15} aria-hidden="true" /> {app.tabBarcode}
            </button>
          </div>

          <div className="capture-frame">
            {draft.imageUrl ? (
              <img src={draft.imageUrl} alt="Product capture preview" />
            ) : (
              <span className="capture-empty">{app.noImageSelected}</span>
            )}
            <span className="capture-corner tl" aria-hidden="true" />
            <span className="capture-corner tr" aria-hidden="true" />
            <span className="capture-corner bl" aria-hidden="true" />
            <span className="capture-corner br" aria-hidden="true" />
          </div>

          {mode === 'upload' ? (
            <>
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} aria-hidden="true" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="app-btn app-btn-secondary" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
                  <Upload size={15} aria-hidden="true" /> {draft.imageUrl ? app.replaceImage : app.chooseImage}
                </button>
                {draft.imageUrl && (
                  <button type="button" className="app-btn app-btn-danger" onClick={removeImage}>
                    {app.remove}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="barcode-pending">
              <ScanBarcode size={18} aria-hidden="true" />
              <p>{app.barcodeUnavailable}</p>
            </div>
          )}
        </div>

        <aside className="capture-result">
          <h4 className="capture-result-title">{app.capturedImage}</h4>
          {draft.imageUrl ? (
            <p className="capture-hint" style={{ marginTop: 8 }}>{app.imageReady}</p>
          ) : (
            <p className="capture-hint" style={{ marginTop: 8 }}>{app.noImageYet}</p>
          )}
        </aside>
      </div>

      <div className="wizard-actions">
        <button type="button" className="app-btn app-btn-secondary" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> {app.back}</button>
        <button type="button" className="app-btn app-btn-primary" disabled={!draft.imageUrl} onClick={onNext}>
          {app.continue} <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
};

/* ---------------- Step 3 — Extracted Product Information (real pipeline) ---------------- */

/* The complete required-declaration set. Every field renders even when OCR
   missed it — missing ones appear as empty inputs marked "Not detected" so
   the inspector can complete the record manually (OCR assists, never blocks). */
/* The 9-field main inspection form. Every field renders even when OCR missed
   it — missing ones appear as empty inputs marked "Not detected" so the
   inspector can complete the record manually (OCR assists, never blocks).
   Consumer Care is ONE combined field: detected phone/email/address values
   are merged into it at display time. */
const REQUIRED_FIELDS = [
  { key: 'PRODUCT_NAME', label: 'Product Name' },
  { key: 'MANUFACTURER', label: 'Manufacturer / Packer' },
  { key: 'MANUFACTURER_ADDRESS', label: 'Address' },
  { key: 'NET_QUANTITY', label: 'Net Quantity' },
  { key: 'MRP', label: 'MRP' },
  { key: 'MFG_DATE', label: 'MFD / PKD' },
  { key: 'BEST_BEFORE', label: 'EXP / Best Before' },
  { key: 'CONSUMER_CARE', label: 'Consumer Care Details' },
  { key: 'FSSAI', label: 'FSSAI License No.' },
];

/* Extraction keys folded into the combined Consumer Care field — never shown
   as separate form rows. */
const CONSUMER_CARE_SOURCES = ['CONSUMER_CARE_PHONE', 'CONSUMER_CARE_EMAIL', 'CONSUMER_CARE_ADDRESS'];

const ExtractionStep = ({ draft, setDraft, onNext, onBack }) => {
  const [analysisStage, setAnalysisStage] = useState(draft.analyzed ? ANALYSIS_STAGES.length : 0);
  const [analysisError, setAnalysisError] = useState(null);
  const toast = useToast();
  const { t } = useLanguage();
  const app = t.app;

  // REAL pipeline: imageProcessingService.prepare() (CV stage boundary —
  // currently an honest pass-through) → extractionService.analyze() (OCR —
  // UNTOUCHED) → complianceService.evaluate() (rule engine). Runs once per
  // image; retry supported on failure.
  const runAnalysis = () => {
    setAnalysisError(null);
    setAnalysisStage(0);
    const imageSource = draft.imageFile || draft.imageUrl || undefined;
    imageProcessingService
      .prepare({ source: imageSource, onStage: () => setAnalysisStage(1) })
      .then((prepared) =>
        extractionService.analyze(prepared.source, {
          onStage: (stage) => {
            const map = { uploading: 1, processing: 2, extracting: 3, done: 4 };
            setAnalysisStage(map[stage] || 0);
          },
        }).then((result) => ({ ...result, cvNotes: prepared.notes }))
      )
      .then((result) => {
        const { findings, summary } = complianceService.evaluate(result.fields);
        setDraft((d) => ({
          ...d,
          analyzed: true,
          imageUrl: result.imageUrl || d.imageUrl,
          fields: result.fields,
          findings,
          complianceSummary: summary,
          cvNotes: result.cvNotes || [],
        }));
        setAnalysisStage(ANALYSIS_STAGES.length);
      })
      .catch((err) => {
        // Translated sentinels for known cases; otherwise show the REAL
        // service/network detail (never a masked generic failure).
        setAnalysisError(
          err?.message?.includes('Unsupported') || err?.message?.includes('corrupted')
            ? 'IMAGE_UNREADABLE'
            : err?.code === 'SERVICE_UNREACHABLE'
              ? 'SERVICE_UNREACHABLE'
              : err?.message || 'ANALYSIS_FAILED'
        );
      });
    // End runAnalysis
  };

  // Kick off analysis on first view of this step (or after image change)
  React.useEffect(() => {
    if (!draft.analyzed && analysisStage === 0 && !analysisError) {
      const timer = setTimeout(runAnalysis, 150);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.analyzed]);

  // Merge detected fields with the required set: missing declarations appear
  // as empty, manually-fillable rows. Extra detected declarations (FSSAI etc.)
  // are appended so nothing the model found is hidden. Hooks stay above the
  // early return so they run on every render path.
  const fieldList = React.useMemo(() => {
    const byKey = new Map(draft.fields.map((f) => [f.key, f]));
    const required = REQUIRED_FIELDS.map((req) => {
      const detected = byKey.get(req.key);
      if (detected) return { ...detected, label: req.label }; // form label wins
      if (req.key === 'CONSUMER_CARE') {
        // Combine detected phone/email/address into the single editable field.
        const parts = CONSUMER_CARE_SOURCES.map((k) => byKey.get(k)).filter(Boolean);
        if (parts.length) {
          const value = parts.map((p) => p.value).join('; ');
          const confidence = Math.max(...parts.map((p) => p.confidence || 0));
          return { key: req.key, label: req.label, value, confidence, bbox: parts[0].bbox };
        }
      }
      return { key: req.key, label: req.label, value: '', confidence: 0, missing: true };
    });
    return required;
  }, [draft.fields]);

  if (!draft.analyzed) {
    return (
      <Card title="Extracted Product Information">
        <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {analysisError ? (
            <div className="analysis-overlay">
              <div className="analysis-panel">
                <AlertTriangle size={22} style={{ color: 'var(--status-bad)' }} aria-hidden="true" />
                <h4>{app.analysisFailed}</h4>
                <p className="capture-hint" style={{ margin: 0 }}>
                  {analysisError === 'IMAGE_UNREADABLE'
                    ? app.imageUnreadable
                    : analysisError === 'SERVICE_UNREACHABLE'
                      ? app.ocrServiceUnreachable
                      : analysisError === 'ANALYSIS_FAILED'
                        ? app.analysisFailed
                        : analysisError /* real service/network detail, not a masked sentinel */}
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" className="app-btn app-btn-primary app-btn-sm" onClick={runAnalysis}>{app.retryAnalysis}</button>
                  <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={onBack}>{app.backToCapture}</button>
                  <button
                    type="button"
                    className="app-btn app-btn-secondary app-btn-sm"
                    onClick={() => setDraft((d) => ({ ...d, analyzed: true }))}
                  >
                    {app.enterManually}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <AnalysisOverlay stageIndex={analysisStage} />
          )}
        </div>
      </Card>
    );
  }

  /** Inspector edits drive compliance: findings re-evaluate against the
      REVIEWED values, never the stale OCR output. The raw OCR value is
      preserved on `ocrValue` for auditability, and confidence is cleared —
      a manually entered value is authoritative, not a low-confidence read. */
  const updateField = (key, value) => {
    setDraft((d) => {
      const label = REQUIRED_FIELDS.find((r) => r.key === key)?.label || key;
      const exists = d.fields.some((f) => f.key === key);
      const fields = exists
        ? d.fields.map((f) =>
            f.key === key
              ? { ...f, ocrValue: f.ocrValue ?? f.value, value, verified: true, edited: true, confidence: null }
              : f
          )
        : [...d.fields, { key, label, ocrValue: null, value, confidence: null, verified: true, edited: true }];
      const { findings, summary } = complianceService.evaluate(fields);
      return { ...d, fields, findings, complianceSummary: summary };
    });
  };



  return (
    <Card title={app.extractionTitle}>
      <p className="wizard-step-intro">{app.extractionIntro}</p>
      <div className="extraction-grid">        <div className="extraction-image">
          <img src={draft.imageUrl} alt="Captured product" />
          {draft.cvNotes?.length > 0 && (
            <p className="capture-hint" style={{ margin: '6px 0 0', fontSize: 11 }}>
              {draft.cvNotes.join(' ')}
            </p>
          )}
          <button
            type="button"
            className="app-btn app-btn-secondary app-btn-sm"
            style={{ width: '100%', marginTop: 10 }}
            onClick={() => {
              // Return to the Capture step with prior analysis discarded so the
              // EXISTING pipeline re-runs cleanly on the replacement image. All
              // other wizard data (establishment, notes, remarks, evidence) is
              // preserved. No re-registration, no duplicate records.
              setDraft((d) => ({
                ...d,
                imageUrl: null,
                imageFile: null,
                analyzed: false,
                fields: [],
                findings: [],
                complianceSummary: null,
              }));
              onBack();
            }}
          >
            <Camera size={14} aria-hidden="true" /> {app.changeImage}
          </button>
        </div>

        <div className="extraction-fields">
          <div className="app-card-title-row">
            <h4 className="extraction-fields-title">{app.extractedDetails} <span className="provenance-chip extracted">{app.chipAutomated}</span></h4>
          </div>
          <dl className="extraction-list">
            {fieldList.map((field) => (
              <div key={field.key} className={`extraction-row ${field.verified ? 'verified' : ''}`}>
                <dt>
                  {field.label}
                  {field.missing ? (
                    <span className="extraction-confidence" style={{ color: 'var(--status-warn)' }}>{app.notDetected}</span>
                  ) : field.confidence == null ? (
                    field.verified ? (
                      <span className="extraction-confidence" style={{ color: 'var(--status-ok)' }}>{app.verified}</span>
                    ) : null
                  ) : (
                    <span className="extraction-confidence" title="Automated extraction confidence">{Math.round(field.confidence * 100)}%</span>
                  )}
                </dt>
                <dd className="extraction-value">
                  <input
                    className="text-input"
                    value={field.value || ''}
                    placeholder={field.missing ? app.notDetectedManual : app.enterValue}
                    onChange={(e) => updateField(field.key, e.target.value)}
                    aria-label={`${field.label} (editable)`}
                  />
                  <span className="provenance-chip-row">
                    {field.verified ? (
                      <span className="provenance-chip verified">{field.edited ? `✎ ${app.verifiedEdited}` : `✓ ${app.verified}`}</span>
                    ) : field.missing ? (
                      <span className="provenance-chip extracted" style={{ color: 'var(--status-warn)' }}>{app.manualEntryRequired}</span>
                    ) : (
                      <span className="provenance-chip extracted">{field.confidence < 0.9 ? `? ${app.lowConfidence}` : app.chipAutomated}</span>
                    )}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="wizard-actions">
        <button type="button" className="app-btn app-btn-secondary" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> {app.back}</button>
        <button type="button" className="app-btn app-btn-primary" onClick={onNext}>
          Next: {app.stepCompliance} <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
};

/* ---------------- Step 4 — Compliance Verification (real engine findings) ---------------- */
const ComplianceStep = ({ draft, onNext, onBack }) => {
  const [expanded, setExpanded] = useState(null);
  const { t } = useLanguage();
  const app = t.app;
  // Real rule-engine findings — no synthetic demo set. The step is only
  // reachable after a completed analysis, but an empty list renders an
  // honest empty state rather than fabricated checks.
  const checks = draft.findings;
  const passCount = checks.filter((c) => c.result === 'ok').length;
  const failCount = checks.filter((c) => c.result === 'bad').length;


  return (
    <Card title={app.complianceTitle}>
      {checks.length === 0 ? (
        <>
          <p className="wizard-step-intro">{app.noFindingsSub}</p>
          <EmptyState
            icon={<AlertTriangle size={20} aria-hidden="true" />}
            title={app.noFindings}
            subtitle={app.noFindingsSub}
            action={<button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={onBack}>{app.back}</button>}
          />
        </>
      ) : (
      <>
      <p className="wizard-step-intro">
        {app.complianceIntroPrefix}{' '}{passCount} / {checks.length} {app.complianceIntroSuffix}
      </p>
      <div className="app-table-wrap" style={{ boxShadow: 'none' }}>
        <table className="app-table compliance-table">
          <thead>
            <tr>
              <th>{app.colCheck}</th>
              <th>{app.colRuleRef}</th>
              <th>{app.colStatus || 'Status'}</th>
              <th>Detected value</th>
              <th>{app.colRemarks}</th>
              <th aria-label="Dimension detail" style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => {
              const status = check.result || check.status;
              const dims = check.dimensions || {};
              const dimGlyphMap = DIM_GLYPH;
              return (
                <React.Fragment key={check.id}>
                  <tr
                    onClick={() => setExpanded(expanded === check.id ? null : check.id)}
                    style={{ cursor: 'pointer' }}
                    aria-expanded={expanded === check.id}
                  >
                    <td style={{ fontWeight: 600 }}>{check.check}</td>
                    <td>{check.rule_reference || check.rule}</td>
                    <td><StatusBadge status={status} /></td>
                    <td style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>{check.value || '—'}</td>
                    <td style={{ color: status === 'bad' ? 'var(--status-bad)' : 'var(--text-body)' }}>{check.reason || check.remarks}</td>
                    <td>{expanded === check.id ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}</td>
                  </tr>
                  {expanded === check.id && (
                    <tr className="compliance-dimensions-row">
                      <td colSpan={6}>
                        <div className="compliance-dimensions">
                          <strong className="compliance-dim-title">Dimension detail</strong>
                          <div className="compliance-dim-chips">                              {['presence', 'correctness', 'placement', 'readability', 'font_size'].map((dim) => {
                                const v = dims[dim] || 'na';
                                return (
                                  <span key={dim} className={`dim-chip ${dimClass(v)}`}>
                                    {dimGlyphMap[v] != null ? dimGlyphMap[v] : '—'} {dim.replace('_', ' ')}
                                  </span>
                                );
                              })}
                            {dims.confidence != null && <span className="dim-chip neutral">conf {Math.round(dims.confidence * 100)}%</span>}
                            {dims.bounding_box && (
                              <span className="dim-chip neutral"><Crosshair size={11} aria-hidden="true" /> region detected</span>
                            )}
                          </div>
                          <p className="compliance-dim-note">
                            Findings produced by the rule-based compliance engine; presence, correctness, placement, readability and font-size feed the final verdict. The inspector confirms at submission.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="wizard-actions">
        <button type="button" className="app-btn app-btn-secondary" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> {app.back}</button>
        <button type="button" className="app-btn app-btn-primary" onClick={onNext} disabled={checks.length === 0}>
          Next: {app.stepEvidence} <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      </>
      )}
    </Card>
  );
};

/* ---------------- Step 5 — Evidence / Review (reference screen 8) ---------------- */
const EvidenceStep = ({ draft, setDraft, onNext, onBack }) => {
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(false);
  const fileRef = useRef(null);
  const toast = useToast();
  const { t } = useLanguage();
  const app = t.app;
  // Real rule-engine findings first; the seeded demo set is only a fallback.
  const checks = draft.findings || [];
  const violation = checks.find((c) => (c.result || c.status) === 'bad' && c.bounding_box) || checks.find((c) => (c.result || c.status) === 'bad');

  const addPhotos = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const remaining = 6 - draft.evidence.length; // cap to keep localStorage sane
    if (remaining <= 0) {
      toast.error('Evidence limit reached (6 items).');
      return;
    }
    files.slice(0, remaining).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name}: only image files are accepted as evidence.`);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => toast.error(`Could not read ${file.name}.`);
      reader.onload = () =>
        setDraft((d) => ({
          ...d,
          evidence: [...d.evidence, { id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'photo', label: file.name, url: reader.result }],
        }));
      reader.readAsDataURL(file);
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeEvidence = (id) =>
    setDraft((d) => ({ ...d, evidence: d.evidence.filter((item) => item.id !== id) }));

  return (
    <Card title={app.evidenceTitle}>
      <p className="wizard-step-intro">{app.evidenceIntro}</p>

      <div className="evidence-grid">
        <div className="evidence-photos">
          {draft.evidence.length === 0 && (
            <p className="capture-hint" style={{ gridColumn: '1 / -1' }}>{app.noEvidenceYet}</p>
          )}
          {draft.evidence.map((item) => (
            <figure key={item.id} className="evidence-photo">
              {item.url ? (
                <img src={item.url} alt={`Evidence: ${item.label}`} />
              ) : (
                <span className="evidence-empty">No preview</span>
              )}
              <figcaption>
                {item.label}
                <button type="button" className="evidence-remove" onClick={() => removeEvidence(item.id)} aria-label={`Remove evidence ${item.label}`}>
                  <XCircle size={13} aria-hidden="true" /> Remove
                </button>
              </figcaption>
            </figure>
          ))}
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={addPhotos} style={{ display: 'none' }} aria-hidden="true" />
          <button type="button" className="evidence-add" onClick={() => fileRef.current?.click()} disabled={draft.evidence.length >= 6}>
            <Upload size={16} aria-hidden="true" /> {app.addEvidence}
            <span>{draft.evidence.length}/6</span>
          </button>
        </div>

        <div className="evidence-side">
          {violation && (violation.dimensions?.bounding_box || violation.bounding_box) && (
            <>
              <h4 className="extraction-fields-title">Highlighted Violation Regions</h4>
              <div className="violation-region">
                <div className="violation-region-frame">
                  <img src={draft.imageUrl} alt="Product label with highlighted violation region" />
                  <span
                    className="bbox-highlight"
                    style={{
                      left: `${(violation.dimensions?.bounding_box ?? violation.bounding_box).x * 100}%`,
                      top: `${(violation.dimensions?.bounding_box ?? violation.bounding_box).y * 100}%`,
                      width: `${(violation.dimensions?.bounding_box ?? violation.bounding_box).w * 100}%`,
                      height: `${(violation.dimensions?.bounding_box ?? violation.bounding_box).h * 100}%`,
                    }}
                    aria-hidden="true"
                  />
                </div>
                <p className="violation-region-note">
                  <AlertTriangle size={13} aria-hidden="true" /> {violation.check} — {violation.reason || violation.remarks} ({violation.rule_reference || violation.rule})
                </p>
              </div>
            </>
          )}

          <div className="form-field-group">
            <label className="form-label" htmlFor="wiz-notes">{app.notesLabel}</label>
            <textarea
              id="wiz-notes"
              className="text-input"
              rows={3}
              placeholder={app.notesPlaceholder}
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </div>

          <label className={`confirm-row ${error ? 'has-error' : ''}`}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => {
                setConfirmed(e.target.checked);
                setError(false);
              }}
            />
            <span>{app.confirmText}</span>
          </label>
          {error && <p className="field-error" role="alert">{app.confirmError}</p>}
        </div>
      </div>

      <div className="wizard-actions">
        <button type="button" className="app-btn app-btn-secondary" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> {app.back}</button>
        <button
          type="button"
          className="app-btn app-btn-primary"
          onClick={() => {
            if (!confirmed) {
              setError(true);
              return;
            }
            onNext();
          }}
        >
          {app.stepReport} <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
};

/* ---------------- Step 6 — Inspection Report (reference screen 8b) ---------------- */
const ReportStep = ({ draft, onBack, onSubmit }) => {
  const toast = useToast();
  const { t } = useLanguage();
  const app = t.app;

  // Real findings from the rule engine — no synthetic demo set.
  const checks = draft.findings || [];
  const totalChecks = checks.filter(Boolean).length;
  const passCount = checks.filter((c) => (c.result || c.status) === 'ok' || (c.result || c.status) === 'pass').length;
  const failCount = checks.filter((c) => (c.result || c.status) === 'bad' || (c.result || c.status) === 'fail').length;
  const reviewCount = checks.filter((c) => (c.result || c.status) === 'warn' || (c.result || c.status) === 'review').length;
  const violations = checks.filter((c) => (c.result || c.status) === 'bad' || (c.result || c.status) === 'fail');

  const overall = violations.length === 0 && reviewCount === 0
    ? INSPECTION_STATUS.compliant
    : violations.length > 0
      ? INSPECTION_STATUS.non_compliant
      : INSPECTION_STATUS.warning;
  const reportId = draft.nextReportId;

  // Field keys come from extractionService (PRODUCT_NAME, MRP, NET_QUANTITY,
  // MANUFACTURER, …). Match case-insensitively so inspector edits and future
  // server providers can't break the lookups.
  const fieldValue = (needle) =>
    draft.fields.find((f) => (f.key || '').toUpperCase() === needle.toUpperCase())?.value || null;

  const summary = [
    { label: 'Establishment', value: draft.establishment || '—' },
    { label: 'Inspector', value: draft.inspectorName },
    { label: 'Date / Time', value: `${draft.date} · ${draft.time}` },
    { label: 'Product', value: fieldValue('PRODUCT_NAME') || '—' },
    { label: 'Manufacturer', value: fieldValue('MANUFACTURER') || '—' },
    { label: 'MRP', value: fieldValue('MRP') || '—' },
    { label: 'Net Quantity', value: fieldValue('NET_QUANTITY') || '—' },
    { label: 'Inspection Type', value: draft.inspectionType },
  ];

  const reportRecord = {
    id: reportId,
    product: fieldValue('PRODUCT_NAME') || 'Unknown product',
    manufacturer: fieldValue('MANUFACTURER') || '—',
    manufacturerId: null, // derived from the inspection data at submission
    manufacturerAddress: fieldValue('MANUFACTURER_ADDRESS') || null,
    gstin: fieldValue('GSTIN') || null,
    inspector: draft.inspectorName,
    inspectorId: null, // filled from the session user by the wizard container
    establishment: draft.establishment,
    address: draft.address,
    licenseNo: draft.licenseNo || null,
    inspectionType: draft.inspectionType,
    location: draft.location || null,
    remarks: draft.remarks || null,
    date: draft.date,
    time: draft.time,
    status: overall,
    declarations: checks.map((c) => ({
      name: c.check,
      value: draft.fields.find((f) => f.key === c.id)?.value ?? null,
      confidence: c.dimensions?.confidence ?? null,
      presence: c.dimensions?.presence ?? null,
      correctness: c.dimensions?.correctness ?? null,
      placement: c.dimensions?.placement ?? null,
      readability: c.dimensions?.readability ?? null,
      font_size: c.dimensions?.font_size ?? null,
      violation_type: (c.result === 'bad' || c.status === 'bad') ? (c.violation_type || 'failed_check') : null,
      rule_reference: c.rule_reference || c.rule || 'LM (PC) Rules 2011',
      bounding_box: c.dimensions?.bounding_box ?? c.bounding_box ?? null,
      verified: false,
    })),
    summary: {
      overall,
      compliantCount: passCount,
      warnCount: reviewCount,
      violationCount: violations.length,
      undeterminedCount: 0,
    },
    label: {
      name: fieldValue('PRODUCT_NAME'),
      brand: fieldValue('BRAND'),
      net_quantity: fieldValue('NET_QUANTITY'),
      mrp: fieldValue('MRP'),
      mfg: fieldValue('MFG_DATE'),
      expiry: fieldValue('BEST_BEFORE'),
      batch: fieldValue('BATCH'),
      barcode: fieldValue('BARCODE') || draft.barcode || null,
    },
    imageFile: draft.imageFile || null,
    evidence: draft.evidence.map((item, index) => ({
      id: item.id,
      type: 'photo',
      label: index === 0 ? 'Original product photograph' : item.label,
      note: index === 0 ? draft.notes || null : null,
      // The main product photo lives on draft.imageUrl; carry it into the
      // record so evidence survives persistence (detail page, gov views, PDF).
      url: item.url || (index === 0 ? draft.imageUrl : null),
    })),
  };

  const submit = () => {
    // Report content is assembled here (read-only over draft); persistence and
    // navigation are owned by the wizard container via onSubmit.
    onSubmit({ ...reportRecord, evidenceFiles: draft.evidenceFiles || [] });
  };

  const download = async (format) => {
    try {
      // Build the evidence-shaped record the report generator expects. This is
      // the same shape the store/save path persists, so the export and the
      // persisted record can never drift.
      await reportsService.downloadReport(
        {
          ...reportRecord,
          evidence: draft.evidence.map((item, index) => ({
            ...item,
            dataUrl: item.url || (index === 0 ? draft.imageUrl : null),
            note: index === 0 ? draft.notes || null : item.note || null,
          })),
        },
        { format }
      );
      toast.ok(`${format === 'pdf' ? 'PDF' : 'Editable'} report downloaded.`);
    } catch (e) {
      toast.error(
        `${format === 'pdf' ? 'PDF export failed' : 'Editable report export failed'} — ${e?.message || 'try again'}`
      );
    }
  };

  return (
    <Card title={app.reportCardTitle}>
      <div className="report-head">
        <div>
          <span className="report-id">{reportId}</span>
          <StatusBadge status={overall} />
        </div>
        <div className="report-head-actions">
          <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={() => download('pdf')}>
            <FileDown size={14} aria-hidden="true" /> {app.downloadPdf}
          </button>
          <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={() => download('doc')}>
            <FileEdit size={14} aria-hidden="true" /> {app.downloadEditable}
          </button>
        </div>
      </div>

      <div className="report-body">
        <dl className="report-summary">
          {summary.map((item) => (
            <div key={item.label} className="report-summary-row">
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
          <div className="report-summary-row">
            <dt>Remarks</dt>
            <dd>{draft.notes || draft.remarks || '—'}</dd>
          </div>
        </dl>

        <aside className="report-result">
          <h4 className="extraction-fields-title">Compliance Result</h4>
          <div className="report-donut">
            <DonutChart
              segments={[
                { label: 'Passed', value: passCount, color: 'var(--status-ok)' },
                { label: 'Violations', value: violations.length, color: 'var(--status-bad)' },
              ]}
              centerLabel={`${Math.round((passCount / totalChecks) * 100)}%`}
              centerSub="checks passed"
              ariaLabel={`Compliance result: ${passCount} of ${totalChecks} checks passed`}
            />
          </div>
          {violations.length > 0 && (
            <ul className="report-violations">
              {violations.map((v) => (
                <li key={v.id}>
                  <XCircle size={13} aria-hidden="true" /> {v.check} — {v.remarks} ({v.rule})
                </li>
              ))}
            </ul>
          )}
          <div className="report-evidence-count">
            <ShieldCheck size={13} aria-hidden="true" /> {draft.evidence.length} evidence item{draft.evidence.length === 1 ? '' : 's'} attached
          </div>
        </aside>
      </div>

      <div className="wizard-actions">
        <button type="button" className="app-btn app-btn-secondary" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> {app.back}</button>
        <button type="button" className="app-btn app-btn-primary" onClick={submit}>
          <CheckCircle2 size={16} aria-hidden="true" /> {app.submit}
        </button>
      </div>
    </Card>
  );
};

/* ---------------- Wizard container ---------------- */
export const NewInspection = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const app = t.app;
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(() => {
    // Next report ID derived from the store at mount — stays unique even after
    // previous submissions in this session (empty store starts at LM-1001).
    const current = store.get('inspections');
    const maxId = current.reduce((max, item) => {
      const numeric = Number.parseInt(item.id.replace('LM-', ''), 10);
      return Number.isNaN(numeric) ? max : Math.max(max, numeric);
    }, 1000);
    return {
      establishment: '',
      licenseNo: '',
      address: '',
      location: '',
      inspectionType: 'Routine',
      date: nowDate(),
      time: nowTime(),
      remarks: '',
      barcode: null,
      imageUrl: null,
      analyzed: false,
      fields: [], // real extraction via runAnalysis() before this step renders
      evidence: [
        { id: 'ev-main', type: 'photo', label: 'Original product photograph', url: null },
      ],
      notes: '',
      inspectorName: user?.name || 'Inspector',
      nextReportId: `LM-${maxId + 1}`,
    };
  });

  const go = (next) => {
    setStep(next);
    const page = document.getElementById('main-content');
    if (page) page.scrollTop = 0;
  };

  const stepProps = {
    draft,
    setDraft,
    onNext: () => go(step + 1),
    onBack: () => (step === 1 ? navigate('/inspector') : go(step - 1)),
  };

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{app.titleNewInspection}</h1>
          <p className="app-page-subtitle">{app.subtitleNewInspection}</p>
        </div>
      </header>

      <nav className="wizard-stepper" aria-label="Inspection progress">
        {STEPS.map((s) => (
          <React.Fragment key={s.id}>
            <button
              type="button"
              className={`wizard-step ${s.id === step ? 'current' : ''} ${s.id < step ? 'done' : ''}`}
              onClick={() => s.id < step && go(s.id)}
              aria-current={s.id === step ? 'step' : undefined}
              disabled={s.id > step}
            >
              <span className="wizard-step-index">{s.id < step ? <CheckCircle2 size={15} aria-hidden="true" /> : s.id}</span>
              {app[s.key] || s.label}
            </button>
            {s.id < STEPS.length && <span className="wizard-step-line" aria-hidden="true" />}
          </React.Fragment>
        ))}
      </nav>

      {step === 1 && <DetailsStep {...stepProps} />}
      {step === 2 && <CaptureStep {...stepProps} />}
      {step === 3 && <ExtractionStep {...stepProps} />}
      {step === 4 && <ComplianceStep {...stepProps} />}
      {step === 5 && <EvidenceStep {...stepProps} />}
      {step === 6 && (
        <ReportStep
          draft={draft}
          onBack={() => go(5)}
          onSubmit={(record) => {
            // Manufacturer association/creation and the system advisory flag are
            // owned by the repository layer — one consistent derivation for
            // every consumer (history, monitoring, violations, cases, reports).
            const persisted = { ...record, inspectorId: user?.id ?? null, evidenceFiles: draft.evidenceFiles || [] };
            inspectionsRepo.create(persisted);
            toast.ok(`Inspection ${record.id} submitted.`);
            navigate(`/inspector/inspections/${record.id}`);
          }}
        />
      )}
    </>
  );
};
