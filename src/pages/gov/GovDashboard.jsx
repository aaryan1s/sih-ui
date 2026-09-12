import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCard, StatusBadge, Card } from '../../components/common/ui';
import { BarList } from '../../components/common/charts';
import { useStoreData } from '../../services/dataStore';
import { useLanguage } from '../../context/LanguageContext';
import { TrendChart } from '../../components/common/charts';

/* Compliance-rate trend derived from actual inspection dates. */
const buildComplianceTrend = (inspections) => {
  const byMonth = new Map();
  inspections.forEach((i) => {
    if (!i.date) return;
    const key = String(i.date).slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, { total: 0, compliant: 0 });
    const bucket = byMonth.get(key);
    bucket.total += 1;
    if (i.status === 'compliant') bucket.compliant += 1;
  });
  const months = [...byMonth.keys()].sort();
  return {
    months,
    rates: months.map((m) => {
      const b = byMonth.get(m);
      return Math.round((b.compliant / b.total) * 100);
    }),
  };
};

/* Violations-by-category derived from live declaration findings */
const buildCategoryCounts = (inspections) => {
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
    .sort((a, b) => b.count - a.count);
};

export const GovDashboard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const app = t.app;
  // All figures live from the central store
  const inspections = useStoreData('inspections');
  const manufacturers = useStoreData('manufacturers');
  const cases = useStoreData('cases');

  const totalInspections = inspections.length;
  const compliantCount = inspections.filter((i) => i.status === 'compliant').length;
  const complianceRate = totalInspections ? `${Math.round((compliantCount / totalInspections) * 100)}%` : '—';
  const totalViolations = inspections.reduce(
    (sum, i) => sum + i.declarations.filter((d) => d.violation_type).length,
    0
  );
  const openCases = cases.filter((c) => c.status === 'under_review');
  const highRisk = manufacturers.filter((m) => m.risk.level === 'HIGH' || m.risk.level === 'CRITICAL');
  const categoryCounts = buildCategoryCounts(inspections);
  const trend = buildComplianceTrend(inspections);

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{app.titleGovDashboard}</h1>
          <p className="app-page-subtitle">{app.subtitleGovDashboard}</p>
        </div>
      </header>

      <div className="stat-grid">
        <StatCard value={totalInspections} label={app.statTotalInspections} hint={app.hintDepartmentWide} accent="blue" />
        <StatCard value={complianceRate} label={app.statComplianceRate} hint={app.hintComplianceRate} accent="green" />
        <StatCard value={totalViolations} label={app.statDeclarationViolations} hint={app.hintAcrossInspections} accent="red" />
        <StatCard value={openCases.length} label={app.statOpenCases} hint={app.hintAwaitingDecision} accent="amber" />
      </div>
      <div className="stat-grid">
        <StatCard value={manufacturers.length} label={app.statManufacturers} hint={app.hintRegistered} accent="blue" />
        <StatCard value={highRisk.length} label={app.statHighRisk} hint={app.hintHighRisk} accent="red" />
        <StatCard value={cases.filter((c) => c.status === 'action_taken').length} label={app.statActionsRecorded} hint={app.hintEnforcement} accent="amber" />
        <StatCard value={new Set(inspections.map((i) => i.inspector)).size} label={app.statActiveInspectors} hint={app.hintFiledInspections} accent="blue" />
      </div>

      <div className="dashboard-grid">
        <Card title={app.cardComplianceTrend}>
          {trend.months.length > 0 ? (
            <TrendChart
              months={trend.months}
              series={[{ label: 'Compliance rate', data: trend.rates }]}
              ariaLabel="Department compliance rate per month, derived from filed inspections"
            />
          ) : (
            <p className="app-footnote">{app.emptyTrendPending}</p>
          )}
        </Card>
        <Card title={app.cardViolationsByCategory}>
          {categoryCounts.length > 0 ? (
            <BarList items={categoryCounts} color="linear-gradient(90deg, #09396f, #2563eb)" />
          ) : (
            <p className="app-footnote">{app.emptyNoViolations}</p>
          )}
        </Card>
      </div>

      <div className="dashboard-grid">
        <section>
          <h3 className="app-card-title">High-Risk Manufacturers Watchlist</h3>
          <div className="quick-actions">
            {highRisk.length > 0 ? (
              highRisk.map((manufacturer) => (
                <button key={manufacturer.id} type="button" className="quick-action-btn" onClick={() => navigate(`/gov/manufacturers/${manufacturer.id}`)}>
                  <span className="quick-action-icon" style={{ background: 'var(--status-bad-soft)', color: 'var(--status-bad)' }}>
                    ⬤
                  </span>
                  <span>
                    <strong style={{ display: 'block', fontSize: 13 }}>{manufacturer.legalName}</strong>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{manufacturer.violationCount} violations · risk {manufacturer.risk.level}</span>
                  </span>
                </button>
              ))
            ) : (
              <p className="app-footnote">No high-risk manufacturers on record.</p>
            )}
          </div>
        </section>

        <section>
          <h3 className="app-card-title">Open Enforcement Cases</h3>
          <div className="quick-actions">
            {openCases.length > 0 ? (
              openCases.map((item) => (
                <button key={item.id} type="button" className="quick-action-btn" onClick={() => navigate(`/gov/cases/${item.id}`)}>
                  <span className="quick-action-icon" style={{ background: 'var(--status-warn-soft)', color: 'var(--status-warn)' }}>
                    <StatusBadge status={item.severity === 'severe' ? 'severe' : 'warning'} label={item.severity === 'severe' ? 'SEVERE' : 'MAJOR'} />
                  </span>
                  <span>
                    <strong style={{ display: 'block', fontSize: 13 }}>{item.id}</strong>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{item.manufacturer} · {item.opened}</span>
                  </span>
                </button>
              ))
            ) : (
              <p className="app-footnote">No open cases — all flagged cases have recorded decisions.</p>
            )}
          </div>
        </section>
      </div>

      <section>
        <h3 className="app-card-title">Recent Inspections — Department-wide</h3>
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>ID</th>
                <th style={{ width: '130px' }}>Inspector</th>
                <th>Product</th>
                <th>Manufacturer</th>
                <th style={{ width: '150px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {inspections.slice(0, 6).map((row) => (
                <tr key={row.id} onClick={() => navigate(`/gov/inspections/${row.id}`)} style={{ cursor: 'pointer' }}>
                  <td><span className="table-link">{row.id}</span></td>
                  <td>{row.inspector}</td>
                  <td>{row.product}</td>
                  <td>{row.manufacturer}</td>
                  <td><StatusBadge status={row.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
};
