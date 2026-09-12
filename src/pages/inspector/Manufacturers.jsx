import React, { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, ShieldCheck, Search, X, Info } from 'lucide-react';
import { Card, StatusBadge, DataTable, EmptyState } from '../../components/common/ui';
import { useStoreData } from '../../services/dataStore';
import { useLanguage } from '../../context/LanguageContext';

const RISK_LABELS = { LOW: 'low', MODERATE: 'moderate', HIGH: 'high', CRITICAL: 'critical', UNRATED: 'unknown' };

export const ManufacturerList = () => {
  const navigate = useNavigate();
  const manufacturers = useStoreData('manufacturers');
  const { t } = useLanguage();
  const app = t.app;
  const [query, setQuery] = useState('');

  // Client-side filter over the single store source (debounce unnecessary at
  // this dataset size — the list is already fully loaded).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return manufacturers;
    return manufacturers.filter(
      (m) =>
        (m.legalName || '').toLowerCase().includes(q) ||
        (m.tradeName || '').toLowerCase().includes(q) ||
        (m.gstin || '').toLowerCase().includes(q) ||
        (m.license?.number || m.licenseNumber || '').toLowerCase().includes(q)
    );
  }, [manufacturers, query]);

  const columns = [
    { key: 'name', label: 'Manufacturer' },
    { key: 'gstin', label: 'GSTIN', width: '170px' },
    { key: 'license', label: 'License', width: '140px' },
    { key: 'inspections', label: 'Inspections', width: '110px' },
    { key: 'violations', label: 'Violations', width: '100px' },
    { key: 'risk', label: 'Risk', width: '120px' },
  ];

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{app.titleManufacturerLookup}</h1>
          <p className="app-page-subtitle">{app.subtitleManufacturerLookup}</p>
        </div>
      </header>
      {manufacturers.length > 0 && (
        <div className="history-search" style={{ maxWidth: 420 }}>
          <Search size={14} className="history-search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder={app.searchMfrPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={app.searchMfrAria}
          />
          {query && (
            <button type="button" className="repository-clear" onClick={() => setQuery('')} aria-label={app.clearSearch}>
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      {manufacturers.length === 0 ? (
        <EmptyState
          icon={<Building2 size={20} aria-hidden="true" />}
          title={app.mfrNoRecordsYet}
          subtitle={app.mfrNoRecordsSub}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={app.mfrNoMatches}
          subtitle={`${app.mfrNothingFound} "${query}"`}
          action={
            <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={() => setQuery('')}>
              {app.clearSearch}
            </button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          renderRow={(row) => (
            <tr key={row.id} onClick={() => navigate(`/inspector/manufacturers/${row.id}`)} style={{ cursor: 'pointer' }}>
              <td><span className="table-link">{row.legalName}</span></td>
              <td>{row.gstin || '—'}</td>
              <td><StatusBadge status={RISK_LABELS[row.license?.status] === 'low' ? 'ok' : 'unknown'} label={`● ${(row.license?.status || 'unverified').replace('_', ' ')}`} /></td>
              <td>{row.inspectionCount ?? 0}</td>
              <td>{row.violationCount ?? 0}</td>
              <td><StatusBadge status={RISK_LABELS[row.risk?.level] || 'unknown'} label={row.risk?.level || 'UNRATED'} /></td>
            </tr>
          )}
        />
      )}
    </>
  );
};

export const ManufacturerProfile = () => {
  const { id } = useParams();
  const manufacturers = useStoreData('manufacturers');
  const inspections = useStoreData('inspections');
  const { t } = useLanguage();
  const app = t.app;
  const manufacturer = manufacturers.find((item) => item.id === id);
  const linkedInspections = inspections.filter((item) => item.manufacturerId === id);

  if (!manufacturer) {
    return (
      <EmptyState
        icon={<Building2 size={20} aria-hidden="true" />}
        title="Manufacturer not found"
        action={<Link className="app-btn app-btn-secondary app-btn-sm" to="/inspector/manufacturers">Back to lookup</Link>}
      />
    );
  }

  /* Explainable risk profile — derived from this manufacturer's own recorded
     inspections/violations, never an opaque score. Mirrors deriveRiskLevel. */
  const level = manufacturer.risk?.level || 'UNRATED';
  const factors = [
    {
      name: 'Inspections recorded',
      detail: `${manufacturer.inspectionCount ?? 0} inspection(s) reference this manufacturer.`,
    },
    {
      name: 'Declaration violations',
      detail: `${manufacturer.violationCount ?? 0} failed declaration check(s) across those inspections.`,
    },
    {
      name: 'Record status',
      detail:
        manufacturer.source === 'inspection'
          ? 'Provisional record created automatically from inspection data; pending department verification.'
          : 'Department-maintained official record.',
    },
  ];

  return (
    <>
      <header className="app-page-header">
        <div>
          <Link to="/inspector/manufacturers" className="table-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
            <ArrowLeft size={13} aria-hidden="true" /> Manufacturer Lookup
          </Link>
          <h1 className="app-page-title" style={{ marginTop: 6 }}>{manufacturer.legalName}</h1>
          <p className="app-page-subtitle">{manufacturer.tradeName || manufacturer.legalName}{manufacturer.gstin ? ` · GSTIN ${manufacturer.gstin}` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatusBadge status="unknown" label={`License: ${(manufacturer.license?.status || 'unverified').replace('_', ' ')}`} />
          <StatusBadge status={RISK_LABELS[level] || 'unknown'} label={`Risk: ${level}`} />
        </div>
      </header>

      <div className="dashboard-grid">
        <Card title={app.recordDetails}>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 10, fontSize: 13 }}>
            <dt style={{ color: 'var(--text-muted)' }}>{app.registeredAddress}</dt>
            <dd style={{ margin: 0 }}>{manufacturer.address || app.notProvided}</dd>
            <dt style={{ color: 'var(--text-muted)' }}>GSTIN</dt>
            <dd style={{ margin: 0 }}>{manufacturer.gstin || app.notProvided}</dd>
            <dt style={{ color: 'var(--text-muted)' }}>{app.license}</dt>
            <dd style={{ margin: 0 }}>{(manufacturer.license?.status || 'unverified').replace('_', ' ')}</dd>
          </dl>
          {manufacturer.source === 'inspection' && (
            <p style={{ fontSize: 11.5, color: 'var(--text-subtle)', marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={13} aria-hidden="true" />
              Provisional record built from inspection data — the department can verify and complete it.
            </p>
          )}
          <p style={{ fontSize: 11.5, color: 'var(--text-subtle)', marginTop: 10 }}>
            Inspectors cannot change official manufacturer details, license status, or enforcement records.
          </p>
        </Card>

        <Card title={app.riskProfile}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {factors.map((factor) => (
              <div key={factor.name}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{factor.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{factor.detail}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-body)', background: 'var(--status-unknown-soft)', borderRadius: 'var(--radius-md)', padding: '10px 12px', margin: 0, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <ShieldCheck size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Classified {level} from the recorded history above — {level === 'UNRATED'
                ? 'no completed inspections yet.'
                : `${manufacturer.violationCount ?? 0} violation(s) across ${manufacturer.inspectionCount ?? 0} inspection(s).`}
            </span>
          </p>
        </Card>
      </div>

      <section>
        <h3 className="app-card-title">{app.inspectionHistoryCount} ({linkedInspections.length})</h3>
        {linkedInspections.length > 0 ? (
          <DataTable
            columns={[
              { key: 'id', label: 'ID', width: '110px' },
              { key: 'date', label: 'Date', width: '110px' },
              { key: 'product', label: 'Product' },
              { key: 'status', label: 'Status', width: '150px' },
            ]}
            rows={linkedInspections}
            renderRow={(row) => (
              <tr key={row.id}>
                <td><Link className="table-link" to={`/inspector/inspections/${row.id}`}>{row.id}</Link></td>
                <td>{row.date}</td>
                <td>{row.product}</td>
                <td><StatusBadge status={row.status} /></td>
              </tr>
            )}
          />
        ) : (
          <EmptyState title={app.noInspectionsRecorded} subtitle={app.mfrNotInspected} />
        )}
      </section>
    </>
  );
};
