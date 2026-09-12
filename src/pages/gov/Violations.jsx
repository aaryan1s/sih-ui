import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { StatusBadge, EmptyState } from '../../components/common/ui';
import { useStoreData } from '../../services/dataStore';
import { useLanguage } from '../../context/LanguageContext';

const PAGE_SIZE = 8;

const SEVERITY_BADGE = { severe: 'severe', major: 'warning', minor: 'unknown' };
const SEVERITY_LABEL = { severe: 'SEVERE', major: 'MAJOR', minor: 'MINOR' };

const VIOLATION_TYPES = ['missing', 'illegible', 'undersized', 'misplaced', 'incorrect'];

export const Violations = () => {
  const navigate = useNavigate();
  const inspections = useStoreData('inspections');
  const { t } = useLanguage();
  const app = t.app;

  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('all');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(0);

  // Violation register derived live from declaration findings
  const rows = useMemo(
    () =>
      inspections.flatMap((inspection) =>
        inspection.declarations
          .filter((declaration) => declaration.violation_type)
          .map((declaration) => ({
            id: `${inspection.id}-${declaration.name}`,
            inspectionId: inspection.id,
            date: inspection.date,
            manufacturer: inspection.manufacturer,
            manufacturerId: inspection.manufacturerId,
            product: inspection.product,
            inspector: inspection.inspector,
            violation: declaration.violation_type,
            rule: declaration.rule_reference,
            declaration: declaration.name,
            severity: declaration.presence === 'bad' ? 'severe' : declaration.readability === 'bad' ? 'major' : 'minor',
          }))
      ),
    [inspections]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((row) => {
      const matchesQuery =
        !q ||
        row.inspectionId.toLowerCase().includes(q) ||
        row.manufacturer.toLowerCase().includes(q) ||
        row.product.toLowerCase().includes(q) ||
        row.declaration.toLowerCase().includes(q) ||
        row.rule.toLowerCase().includes(q);
      const matchesSeverity = severity === 'all' || row.severity === severity;
      const matchesType = type === 'all' || row.violation === type;
      return matchesQuery && matchesSeverity && matchesType;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => String(a[sort.key]).localeCompare(String(b[sort.key])) * dir);
  }, [rows, query, severity, type, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key) => {
    setPage(0);
    setSort((current) => (current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{app.titleViolations}</h1>
          <p className="app-page-subtitle">{app.subtitleViolations || 'All declaration-level findings across the department.'}</p>
        </div>
      </header>

      <div className="history-filter-row">
        <div className="history-search" style={{ maxWidth: 340 }}>
          <Search size={14} className="history-search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search inspection, manufacturer, product, rule…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            aria-label="Search violations"
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="app-select" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(0); }} aria-label="Filter by severity">
            <option value="all">All severities</option>
            <option value="severe">Severe</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </select>
          <select className="app-select" value={type} onChange={(e) => { setType(e.target.value); setPage(0); }} aria-label="Filter by violation type">
            <option value="all">All violation types</option>
            {VIOLATION_TYPES.map((vt) => (
              <option key={vt} value={vt}>{vt}</option>
            ))}
          </select>
        </div>
      </div>

      {paged.length > 0 ? (
        <>
          <div className="app-table-wrap">
            <table className="app-table">
              <thead>
                <tr>
                  <th style={{ width: '105px' }}>
                    <button type="button" className={`th-sort ${sort.key === 'date' ? 'active' : ''}`} onClick={() => toggleSort('date')} aria-label="Sort by date">
                      Date <ArrowUpDown size={11} aria-hidden="true" />
                    </button>
                  </th>
                  <th style={{ width: '115px' }}>Inspection</th>
                  <th>
                    <button type="button" className={`th-sort ${sort.key === 'manufacturer' ? 'active' : ''}`} onClick={() => toggleSort('manufacturer')} aria-label="Sort by manufacturer">
                      Manufacturer <ArrowUpDown size={11} aria-hidden="true" />
                    </button>
                  </th>
                  <th>Product · Declaration</th>
                  <th style={{ width: '130px' }}>Violation</th>
                  <th style={{ width: '210px' }}>Rule Reference</th>
                  <th style={{ width: '110px' }}>
                    <button type="button" className={`th-sort ${sort.key === 'severity' ? 'active' : ''}`} onClick={() => toggleSort('severity')} aria-label="Sort by severity">
                      Severity <ArrowUpDown size={11} aria-hidden="true" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={row.id} onClick={() => navigate(`/gov/inspections/${row.inspectionId}`)} style={{ cursor: 'pointer' }}>
                    <td>{row.date}</td>
                    <td><span className="table-link">{row.inspectionId}</span></td>
                    <td>{row.manufacturer}</td>
                    <td>
                      <span style={{ display: 'block', fontSize: 12.5 }}>{row.product}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{row.declaration}</span>
                    </td>
                    <td><span className="status-badge status-bad">{row.violation}</span></td>
                    <td style={{ fontSize: 12 }}>{row.rule}</td>
                    <td>
                      <StatusBadge status={SEVERITY_BADGE[row.severity]} label={SEVERITY_LABEL[row.severity]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="table-pagination">
              <span className="table-pagination-info">
                {filtered.length} violation{filtered.length === 1 ? '' : 's'} · page {safePage + 1} of {pageCount}
              </span>
              <div className="table-pagination-btns">
                <button type="button" className="icon-action-btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
                  <ChevronLeft size={15} aria-hidden="true" />
                </button>
                <button type="button" className="icon-action-btn" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label="Next page">
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState title="No violations match these filters" subtitle="Adjust the search term, severity or violation type." />
      )}
    </>
  );
};
