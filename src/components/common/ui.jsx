import React from 'react';

/* Card — the login-card surface language, generalized */
export const Card = ({ title, action, children, className = '' }) => (
  <section className={`app-card ${className}`}>
    {(title || action) && (
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        {title && <h3 className="app-card-title">{title}</h3>}
        {action}
      </header>
    )}
    {children}
  </section>
);

/* StatCard — landing stat-item language with a semantic accent rail */
export const StatCard = ({ value, label, hint, accent = 'blue' }) => (
  <div className={`stat-card stat-accent-${accent}`}>
    <span className="stat-card-value">{value}</span>
    <span className="stat-card-label">{label}</span>
    {hint && <span className="stat-card-hint">{hint}</span>}
  </div>
);

/* StatusBadge — ✓ ⚠ ✕ ? glyph language as a pill */
const STATUS_STYLES = {
  compliant: 'status-ok',
  ok: 'status-ok',
  active: 'status-ok',
  low: 'status-ok',
  warning: 'status-warn',
  warn: 'status-warn',
  under_review: 'status-warn',
  under_review_label: 'status-warn',
  moderate: 'status-warn',
  high: 'status-bad',
  severe: 'status-bad',
  bad: 'status-bad',
  non_compliant: 'status-bad',
  critical: 'status-bad',
  unknown: 'status-unknown',
  na: 'status-unknown',
};

const STATUS_LABELS = {
  compliant: '✓ Compliant',
  non_compliant: '✕ Non-compliant',
  warning: '⚠ Warning',
  under_review: '? Under Review',
  ok: '✓ OK',
  warn: '⚠ Review',
  bad: '✕ Non-compliant',
  unknown: '? Undetermined',
  na: '— N/A',
  active: '● Active',
  under_review_label: '● Under Review',
  low: 'LOW',
  moderate: 'MODERATE',
  high: 'HIGH',
  critical: 'CRITICAL',
};

export const StatusBadge = ({ status, label }) => (
  <span className={`status-badge ${STATUS_STYLES[status] || 'status-unknown'}`}>
    {label || STATUS_LABELS[status] || status}
  </span>
);

/* EmptyState — first-class empty/loading placeholder */
export const EmptyState = ({ icon, title, subtitle, action }) => (
  <div className="empty-state">
    {icon && <div className="empty-state-icon">{icon}</div>}
    <p className="empty-state-title">{title}</p>
    {subtitle && <p className="empty-state-sub">{subtitle}</p>}
    {action}
  </div>
);

/* DataTable — minimal, styled per landing rhythm */
export const DataTable = ({ columns, rows, renderRow }) => (
  <div className="app-table-wrap">
    <table className="app-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} style={col.width ? { width: col.width } : undefined}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => renderRow(row, index))}
      </tbody>
    </table>
  </div>
);
