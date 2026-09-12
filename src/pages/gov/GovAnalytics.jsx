import React, { useMemo, useState } from 'react';
import { Card, EmptyState } from '../../components/common/ui';
import { DonutChart, BarList } from '../../components/common/charts';
import { useStoreData } from '../../services/dataStore';
import { useLanguage } from '../../context/LanguageContext';

/* Department Analytics — every figure derived live from the central store.
   The period filter recomputes all aggregates. Geographic breakdown appears
   only where location data actually exists (manufacturer address state). */

const PERIODS = [
  { id: 'all', label: 'All time', days: null },
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '7', label: 'Last 7 days', days: 7 },
];

const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Computed once at module load — a period cutoff, not render state
const CUTOFF_DAYS_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

const stateFromAddress = (address) => {
  // Address convention: "…, State - PIN" — extract the state token.
  // Null/empty addresses (real records often lack them) are honest "Unknown".
  if (!address || typeof address !== 'string') return 'Unknown';
  const parts = address.split(',').map((part) => part.trim());
  if (parts.length >= 2) return parts[parts.length - 2].replace(/\s*-\s*\d+.*$/, '').trim();
  return 'Unknown';
};

export const GovAnalytics = () => {
  const { t } = useLanguage();
  const app = t.app;
  const inspections = useStoreData('inspections');
  const manufacturers = useStoreData('manufacturers');
  const [period, setPeriod] = useState('all');

  const scoped = useMemo(() => {
    const days = PERIODS.find((p) => p.id === period)?.days;
    if (!days) return inspections;
    const cutoff = NOW - days * CUTOFF_DAYS_MS;
    return inspections.filter((i) => {
      const date = parseDate(i.date);
      return date ? date.getTime() >= cutoff : false;
    });
  }, [inspections, period]);

  const total = scoped.length;
  const compliant = scoped.filter((i) => i.status === 'compliant').length;
  const nonCompliant = scoped.filter((i) => i.status === 'non_compliant').length;
  const other = total - compliant - nonCompliant;

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    scoped.forEach((inspection) =>
      inspection.declarations.forEach((declaration) => {
        if (!declaration.violation_type) return;
        counts.set(declaration.name, (counts.get(declaration.name) || 0) + 1);
      })
    );
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [scoped]);

  const repeatOffenders = useMemo(
    () =>
      manufacturers
        .map((m) => ({
          name: m.legalName,
          violations: scoped.filter((i) => i.manufacturerId === m.id).reduce(
            (sum, i) => sum + i.declarations.filter((d) => d.violation_type).length,
            0
          ),
          inspections: scoped.filter((i) => i.manufacturerId === m.id).length,
        }))
        .filter((m) => m.violations > 0)
        .sort((a, b) => b.violations - a.violations)
        .slice(0, 5)
        .map((m) => ({ label: m.name, count: m.violations })),
    [manufacturers, scoped]
  );

  const geographic = useMemo(() => {
    const byState = new Map();
    scoped.forEach((inspection) => {
      const manufacturer = manufacturers.find((m) => m.id === inspection.manufacturerId);
      const state = stateFromAddress(manufacturer?.address);
      const violations = inspection.declarations.filter((d) => d.violation_type).length;
      byState.set(state, (byState.get(state) || 0) + violations);
    });
    return [...byState.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [manufacturers, scoped]);

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{app.titleAnalytics}</h1>
          <p className="app-page-subtitle">Derived live from department inspection records — filters recompute every figure.</p>
        </div>
        <select className="app-select" value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Analysis period">
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </header>

      <div className="stat-grid">
        <Card className="stat-card stat-accent-blue"><span className="stat-card-value">{total}</span><span className="stat-card-label">Inspections in period</span></Card>
        <Card className="stat-card stat-accent-green"><span className="stat-card-value">{total ? `${Math.round((compliant / total) * 100)}%` : '—'}</span><span className="stat-card-label">Compliance rate</span></Card>
        <Card className="stat-card stat-accent-red"><span className="stat-card-value">{categoryCounts.reduce((s, c) => s + c.count, 0)}</span><span className="stat-card-label">Violations</span></Card>
        <Card className="stat-card stat-accent-amber"><span className="stat-card-value">{repeatOffenders.length}</span><span className="stat-card-label">Manufacturers with violations</span></Card>
      </div>

      <div className="dashboard-grid">
        <Card title="Compliance Distribution">
          {total > 0 ? (
            <div className="donut-with-legend">
              <DonutChart
                segments={[
                  { label: 'Compliant', value: compliant, color: 'var(--status-ok)' },
                  { label: 'Non-Compliant', value: nonCompliant, color: 'var(--status-bad)' },
                  { label: 'Warning / Review', value: other, color: 'var(--status-warn)' },
                ]}
                centerLabel={String(total)}
                centerSub="inspections"
                ariaLabel="Compliance distribution for the selected period"
              />
              <ul className="donut-legend">
                <li><i className="legend-dot" style={{ background: 'var(--status-ok)' }} /> Compliant <strong>{compliant}</strong></li>
                <li><i className="legend-dot" style={{ background: 'var(--status-bad)' }} /> Non-Compliant <strong>{nonCompliant}</strong></li>
                <li><i className="legend-dot" style={{ background: 'var(--status-warn)' }} /> Warning / Review <strong>{other}</strong></li>
              </ul>
            </div>
          ) : (
            <EmptyState title="No inspections in this period" subtitle="Widen the period filter to see analytics." />
          )}
        </Card>

        <Card title="Violations by Category">
          {categoryCounts.length > 0 ? (
            <BarList items={categoryCounts} color="linear-gradient(90deg, #09396f, #2563eb)" />
          ) : (
            <EmptyState title="No violations in this period" />
          )}
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card title="Repeat Offenders — top 5 by violations">
          {repeatOffenders.length > 0 ? (
            <BarList items={repeatOffenders} />
          ) : (
            <EmptyState title="No repeat offenders in this period" />
          )}
        </Card>

        <Card title="Violations by Manufacturer Location (state)">
          {geographic.length > 0 ? (
            <BarList items={geographic} color="var(--status-warn)" />
          ) : (
            <EmptyState title="No location data in this period" />
          )}
        </Card>
      </div>

      <p className="app-footnote">
        Aggregate trend series (week-over-week compliance) arrive with the backend phase, where historical
        aggregates are precomputed server-side; the figures above are computed live from raw records.
      </p>
    </>
  );
};
