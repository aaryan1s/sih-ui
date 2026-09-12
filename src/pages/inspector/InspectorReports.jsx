import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle2, XCircle, PackageSearch, FileDown, FileEdit } from 'lucide-react';
import { Card, StatusBadge, DataTable, EmptyState } from '../../components/common/ui';
import { DonutChart, BarList } from '../../components/common/charts';
import { useToast } from '../../context/ToastContext';
import { useStoreData } from '../../services/dataStore';
import { reportsService } from '../../services/reportsService';
import { useLanguage } from '../../context/LanguageContext';
import { INSPECTION_STATUS } from '../../data/mockData';

/* Reference screen 10b — top non-compliance issues derived live from violations */
const buildTopIssues = (inspections) => {
  const counts = new Map();
  inspections.forEach((inspection) =>
    inspection.declarations.forEach((declaration) => {
      if (!declaration.violation_type) return;
      const label = declaration.name;
      counts.set(label, (counts.get(label) || 0) + 1);
    })
  );
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
};

export const InspectorReports = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const inspections = useStoreData('inspections');
  const reports = useStoreData('reports');
  const { t } = useLanguage();
  const app = t.app;

  // Derived live from the store — new inspections change every figure
  const compliantCount = inspections.filter((r) => r.status === INSPECTION_STATUS.compliant).length;
  const nonCompliantCount = inspections.filter((r) => r.status === INSPECTION_STATUS.non_compliant).length;
  const otherCount = inspections.length - compliantCount - nonCompliantCount;
  const totalInspections = inspections.length;
  const complianceRate = totalInspections ? `${Math.round((compliantCount / totalInspections) * 100)}%` : '—';
  const topIssues = buildTopIssues(inspections);

  const download = async (report) => {
    const inspection = inspections.find((i) => i.id === report.inspectionId);
    if (!inspection) {
      toast.error('The linked inspection record could not be found.');
      return;
    }
    try {
      await reportsService.downloadReport(inspection, { format: 'pdf' });
      toast.ok(`PDF report downloaded for ${report.inspectionId}.`);
    } catch (error) {
      toast.error(error.message || 'The report could not be generated. Try again.');
    }
  };

  const columns = [
    { key: 'id', label: 'Report ID', width: '140px' },
    { key: 'inspectionId', label: 'Inspection', width: '110px' },
    { key: 'product', label: 'Product' },
    { key: 'establishment', label: 'Establishment', width: '150px' },
    { key: 'date', label: 'Date', width: '110px' },
    { key: 'status', label: 'Status', width: '145px' },
    { key: 'download', label: 'Download', width: '170px' },
  ];

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{app.titleReports}</h1>
          <p className="app-page-subtitle">Insights from inspection data — your own records only.</p>
        </div>
      </header>

      <div className="stat-grid">
        <div className="stat-card stat-card-chip stat-accent-blue">
          <span className="stat-card-chip-icon"><ClipboardList size={18} aria-hidden="true" /></span>
          <span className="stat-card-value">{totalInspections}</span>
          <span className="stat-card-label">Total Inspections</span>
          <span className="stat-card-hint">Live from inspection records</span>
        </div>
        <div className="stat-card stat-card-chip stat-accent-green">
          <span className="stat-card-chip-icon"><CheckCircle2 size={18} aria-hidden="true" /></span>
          <span className="stat-card-value">{complianceRate}</span>
          <span className="stat-card-label">Compliance Rate</span>
          <span className="stat-card-hint">Compliant ÷ total inspections</span>
        </div>
        <div className="stat-card stat-card-chip stat-accent-red">
          <span className="stat-card-chip-icon"><XCircle size={18} aria-hidden="true" /></span>
          <span className="stat-card-value">{nonCompliantCount}</span>
          <span className="stat-card-label">Non-Compliant</span>
          <span className="stat-card-hint">Across all inspections</span>
        </div>
        <div className="stat-card stat-card-chip stat-accent-amber">
          <span className="stat-card-chip-icon"><PackageSearch size={18} aria-hidden="true" /></span>
          <span className="stat-card-value">{reports.length}</span>
          <span className="stat-card-label">Reports Generated</span>
          <span className="stat-card-hint">One per submitted inspection</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <Card title="Compliance Distribution">
          <div className="donut-with-legend">
            <DonutChart
              segments={[
                { label: 'Compliant', value: compliantCount, color: 'var(--status-ok)' },
                { label: 'Non-Compliant', value: nonCompliantCount, color: 'var(--status-bad)' },
                { label: 'Other', value: otherCount, color: 'var(--status-warn)' },
              ]}
              centerLabel={String(totalInspections)}
              centerSub="inspections"
              ariaLabel={`Compliance distribution: ${compliantCount} compliant, ${nonCompliantCount} non-compliant, ${otherCount} other`}
            />
            <ul className="donut-legend">
              <li><i className="legend-dot" style={{ background: 'var(--status-ok)' }} /> Compliant <strong>{totalInspections ? Math.round((compliantCount / totalInspections) * 100) : 0}%</strong></li>
              <li><i className="legend-dot" style={{ background: 'var(--status-bad)' }} /> Non-Compliant <strong>{totalInspections ? Math.round((nonCompliantCount / totalInspections) * 100) : 0}%</strong></li>
              <li><i className="legend-dot" style={{ background: 'var(--status-warn)' }} /> Warning / Review <strong>{totalInspections ? Math.round((otherCount / totalInspections) * 100) : 0}%</strong></li>
            </ul>
          </div>
        </Card>

        <Card title="Top Non-Compliance Issues">
          {topIssues.length > 0 ? (
            <BarList items={topIssues} />
          ) : (
            <EmptyState title="No violations recorded" subtitle="Every checked declaration passed." />
          )}
          <p className="app-footnote">Derived from declaration-level findings — full analytics remain a government-portal capability.</p>
        </Card>
      </div>

      <section>
        <h3 className="app-card-title">Inspection Reports</h3>
        <DataTable
          columns={columns}
          rows={reports}
          renderRow={(row) => (
            <tr key={row.id}>
              <td><span className="table-link" onClick={() => navigate(`/inspector/inspections/${row.inspectionId}`)} role="button" tabIndex={0}>{row.id}</span></td>
              <td>{row.inspectionId}</td>
              <td>{row.product}</td>
              <td>{row.establishment || '—'}</td>
              <td>{row.date}</td>
              <td><StatusBadge status={row.status} /></td>
              <td>
                <span className="report-download-row">
                  <button
                    type="button"
                    className="icon-action-btn"
                    aria-label={`Download PDF for ${row.id}`}
                    onClick={() => download(row)}
                  >
                    <FileDown size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-action-btn"
                    aria-label={`Download editable report for ${row.id}`}
                    onClick={async () => {
                      const inspection = inspections.find((i) => i.id === row.inspectionId);
                      if (inspection) {
                        try {
                          await reportsService.downloadReport(inspection, { format: 'doc' });
                          toast.ok(`Editable report downloaded for ${row.inspectionId}.`);
                        } catch (error) {
                          toast.error(error.message || 'The report could not be generated. Try again.');
                        }
                      }
                    }}
                  >
                    <FileEdit size={15} aria-hidden="true" />
                  </button>
                </span>
              </td>
            </tr>
          )}
        />
        {reports.length === 0 && <EmptyState title="No reports yet" subtitle="Submit an inspection to generate its report." />}
      </section>
    </>
  );
};
