import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Camera, FileDown, FileEdit } from 'lucide-react';
import { Card, StatusBadge, EmptyState } from '../../components/common/ui';
import { InspectionResultTables } from '../../components/inspection/InspectionResultTables';
import { useStoreData } from '../../services/dataStore';
import { reportsService } from '../../services/reportsService';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

export const InspectionDetail = () => {
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
        action={<Link className="app-btn app-btn-secondary app-btn-sm" to="/inspector/inspections">{app.backToHistory}</Link>}
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
          <Link to="/inspector/inspections" className="table-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
            <ArrowLeft size={13} aria-hidden="true" /> {app.navInspections}
          </Link>
          <h1 className="app-page-title" style={{ marginTop: 6 }}>{inspection.id} — {inspection.product}</h1>
          <p className="app-page-subtitle">
            {inspection.manufacturer} · {inspection.date} {inspection.time} · {app.colInspector} {inspection.inspector}
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
          {inspection.evidence.length === 0 ? (
            <p className="app-footnote">{app.noEvidenceAttached}</p>
          ) : (
            <div className="evidence-grid">
              {inspection.evidence.map((item) => (
                <figure key={item.id} className="evidence-photo">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <img src={item.url} alt={`Evidence: ${item.label}`} loading="lazy" />
                    </a>
                  ) : (
                    <span className="evidence-empty">{app.notProvided}</span>
                  )}
                  <figcaption>
                    {item.label}
                    {item.note && <span className="evidence-note">{item.note}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
};
