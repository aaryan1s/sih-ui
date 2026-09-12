import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Camera, FileDown, FileEdit } from 'lucide-react';
import { Card, StatusBadge, EmptyState } from '../../components/common/ui';
import { InspectionResultTables } from '../../components/inspection/InspectionResultTables';
import { useStoreData } from '../../services/dataStore';
import { reportsService } from '../../services/reportsService';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

export const GovInspectionDetail = () => {
  const { id } = useParams();
  const toast = useToast();
  const { t } = useLanguage();
  const app = t.app;
  const inspections = useStoreData('inspections');
  const inspection = inspections.find((item) => item.id === id);

  if (!inspection) {
    return (
      <EmptyState
        icon={<Camera size={20} aria-hidden="true" />}
        title={app.inspectionNotFound}
        subtitle={`${app.noInspectionForId} ${id}`}
        action={<Link className="app-btn app-btn-secondary app-btn-sm" to="/gov/inspections">{app.backToMonitoring}</Link>}
      />
    );
  }

  const download = async (format) => {
    try {
      await reportsService.downloadReport(inspection, { format });
      toast.ok(`${format.toUpperCase()} report downloaded for ${inspection.id}.`);
    } catch (error) {
      toast.error(error.message || app.analysisFailed);
    }
  };

  return (
    <>
      <header className="app-page-header">
        <div>
          <Link to="/gov/inspections" className="table-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
            <ArrowLeft size={13} aria-hidden="true" /> {app.inspectionMonitoring}
          </Link>
          <h1 className="app-page-title" style={{ marginTop: 6 }}>{inspection.id} — {inspection.product}</h1>
          <p className="app-page-subtitle">
            {inspection.manufacturer} · {inspection.date} {inspection.time} · {app.colInspector} {inspection.inspector} · {app.viewOnly}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={() => download('pdf')}>
            <FileDown size={14} aria-hidden="true" /> {app.downloadPdf.replace('Download ', '')}
          </button>
          <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={() => download('doc')}>
            <FileEdit size={14} aria-hidden="true" /> {app.btnEditable}
          </button>
          <StatusBadge status={inspection.status} />
        </div>
      </header>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <InspectionResultTables inspection={inspection} />
        </div>

        <Card title={app.cardEvidence}>
          <div className="quick-actions">
            {inspection.evidence.map((item) => (
              <div key={item.id} className="quick-action-btn" style={{ cursor: 'default' }}>
                <span className="quick-action-icon"><Camera size={16} aria-hidden="true" /></span>
                <span>
                  <strong style={{ display: 'block', fontSize: 12.5 }}>{item.label}</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{item.note || '—'}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
};
