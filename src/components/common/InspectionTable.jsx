import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { StatusBadge, EmptyState } from './ui';
import { INSPECTION_STATUS } from '../../data/mockData';
import { useLanguage } from '../../context/LanguageContext';

const PAGE_SIZE = 8;

const STATUS_TABS = [
  { id: 'all', labelKey: 'tabAll' },
  { id: INSPECTION_STATUS.compliant, labelKey: 'tabCompliant' },
  { id: INSPECTION_STATUS.non_compliant, labelKey: 'tabNonCompliant' },
  { id: 'pending', labelKey: 'tabPending' },
];

const PENDING = [INSPECTION_STATUS.under_review, INSPECTION_STATUS.warning];

const COLUMNS = [
  { key: 'id', labelKey: 'colId', width: '115px', sortable: true },
  { key: 'date', labelKey: 'colDate', width: '105px', sortable: true },
  { key: 'establishment', labelKey: 'colEstablishment', width: '145px' },
  { key: 'product', labelKey: 'colProduct', sortable: true },
  { key: 'manufacturer', labelKey: 'colManufacturer', sortable: true },
  { key: 'status', labelKey: 'colStatus', width: '148px' },
  { key: 'action', labelKey: null, width: '96px' },
];

/**
 * Functional inspection register table (shared by Inspector History and Gov
 * Monitoring): search + status tabs + sortable columns + pagination, all
 * operating live on the passed rows. Labels come from the centralized
 * language dictionary, so the table follows the selected language.
 */
export const InspectionTable = ({ rows, detailPath, emptyText }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const app = t.app;
  // Accepts ?q= from the shell's global search so landing here from the topbar
  // applies the query immediately (inspector-scoped search).
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((row) => {
      const matchesQuery =
        !q ||
        row.id.toLowerCase().includes(q) ||
        row.product.toLowerCase().includes(q) ||
        row.manufacturer.toLowerCase().includes(q) ||
        (row.establishment || '').toLowerCase().includes(q) ||
        row.inspector.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending' ? PENDING.includes(row.status) : row.status === statusFilter);
      return matchesQuery && matchesStatus;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => String(a[sort.key]).localeCompare(String(b[sort.key])) * dir);
  }, [rows, query, statusFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key) => {
    setPage(0);
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  return (
    <>
      <div className="history-filter-row">
        <div className="history-tabs" role="tablist" aria-label={app.colStatus}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.id}
              className={`history-tab ${statusFilter === tab.id ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(0);
              }}
            >
              {app[tab.labelKey]}
            </button>
          ))}
        </div>
        <div className="history-search">
          <Search size={14} className="history-search-icon" aria-hidden="true" />
          <input
            type="search"
            placeholder={app.searchPlaceholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            aria-label={app.searchInspections}
          />
        </div>
      </div>

      {paged.length > 0 ? (
        <>
          <div className="app-table-wrap">
            <table className="app-table">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                      {col.sortable ? (
                        <button
                          type="button"
                          className={`th-sort ${sort.key === col.key ? 'active' : ''}`}
                          onClick={() => toggleSort(col.key)}
                          aria-label={`Sort by ${col.labelKey}`}
                        >
                          {app[col.labelKey]} <ArrowUpDown size={11} aria-hidden="true" />
                        </button>
                      ) : (
                        app[col.labelKey] || ''
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={row.id} onClick={() => navigate(`${detailPath}/${row.id}`)} style={{ cursor: 'pointer' }}>
                    <td><span className="table-link">{row.id}</span></td>
                    <td>{row.date}</td>
                    <td>{row.establishment || '—'}</td>
                    <td>{row.product}</td>
                    <td>{row.manufacturer}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td><span className="table-link">{app.viewDetails}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="table-pagination">
              <span className="table-pagination-info">
                {app.pageInfo.replace('{page}', safePage + 1).replace('{total}', pageCount)} · {filtered.length}
              </span>
              <div className="table-pagination-btns">
                <button type="button" className="icon-action-btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label={app.prevPage}>
                  <ChevronLeft size={15} aria-hidden="true" />
                </button>
                <button type="button" className="icon-action-btn" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label={app.nextPage}>
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState title={emptyText || app.noInspections} subtitle={app.noResultsHint} />
      )}

    </>
  );
};
