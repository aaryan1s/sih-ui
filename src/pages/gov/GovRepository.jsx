import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X, PackageSearch, Building2, FileSearch, ShieldAlert, FileText } from 'lucide-react';
import { EmptyState } from '../../components/common/ui';
import { useStoreData } from '../../services/dataStore';
import { useLanguage } from '../../context/LanguageContext';

/* Repository — global search across the department dataset. Results are
   grouped by entity type and every result deep-links to its record. */

const GROUP_META = {
  products: { icon: PackageSearch, label: 'Products' },
  manufacturers: { icon: Building2, label: 'Manufacturers' },
  inspections: { icon: FileSearch, label: 'Inspections' },
  violations: { icon: ShieldAlert, label: 'Violations' },
  reports: { icon: FileText, label: 'Reports' },
};

const SEARCH_FIELDS = [
  'Product name or brand',
  'Manufacturer name / trade name / GSTIN / license no.',
  'Inspection ID',
  'Report ID',
  'Barcode',
];

export const GovRepository = () => {
  const { t } = useLanguage();
  const app = t.app;
  const navigate = useNavigate();
  const inspections = useStoreData('inspections');
  const manufacturers = useStoreData('manufacturers');
  const reports = useStoreData('reports');
  // Initialized from the URL (?q=) so the shell topbar search lands here with
  // the query pre-filled and results already computed.
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') || '');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;

    const products = inspections
      .filter((i) => i.product.toLowerCase().includes(q))
      .map((i) => ({ primary: i.product, secondary: `${i.manufacturer} · inspected ${i.date}`, to: `/gov/inspections/${i.id}` }));

    const manufacturerHits = manufacturers
      .filter(
        (m) =>
          m.legalName.toLowerCase().includes(q) ||
          (m.tradeName || '').toLowerCase().includes(q) ||
          (m.gstin || '').toLowerCase().includes(q)
      )
      .map((m) => ({ primary: m.legalName, secondary: m.gstin ? `GSTIN ${m.gstin}` : 'Provisional record', to: `/gov/manufacturers/${m.id}` }));

    const inspectionHits = inspections
      .filter((i) => i.id.toLowerCase().includes(q) || i.establishment?.toLowerCase().includes(q) || i.inspector.toLowerCase().includes(q))
      .map((i) => ({ primary: `${i.id} — ${i.product}`, secondary: `${i.inspector} · ${i.date} · ${i.establishment || '—'}`, to: `/gov/inspections/${i.id}` }));

    const violations = inspections.flatMap((i) =>
      i.declarations
        .filter((d) => d.violation_type && (d.violation_type.toLowerCase().includes(q) || d.rule_reference.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)))
        .map((d) => ({ primary: `${d.violation_type} — ${d.name}`, secondary: `${i.id} · ${d.rule_reference}`, to: `/gov/inspections/${i.id}` }))
    );

    const reportHits = reports
      .filter((r) => r.id.toLowerCase().includes(q) || r.inspectionId.toLowerCase().includes(q) || r.product.toLowerCase().includes(q))
      .map((r) => ({ primary: r.id, secondary: `${r.inspectionId} · ${r.product} · ${r.date}`, to: `/inspector/inspections/${r.inspectionId}` }));

    return { products, manufacturers: manufacturerHits, inspections: inspectionHits, violations, reports: reportHits };
  }, [query, inspections, manufacturers, reports]);

  const totalHits = results ? Object.values(results).reduce((sum, group) => sum + group.length, 0) : 0;

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{app.titleRepository}</h1>
          <p className="app-page-subtitle">{app.subtitleRepository}</p>
        </div>
      </header>

      <div className="repository-search">
        <div className="history-search" style={{ maxWidth: 560 }}>
          <Search size={15} className="history-search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search everything — try “Sundar”, “LM-1042”, “missing”, a GSTIN…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Global repository search"
            autoFocus
          />
          {query && (
            <button type="button" className="repository-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        {!results && (
          <p className="app-footnote" style={{ marginTop: 10 }}>
            Searches: {SEARCH_FIELDS.join(' · ')}. Minimum two characters.
          </p>
        )}
      </div>

      {results && totalHits === 0 && (
        <EmptyState title={`No records match “${query}”`} subtitle="Try a shorter fragment — the search matches partial text." />
      )}

      {results &&
        totalHits > 0 &&
        Object.entries(results).map(([group, hits]) =>
          hits.length === 0 ? null : (
            <section key={group}>
              <h3 className="app-card-title">
                {GROUP_META[group].label} ({hits.length})
              </h3>
              <div className="repository-group">
                {hits.map((hit) => {
                  const Icon = GROUP_META[group].icon;
                  return (
                    <button key={`${group}-${hit.primary}-${hit.secondary}`} type="button" className="repository-result" onClick={() => navigate(hit.to)}>
                      <span className="quick-action-icon"><Icon size={15} aria-hidden="true" /></span>
                      <span className="repository-result-text">
                        <strong>{hit.primary}</strong>
                        <span>{hit.secondary}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )
        )}
    </>
  );
};
