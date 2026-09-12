import React from 'react';
import { CheckCircle2, FileDown, FileEdit } from 'lucide-react';
import { Card, DataTable, StatusBadge, EmptyState } from '../../components/common/ui';
import { useStoreData } from '../../services/dataStore';
import { reportsService } from '../../services/reportsService';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

const makePlaceholder = (title, subtitle, deliverables) => {
  const Page = () => (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{title}</h1>
          <p className="app-page-subtitle">{subtitle}</p>
        </div>
      </header>
      <Card className="placeholder-panel">
        <p style={{ fontSize: 13, color: 'var(--text-body)', margin: 0 }}>
          Scaffolded per the approved plan — completed in a later phase of the roadmap.
        </p>
        <ul className="placeholder-checklist">
          {deliverables.map((item) => (
            <li key={item}>
              <CheckCircle2 size={15} aria-hidden="true" /> {item}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
  Page.displayName = `Placeholder(${title})`;
  return Page;
};

/** Department Reports — functional: list live report records and export the
 * linked inspection as PDF / editable file (same service as the inspector). */
export const GovReports = () => {
  const toast = useToast();
  const reports = useStoreData('reports');
  const inspections = useStoreData('inspections');
  const { t } = useLanguage();
  const app = t.app;

  const download = async (report, format) => {
    const inspection = inspections.find((i) => i.id === report.inspectionId);
    if (!inspection) {
      toast.error('The linked inspection record could not be found.');
      return;
    }
    try {
      await reportsService.downloadReport(inspection, { format });
      toast.ok(`${format.toUpperCase()} report downloaded for ${report.inspectionId}.`);
    } catch (error) {
      toast.error(error.message || 'The report could not be generated. Try again.');
    }
  };

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{app.titleGovReports}</h1>
          <p className="app-page-subtitle">Every submitted inspection generates a report record — export any of them.</p>
        </div>
      </header>
      {reports.length === 0 ? (
        <EmptyState title="No reports yet" subtitle="Reports appear here as inspectors submit inspections." />
      ) : (
        <DataTable
          columns={[
            { key: 'id', label: 'Report ID', width: '140px' },
            { key: 'inspectionId', label: 'Inspection', width: '110px' },
            { key: 'product', label: 'Product' },
            { key: 'establishment', label: 'Establishment', width: '150px' },
            { key: 'date', label: 'Date', width: '110px' },
            { key: 'status', label: 'Status', width: '145px' },
            { key: 'download', label: 'Download', width: '170px' },
          ]}
          rows={reports}
          renderRow={(row) => (
            <tr key={row.id}>
              <td><span className="table-link">{row.id}</span></td>
              <td>{row.inspectionId}</td>
              <td>{row.product}</td>
              <td>{row.establishment || '—'}</td>
              <td>{row.date}</td>
              <td><StatusBadge status={row.status} /></td>
              <td>
                <span className="report-download-row">
                  <button type="button" className="icon-action-btn" aria-label={`Download PDF for ${row.id}`} onClick={() => download(row, 'pdf')}>
                    <FileDown size={15} aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-action-btn" aria-label={`Download editable report for ${row.id}`} onClick={() => download(row, 'doc')}>
                    <FileEdit size={15} aria-hidden="true" />
                  </button>
                </span>
              </td>
            </tr>
          )}
        />
      )}
    </>
  );
};

export const GovSettings = makePlaceholder('Settings', 'Profile and preferences.', ['Profile details', 'Language preference (EN / हिंदी)']);
