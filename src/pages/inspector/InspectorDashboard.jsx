import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ClipboardList, ScanSearch, Building2, FileText, ChevronRight, Search, CheckCircle2, XCircle, FileCheck } from 'lucide-react';
import { StatusBadge, Card } from '../../components/common/ui';
import { TrendChart } from '../../components/common/charts';
import { useStoreData } from '../../services/dataStore';
import { useLanguage } from '../../context/LanguageContext';

const PENDING = ['under_review', 'warning'];

/* Trend derived from actual inspection dates — no synthetic series. */
const buildTrend = (inspections) => {
  const byMonth = new Map();
  inspections.forEach((i) => {
    if (!i.date) return;
    const key = String(i.date).slice(0, 7); // YYYY-MM
    byMonth.set(key, (byMonth.get(key) || 0) + 1);
  });
  const months = [...byMonth.keys()].sort();
  return {
    months,
    counts: months.map((m) => byMonth.get(m)),
  };
};

export const InspectorDashboard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const app = t.app;
  // Live from the central store — new submissions update every card instantly
  const inspections = useStoreData('inspections');

  const stats = {
    total: inspections.length,
    compliant: inspections.filter((i) => i.status === 'compliant').length,
    nonCompliant: inspections.filter((i) => i.status === 'non_compliant').length,
    pending: inspections.filter((i) => PENDING.includes(i.status)).length,
  };
  const trend = buildTrend(inspections);

  const STAT_CARDS = [
    { icon: ClipboardList, value: stats.total, label: app.statInspections, hint: app.statAllRecords, accent: 'blue' },
    { icon: CheckCircle2, value: stats.compliant, label: app.statCompliant, accent: 'green' },
    { icon: XCircle, value: stats.nonCompliant, label: app.statNonCompliant, accent: 'red' },
    { icon: FileCheck, value: stats.pending, label: app.statPending, accent: 'amber' },
  ];

  const quickActions = [
    { icon: ScanSearch, label: 'Scan Product', sub: 'Start a new inspection', to: '/inspector/inspections/new' },
    { icon: Search, label: 'Search Product', sub: 'Check previous records', to: '/inspector/inspections' },
    { icon: FileText, label: 'Generate Report', sub: 'Create compliance report', to: '/inspector/reports' },
    { icon: Building2, label: 'Manufacturer Lookup', sub: 'Verify before you inspect', to: '/inspector/manufacturers' },
  ];

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{app.titleDashboard}</h1>
          <p className="app-page-subtitle">{app.welcomeBack}</p>
        </div>
        <button type="button" className="app-btn app-btn-primary" onClick={() => navigate('/inspector/inspections/new')}>
          <ClipboardList size={16} aria-hidden="true" /> {app.navNewInspection}
        </button>
      </header>

      {/* Icon-chip stat cards (reference screen 2) */}
      <div className="stat-grid">
        {STAT_CARDS.map(({ icon: Icon, ...card }) => (
          <div key={card.label} className={`stat-card stat-card-chip stat-accent-${card.accent}`}>
            <span className="stat-card-chip-icon"><Icon size={18} aria-hidden="true" /></span>
            <span className="stat-card-value">{card.value}</span>
            <span className="stat-card-label">{card.label}</span>
            {card.hint && <span className="stat-card-hint">{card.hint}</span>}
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <Card title="Inspections Trend — per month (from your records)">
          {trend.months.length > 0 ? (
            <>
              <TrendChart
                months={trend.months}
                series={[{ label: 'Inspections', data: trend.counts }]}
                ariaLabel="Inspections recorded per month, derived from your filed inspections"
              />
              <div className="chart-legend">
                <span><i className="legend-dot" style={{ background: 'var(--accent-blue)' }} /> Inspections filed</span>
              </div>
            </>
          ) : (
            <p className="app-footnote">No inspections recorded yet — the trend appears as you file inspections.</p>
          )}
        </Card>

        <section>
          <div className="app-card-title-row">
            <h3 className="app-card-title" style={{ margin: 0 }}>Recent Inspections</h3>
            <Link to="/inspector/inspections" className="table-link" style={{ fontSize: 12.5 }}>View All</Link>
          </div>
          <div className="recent-inspection-list">
            {inspections.length === 0 && (
              <p className="app-footnote">No inspections yet — your submissions appear here.</p>
            )}
            {inspections.slice(0, 4).map((row) => (
              <button key={row.id} type="button" className="recent-inspection-item" onClick={() => navigate(`/inspector/inspections/${row.id}`)}>
                <span className="quick-action-icon"><FileText size={15} aria-hidden="true" /></span>
                <span className="recent-inspection-meta">
                  <strong>{row.id} · {row.product}</strong>
                  <span>{row.manufacturer} · {row.date}</span>
                </span>
                <StatusBadge status={row.status} />
              </button>
            ))}
          </div>
        </section>
      </div>

      <section>
        <h3 className="app-card-title">Quick Actions</h3>
        <div className="quick-actions-grid">
          {quickActions.map(({ icon: Icon, label, sub, to }) => (
            <button key={label} type="button" className="quick-action-tile" onClick={() => navigate(to)}>
              <span className="quick-action-icon"><Icon size={17} aria-hidden="true" /></span>
              <strong>{label}</strong>
              <span className="quick-action-sub">{sub}</span>
              <ChevronRight size={14} className="quick-action-chevron" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </>
  );
};
