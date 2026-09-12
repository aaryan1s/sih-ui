import React from 'react';

/**
 * Dependency-free SVG charts in the app's visual language.
 * Hand-rolled per plan §12 rec 5 — perfect style match, no library weight.
 */

/* Dual-series line chart (compliant vs non-compliant trend) */
export const TrendChart = ({ months, series, ariaLabel = 'Trend chart' }) => {
  const width = 460;
  const height = 170;
  const padL = 30;
  const padB = 22;
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all, 1); // at least 1 so a lone point / all-zeros series never divides by 0
  const min = 0;
  const n = months.length;

  // Guard: single-point or empty series must still produce finite coordinates
  const denom = Math.max(n - 1, 1);
  const x = (i) => padL + (i / denom) * (width - padL - 10);
  const y = (v) => 8 + (1 - (v - min) / (max - min || 1)) * (height - padB - 16);
  const path = (data) => data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const COLORS = ['var(--status-ok)', 'var(--status-bad)', 'var(--gov-blue-text)'];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={ariaLabel}>
      {/* gridlines */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={padL} x2={width - 10} y1={y(max * t)} y2={y(max * t)} stroke="var(--card-border)" strokeDasharray="3 4" />
      ))}
      {series.map((s, si) => (
        <g key={s.label}>
          <path d={path(s.data)} fill="none" stroke={s.color || COLORS[si % COLORS.length]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {s.data.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={s.color || COLORS[si % COLORS.length]} />
          ))}
        </g>
      ))}
      {months.map((m, i) => (
        <text key={m} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
          {m}
        </text>
      ))}
    </svg>
  );
};

/* Donut chart with center label */
export const DonutChart = ({ segments, centerLabel, centerSub, ariaLabel = 'Distribution chart' }) => {
  const size = 150;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  // Immutable precomputation of each segment's cumulative dash offset
  const fractions = segments.map((s) => s.value / total);
  const arcs = segments.map((s, i) => ({
    ...s,
    dash: `${(fractions[i] * circumference).toFixed(1)} ${(circumference - fractions[i] * circumference).toFixed(1)}`,
    offset: fractions.slice(0, i).reduce((acc, f) => acc + f, 0) * circumference,
  }));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: 150, height: 150 }} role="img" aria-label={ariaLabel}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--status-unknown-soft)" strokeWidth={stroke} />
      {arcs.map((arc) => (
        <circle
          key={arc.label}
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={stroke}
          strokeDasharray={arc.dash}
          strokeDashoffset={-arc.offset}
          transform={`rotate(-90 ${c} ${c})`}
          strokeLinecap="butt"
        />
      ))}
      <text x={c} y={c - 2} textAnchor="middle" fontSize="24" fontWeight="800" fill="var(--text-heading)">
        {centerLabel}
      </text>
      <text x={c} y={c + 16} textAnchor="middle" fontSize="9.5" fill="var(--text-muted)">
        {centerSub}
      </text>
    </svg>
  );
};

/* Horizontal bar list (top issues / categories) */
export const BarList = ({ items, color = 'var(--status-bad)' }) => {
  const max = Math.max(...items.map((i) => i.count)) || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {items.map((item) => (
        <div key={item.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, marginBottom: 3 }}>
            <span>{item.label}</span>
            <span style={{ color: 'var(--text-muted)' }}>{item.count}</span>
          </div>
          <div style={{ height: 7, borderRadius: 4, background: 'var(--status-unknown-soft)', overflow: 'hidden' }}>
            <div style={{ width: `${(item.count / max) * 100}%`, height: '100%', borderRadius: 4, background: color, transition: 'width var(--transition-normal)' }} />
          </div>
        </div>
      ))}
    </div>
  );
};
