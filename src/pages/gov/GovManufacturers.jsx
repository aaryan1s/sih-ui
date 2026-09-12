import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Building2, ArrowLeft, Search, X, Plus, Loader2 } from 'lucide-react';
import { Card, StatusBadge, DataTable, EmptyState } from '../../components/common/ui';
import { repo, DATA_BACKEND } from '../../services/repo';
import { useStoreData, manufacturersRepo } from '../../services/dataStore';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

const RISK_LABELS = { LOW: 'low', MODERATE: 'moderate', HIGH: 'high', CRITICAL: 'critical' };

/* ---------- Add Manufacturer modal (working create) ---------- */
const EMPTY_FORM = {
  legalName: '',
  tradeName: '',
  gstin: '',
  address: '',
  contact: '',
  licenseNumber: '',
  categories: '',
};

const AddManufacturerModal = ({ onClose, onCreate }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const panelRef = useRef(null);
  const { t } = useLanguage();
  const app = t.app;
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Esc closes the dialog; focus moves into it on open
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.querySelector('input')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.legalName.trim()) next.legalName = app.legalNameRequired;
    if (!/^\d{2}[A-Z]{5}\d{4}[A-Z]\d{3}[A-Z]$/.test(form.gstin.trim().toUpperCase())) {
      next.gstin = app.gstinInvalid;
    }
    if (!form.address.trim()) next.address = app.addressRequired;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onCreate({
      legalName: form.legalName.trim(),
      tradeName: form.tradeName.trim() || form.legalName.trim(),
      gstin: form.gstin.trim().toUpperCase(),
      address: form.address.trim(),
      contact: form.contact.trim() || '—',
      licenseNumber: form.licenseNumber.trim() || 'Pending allocation',
      categories: form.categories.trim() ? form.categories.split(',').map((c) => c.trim()).filter(Boolean) : [],
    });
  };

  const field = (key, label, placeholder, { required = false, span = false } = {}) => (
    <div className={`form-field-group ${span ? 'wizard-form-span' : ''}`}>
      <label className="form-label" htmlFor={`amf-${key}`}>{label}{required ? ' *' : ''}</label>
      <input id={`amf-${key}`} className={`text-input ${errors[key] ? 'has-error' : ''}`} placeholder={placeholder} value={form[key]} onChange={set(key)} />
      {errors[key] && <p className="field-error" role="alert">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="amf-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h3 id="amf-title">{app.addMfrTitle}</h3>
          <button type="button" className="icon-action-btn" onClick={onClose} aria-label={app.cancel}>
            <X size={15} aria-hidden="true" />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="wizard-form-grid">
            {field('legalName', app.legalNameLabel, app.legalNamePlaceholder, { required: true, span: true })}
            {field('tradeName', app.tradeNameLabel, app.tradeNamePlaceholder)}
            {field('gstin', app.gstinLabel, '06AACCS1234K1Z5', { required: true })}
            {field('licenseNumber', app.licenseNumberLabel, 'LM/HR/2026/0000')}
            {field('contact', app.contactLabel, 'compliance@example.com · +91 …')}
            {field('address', app.registeredAddressLabel, 'Plot 1, Industrial Area, City, State - PIN', { required: true, span: true })}
            {field('categories', app.productCategoriesLabel, app.productCategoriesPlaceholder, { span: true })}
          </div>
          <div className="modal-actions">
            <button type="button" className="app-btn app-btn-secondary" onClick={onClose}>{app.cancel}</button>
            <button type="submit" className="app-btn app-btn-primary">
              <Plus size={15} aria-hidden="true" /> {app.createRecord}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ---------- List (real search: DB in supabase mode, store in local mode) ---------- */
const mapDbManufacturer = (row) => ({
  id: row.id,
  legalName: row.legal_name,
  tradeName: row.trade_name || row.legal_name,
  gstin: row.gstin || '—',
  address: row.address || '—',
  contact: row.contact || '—',
  license: { number: row.license_number || '—', status: row.license_status || 'active' },
  categories: row.categories || [],
  inspectionCount: row.inspection_count ?? 0,
  violationCount: row.violation_count ?? 0,
  risk: {
    level: row.risk_level || 'LOW',
    factors: row.risk_factors || [],
    justification: `${row.risk_level || 'LOW'}: rule-based classification on record history.`,
  },
});

export const GovManufacturerList = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLanguage();
  const app = t.app;
  const localManufacturers = useStoreData('manufacturers');
  const [input, setInput] = useState('');          // what the user typed
  const [query, setQuery] = useState('');          // debounced query
  const [results, setResults] = useState(null);    // null = not loaded yet
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  // Debounce: 350ms after the last keystroke before any query fires
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), 350);
    return () => clearTimeout(timer);
  }, [input]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await repo.searchManufacturers(query);
      setResults(rows);
    } catch (err) {
      setError(err.message || app.retry);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Adapter shape differences: supabase returns snake_case rows, local returns UI shape
  const manufacturers = useMemo(() => {
    if (DATA_BACKEND === 'supabase') return (results || []).map(mapDbManufacturer);
    return results || localManufacturers;
  }, [results, localManufacturers]);

  const create = async (record) => {
    try {
      if (DATA_BACKEND === 'supabase') {
        const { supabase } = await import('../../services/supabaseClient');
        const { error: dbError } = await supabase.from('manufacturers').insert({
          legal_name: record.legalName,
          trade_name: record.tradeName,
          gstin: record.gstin,
          address: record.address,
          contact: record.contact,
          license_number: record.licenseNumber === 'Pending allocation' ? null : record.licenseNumber,
          categories: record.categories,
        });
        if (dbError) throw new Error(dbError.message);
      } else {
        manufacturersRepo.create({
          ...record,
          id: `mfr-${Date.now().toString(36)}`,
          legalName: record.legalName,
          tradeName: record.tradeName || record.legalName,
          gstin: record.gstin || null,
          address: record.address || null,
          license: { status: 'verified' },
          source: 'department', // officer-created: official record
          inspectionCount: 0,
          violationCount: 0,
          risk: { level: 'UNRATED' },
        });
      }
      setShowAdd(false);
      toast.ok(`Manufacturer record created: ${record.legalName}`);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Could not create the record.');
    }
  };

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{app.govMfrTitle}</h1>
          <p className="app-page-subtitle">{app.govMfrSubtitle}</p>
        </div>
        <button type="button" className="app-btn app-btn-primary app-btn-sm" onClick={() => setShowAdd(true)}>
          <Plus size={15} aria-hidden="true" /> {app.addManufacturer}
        </button>
      </header>

      <div className="history-search" style={{ maxWidth: 420 }}>
        <Search size={14} className="history-search-icon" aria-hidden="true" />
        <input
          type="search"
          placeholder={app.searchMfrPlaceholder}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          aria-label={app.searchMfrAria}
        />
        {isLoading && (
          <Loader2 size={14} className="history-search-icon" style={{ left: 'auto', right: 10, animation: 'spin 0.9s linear infinite' }} aria-hidden="true" />
        )}
      </div>

      {error ? (
        <EmptyState
          title="Search failed"
          subtitle={error}
          action={
            <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={loadData}>
              Retry
            </button>
          }
        />
      ) : isLoading && manufacturers.length === 0 ? (
        <EmptyState title={app.loadingManufacturers} />
      ) : manufacturers.length > 0 ? (
        <DataTable
          columns={[
            { key: 'name', label: app.colMfrName },
            { key: 'gstin', label: app.colGstin, width: '170px' },
            { key: 'license', label: app.colLicense, width: '150px' },
            { key: 'inspections', label: app.colInspections, width: '110px' },
            { key: 'violations', label: app.colViolations, width: '100px' },
            { key: 'risk', label: app.colRisk, width: '125px' },
          ]}
          rows={manufacturers}
          renderRow={(row) => (
            <tr key={row.id} onClick={() => navigate(`/gov/manufacturers/${row.id}`)} style={{ cursor: 'pointer' }}>
              <td><span className="table-link">{row.legalName}</span></td>
              <td>{row.gstin || '—'}</td>
              <td><StatusBadge status={row.license?.status === 'verified' ? 'ok' : 'unknown'} label={`● ${(row.license?.status || 'unverified').replace('_', ' ')}`} /></td>
              <td>{row.inspectionCount ?? 0}</td>
              <td>{row.violationCount ?? 0}</td>
              <td><StatusBadge status={RISK_LABELS[row.risk?.level] || 'unknown'} label={row.risk?.level || 'UNRATED'} /></td>
            </tr>
          )}
        />
      ) : (
        <EmptyState
          title={query ? app.mfrNoMatches : app.mfrNoRecordsCreate}
          subtitle={query ? `${app.mfrNothingFound} "${query}"` : app.mfrCreateFirst}
          action={
            query ? (
              <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={() => setInput('')}>
                {app.clearSearch}
              </button>
            ) : undefined
          }
        />
      )}

      {showAdd && <AddManufacturerModal onClose={() => setShowAdd(false)} onCreate={create} />}
    </>
  );
};

/* ---------- Profile ---------- */
export const GovManufacturerProfile = () => {
  const { id } = useParams();
  const { t } = useLanguage();
  const app = t.app;
  const manufacturers = useStoreData('manufacturers');
  const inspections = useStoreData('inspections');
  const manufacturer = manufacturers.find((item) => item.id === id);
  const linkedInspections = inspections.filter((item) => item.manufacturerId === id);

  if (!manufacturer) {
    return (
      <EmptyState
        icon={<Building2 size={20} aria-hidden="true" />}
        title={app.manufacturerNotFound}
        action={<Link className="app-btn app-btn-secondary app-btn-sm" to="/gov/manufacturers">{app.backToManagement}</Link>}
      />
    );
  }

  const violations = linkedInspections.reduce(
    (sum, item) => sum + item.declarations.filter((d) => d.violation_type).length,
    0
  );

  return (
    <>
      <header className="app-page-header">
        <div>
          <Link to="/gov/manufacturers" className="table-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
            <ArrowLeft size={13} aria-hidden="true" /> Manufacturer Management
          </Link>
          <h1 className="app-page-title" style={{ marginTop: 6 }}>{manufacturer.legalName}</h1>
          <p className="app-page-subtitle">{manufacturer.tradeName || manufacturer.legalName}{manufacturer.gstin ? ` · GSTIN ${manufacturer.gstin}` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatusBadge status={manufacturer.license?.status === 'verified' ? 'ok' : 'unknown'} label={`License: ${(manufacturer.license?.status || 'unverified').replace('_', ' ')}`} />
          <StatusBadge status={RISK_LABELS[manufacturer.risk?.level] || 'unknown'} label={`Risk: ${manufacturer.risk?.level || 'UNRATED'}`} />
        </div>
      </header>

      <div className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <Card title={app.officialRecord}>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '150px 1fr', rowGap: 10, fontSize: 13 }}>
              <dt style={{ color: 'var(--text-muted)' }}>{app.legalNameLabel}</dt><dd style={{ margin: 0 }}>{manufacturer.legalName}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>{app.tradeName}</dt><dd style={{ margin: 0 }}>{manufacturer.tradeName || manufacturer.legalName}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>GSTIN</dt><dd style={{ margin: 0 }}>{manufacturer.gstin || app.notProvided}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>{app.registeredAddress}</dt><dd style={{ margin: 0 }}>{manufacturer.address || app.notProvided}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>{app.licenseLabel}</dt><dd style={{ margin: 0 }}>{(manufacturer.license?.status || 'unverified').replace('_', ' ')}</dd>
              <dt style={{ color: 'var(--text-muted)' }}>{app.recordSource}</dt><dd style={{ margin: 0 }}>{manufacturer.source === 'inspection' ? app.derivedFromInspection : app.departmentMaintained}</dd>
            </dl>
          </Card>

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
                    <td><Link className="table-link" to={`/gov/inspections/${row.id}`}>{row.id}</Link></td>
                    <td>{row.date}</td>
                    <td>{row.product}</td>
                    <td><StatusBadge status={row.status} /></td>
                  </tr>
                )}
              />
            ) : (
              <EmptyState title={app.noInspectionsRecorded} />
            )}
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card title={app.complianceSnapshot}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="stat-card stat-accent-blue"><span className="stat-card-value">{linkedInspections.length}</span><span className="stat-card-label">{app.colInspections}</span></div>
              <div className="stat-card stat-accent-red"><span className="stat-card-value">{violations}</span><span className="stat-card-label">{app.colViolations}</span></div>
            </div>
          </Card>

          <Card title={app.riskProfileExplainable}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{app.inspectionsRecorded}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{linkedInspections.length} {app.inspectionsLinked}</div>
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{app.declarationViolations}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{violations} {app.failedChecksAcross}</div>
              </div>
            </div>
            <p style={{ fontSize: 12.5, fontWeight: 600, background: 'var(--status-unknown-soft)', borderRadius: 'var(--radius-md)', padding: '10px 12px', margin: 0 }}>
              {app.riskClassifiedPrefix} {manufacturer.risk?.level || 'UNRATED'} {app.riskFromHistory} {violations} {app.violationsAcross} {linkedInspections.length}.
            </p>
            <p style={{ fontSize: 11.5, color: 'var(--text-subtle)', margin: '10px 0 0 0' }}>
              {app.riskFootnote}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
};
