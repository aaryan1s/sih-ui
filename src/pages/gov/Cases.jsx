import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Scale, ShieldCheck, FileDown, FileEdit, Plus, StickyNote } from 'lucide-react';
import { Card, StatusBadge, EmptyState, DataTable } from '../../components/common/ui';
import { ENFORCEMENT_ACTIONS } from '../../data/mockData';
import { useStoreData, casesRepo } from '../../services/dataStore';
import { useLanguage } from '../../context/LanguageContext';
import { reportsService } from '../../services/reportsService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const SEVERITY_BADGE = { severe: 'severe', major: 'warning', minor: 'unknown' };
const SEVERITY_LABEL = { severe: 'SEVERE', major: 'MAJOR', minor: 'MINOR' };

// Module-scoped sequence for stable note ids (unique per session)
let noteSeq = 1;

export const CaseQueue = () => {
  const navigate = useNavigate();
  const cases = useStoreData('cases');
  const { t } = useLanguage();
  const app = t.app;

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{app.navCases}</h1>
          <p className="app-page-subtitle">
            System flags are advisory recommendations. Every enforcement decision below is a recorded government action.
          </p>
        </div>
      </header>
      <DataTable
        columns={[
          { key: 'id', label: 'Case', width: '110px' },
          { key: 'manufacturer', label: 'Manufacturer' },
          { key: 'violation', label: 'Violation / Complaint' },
          { key: 'severity', label: 'Severity', width: '105px' },
          { key: 'opened', label: 'Opened', width: '110px' },
          { key: 'status', label: 'Status', width: '140px' },
          { key: 'reporter', label: 'Reporter', width: '110px' },
        ]}
        rows={cases}
        renderRow={(row) => (
          <tr key={row.id} onClick={() => navigate(`/gov/cases/${row.id}`)} style={{ cursor: 'pointer' }}>
            <td><span className="table-link">{row.id}</span></td>
            <td>{row.manufacturer}</td>
            <td style={{ fontSize: 12.5 }}>
              {row.complaint ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--status-warn)', fontSize: 12 }}>📋 Complaint</span>
                  <span style={{ color: 'var(--text-muted)' }}>·</span>
                  <span>{row.violation}</span>
                </span>
              ) : (
                row.violation
              )}
            </td>
            <td><StatusBadge status={SEVERITY_BADGE[row.severity] || 'unknown'} label={SEVERITY_LABEL[row.severity] || 'UNKNOWN'} /></td>
            <td>{row.opened}</td>
            <td>
              <StatusBadge
                status={row.status === 'pending_review' || row.status === 'under_review' ? 'under_review' : 'ok'}
                label={row.status === 'pending_review' ? 'Pending Review' : row.status === 'under_review' ? 'Under Review' : 'Action Recorded'}
              />
            </td>
            <td>{row.reporter || '—'}</td>
          </tr>
        )}
      />
    </>
  );
};

export const CaseReview = () => {
  const { id } = useParams();
  const toast = useToast();
  const { user } = useAuth();
  const cases = useStoreData('cases');
  const inspections = useStoreData('inspections');
  const notes = useStoreData('notes');
  const caseFile = cases.find((item) => item.id === id);
  const inspection = caseFile ? inspections.find((item) => item.id === caseFile.inspectionId) : null;
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [noteText, setNoteText] = useState('');

  if (!caseFile) {
    return (
      <EmptyState
        icon={<Scale size={20} aria-hidden="true" />}
        title="Case not found"
        action={<Link className="app-btn app-btn-secondary app-btn-sm" to="/gov/cases">Back to queue</Link>}
      />
    );
  }

  const caseNotes = notes[caseFile.id] || [];
  const decided = Boolean(caseFile.decision);

  // Defensive field access — hand-created or legacy case records may predate
  // newer fields; the review page must never crash on them.
  const previousViolations = caseFile.previousViolations || [];
  const flagReason = caseFile.flagReason || caseFile.violation || 'Advisory flag raised for government review.';
  const assignedTo = caseFile.assignedTo || 'Unassigned';

  const handleDecision = (event) => {
    event.preventDefault();
    if (!action || !reason.trim()) return;
    // Persisted through the central store — case queue, timeline and the
    // dashboard's "Actions Recorded" figure update everywhere.
    casesRepo.addAction(caseFile.id, {
      status: 'action_taken',
      label: ENFORCEMENT_ACTIONS.find((a) => a.id === action)?.label || action,
      reason: reason.trim(),
      actor: user?.name || 'Department Officer',
    });
    toast.ok(`Decision recorded: ${ENFORCEMENT_ACTIONS.find((a) => a.id === action)?.label} — ${caseFile.id}`);
    setAction('');
    setReason('');
  };

  const handleAddNote = (event) => {
    event.preventDefault();
    if (!noteText.trim()) return;
    casesRepo.addNote(caseFile.id, {
      id: `note-${noteSeq++}`,
      author: user?.name || 'Department Officer',
      text: noteText.trim(),
      date: new Date().toISOString().slice(0, 10),
    });
    setNoteText('');
    toast.ok('Note added to the case file.');
  };

  const download = async (format) => {
    if (!inspection) {
      toast.error('This case has no linked inspection to export.');
      return;
    }
    try {
      await reportsService.downloadReport(inspection, { format });
      toast.ok(`${format.toUpperCase()} downloaded for inspection ${inspection.id}.`);
    } catch (error) {
      toast.error(error.message || 'The report could not be generated. Try again.');
    }
  };

  return (
    <>
      <header className="app-page-header">
        <div>
          <Link to="/gov/cases" className="table-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
            <ArrowLeft size={13} aria-hidden="true" /> Cases & Enforcement
          </Link>
          <h1 className="app-page-title" style={{ marginTop: 6 }}>{caseFile.id}</h1>
          <p className="app-page-subtitle">
            {caseFile.complaint ? `Consumer complaint · ` : ''}{caseFile.violation} · opened {caseFile.opened} · assigned to {assignedTo}
          </p>
        </div>
        <StatusBadge status={SEVERITY_BADGE[caseFile.severity]} label={SEVERITY_LABEL[caseFile.severity]} />
      </header>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <Card title="Evidence & Extracted Data">
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
              Linked inspection: {inspection ? (
                <Link className="table-link" to={`/gov/inspections/${inspection.id}`}>{inspection.id} — {inspection.product}</Link>
              ) : '—'}
            </p>
            <div className="quick-actions">
              {(inspection?.evidence || []).map((item) => (
                <div key={item.id} className="quick-action-btn" style={{ cursor: 'default' }}>
                  <span className="quick-action-icon"><ShieldCheck size={15} aria-hidden="true" /></span>
                  <span>
                    <strong style={{ display: 'block', fontSize: 12.5 }}>{item.label}</strong>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{item.note || '—'}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Manufacturer History & Risk">
            <p style={{ fontSize: 12.5, margin: '0 0 10px 0' }}>Previous violations for this manufacturer:</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {previousViolations.length === 0 ? (
                <li style={{ color: 'var(--text-muted)' }}>No earlier violations on record for this manufacturer.</li>
              ) : (
                previousViolations.map((violation) => (
                  <li key={violation.id}>
                    <strong>{violation.id}</strong> · {violation.date} · {violation.rule} — {violation.outcome}
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {caseFile.complaint ? (
            <Card title="Complaint Details">
              <p style={{ fontSize: 12.5, margin: 0, background: 'var(--status-warn-soft)', border: '1px solid var(--status-warn-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                <strong>Filed as a consumer complaint.</strong> Reporter: {caseFile.reporter || 'Inspector'} (ID: {caseFile.reporterId || '—'}).
                <br/>
                Inspection reference: {caseFile.inspectionId}.
                <br/>
                {flagReason}
              </p>
              <p style={{ fontSize: 11.5, color: 'var(--text-subtle)', margin: '10px 0 0 0' }}>
                The complaint is now in the government queue. The reviewing officer can record an enforcement action below.
              </p>
            </Card>
          ) : (
            <Card title="System Flag (advisory)">
              <p style={{ fontSize: 12.5, margin: 0, background: 'var(--status-warn-soft)', border: '1px solid var(--status-warn-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                {flagReason}
              </p>
              <p style={{ fontSize: 11.5, color: 'var(--text-subtle)', margin: '10px 0 0 0' }}>
                The system recommends review only. It does not ban, suspend, or seize a license — the decision below is the officer's.
              </p>
            </Card>
          )}

          {decided && caseFile.decision && (
            <Card title="Recorded Decision (audit trail)">
              <p style={{ fontSize: 12.5, margin: 0, background: 'var(--status-ok-soft)', border: '1px solid var(--status-ok-border)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                <strong>{caseFile.decision.action}</strong> on {caseFile.decision.date}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-body)', margin: '10px 0 0 0' }}>
                Justification: {caseFile.decision.reason}
              </p>
            </Card>
          )}

          <Card title="Case Timeline">
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {(caseFile.timeline || []).map((entry, index) => (
                <li key={index}>
                  <strong>{entry.actor}</strong> — {entry.event} <span style={{ color: 'var(--text-muted)' }}>({entry.date})</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Case Notes">
            {caseNotes.length > 0 ? (
              <ul style={{ listStyle: 'none', margin: '0 0 12px 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {caseNotes.map((note) => (
                  <li key={note.id} style={{ background: '#f8fafc', borderRadius: 'var(--radius-md)', padding: '9px 12px', fontSize: 12.5 }}>
                    <strong>{note.author}</strong> <span style={{ color: 'var(--text-muted)' }}>({note.date})</span>
                    <span style={{ display: 'block', marginTop: 3 }}>{note.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px 0' }}>No notes recorded yet.</p>
            )}
            <form onSubmit={handleAddNote} style={{ display: 'flex', gap: 8 }}>
              <input
                className="text-input"
                style={{ flex: 1, height: 36, border: '1.5px solid var(--input-border)', borderRadius: 'var(--radius-md)', padding: '0 10px', fontSize: 12.5 }}
                placeholder="Add an investigation note…"
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                aria-label="New case note"
              />
              <button type="submit" className="app-btn app-btn-secondary app-btn-sm" disabled={!noteText.trim()}>
                <Plus size={14} aria-hidden="true" /> Add
              </button>
            </form>
          </Card>

          <Card title={decided ? 'Amend Decision (new action recorded)' : 'Officer Decision (authoritative)'}>
            <form onSubmit={handleDecision} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select
                value={action}
                onChange={(event) => setAction(event.target.value)}
                required
                className="app-select"
                aria-label="Enforcement action"
              >
                <option value="">Choose enforcement action…</option>
                {ENFORCEMENT_ACTIONS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                rows={3}
                className="app-textarea"
                placeholder="Written justification (required, recorded in the audit trail)…"
              />
              <button type="submit" className="app-btn app-btn-primary" disabled={!action || !reason.trim()}>
                Record Enforcement Action
              </button>
            </form>
          </Card>

          {inspection && (
            <Card title="Linked Inspection Report">
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={() => download('pdf')}>
                  <FileDown size={14} aria-hidden="true" /> Download PDF
                </button>
                <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={() => download('doc')}>
                  <FileEdit size={14} aria-hidden="true" /> Editable Report
                </button>
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--text-subtle)', margin: '10px 0 0 0' }}>
                <StickyNote size={11} aria-hidden="true" /> Exports the full inspection {inspection.id} with declarations, findings and evidence index.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
};
