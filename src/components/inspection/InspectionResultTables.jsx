import React from 'react';
import { Card } from '../common/ui';
import { useLanguage } from '../../context/LanguageContext';

const DIM_CELL = { ok: '✓', warn: '⚠', bad: '✕', unknown: '?', na: '—' };

const dimClass = (value) =>
  value === 'ok' ? 'status-ok' : value === 'warn' ? 'status-warn' : value === 'bad' ? 'status-bad' : 'status-unknown';

/**
 * Shared read-only presentation of an inspection result.
 * Keeps the two conceptual stages distinct:
 *  - Automated Extraction: WHAT was detected (per declaration)
 *  - Rule Findings: WHETHER it satisfies the applicable requirement
 */
export const InspectionResultTables = ({ inspection }) => {
  const { t } = useLanguage();
  const app = t.app;

  return (
    <>
      <Card title={app.automatedExtractionTitle}>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
          {app.automatedExtractionIntro}
        </p>
        <div className="app-table-wrap" style={{ boxShadow: 'none' }}>
          <table className="app-table">
            <thead>
              <tr>
                <th>{app.colDeclaration}</th>
                <th>{app.colExtractedValue}</th>
                <th>{app.colConfidence}</th>
              </tr>
            </thead>
            <tbody>
              {inspection.declarations.map((declaration) => (
                <tr key={declaration.name}>
                  <td style={{ fontWeight: 600 }}>{declaration.name}</td>
                  <td>{declaration.value ?? <span className="status-badge status-bad">{app.notFoundBadge}</span>}</td>
                  <td>{Math.round(declaration.confidence * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={app.ruleFindingsTitle}>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
          {app.ruleFindingsIntro}
        </p>
        <div className="app-table-wrap" style={{ boxShadow: 'none', overflowX: 'auto' }}>
          <table className="app-table">
            <thead>
              <tr>
                <th>{app.colDeclaration}</th>
                <th title={app.dimPresence}>{app.dimPresence.slice(0, 5)}</th>
                <th title={app.dimCorrectness}>{app.dimCorrectness}</th>
                <th title={app.dimPlacement}>{app.dimPlacement.slice(0, 5)}</th>
                <th title={app.dimReadability}>{app.dimReadability.slice(0, 4)}</th>
                <th title={app.dimFontSize}>{app.dimFontSize}</th>
                <th>{app.colViolationRule}</th>
              </tr>
            </thead>
            <tbody>
              {inspection.declarations.map((declaration) => (
                <tr key={declaration.name}>
                  <td style={{ fontWeight: 600 }}>{declaration.name}</td>
                  {[declaration.presence, declaration.correctness, declaration.placement, declaration.readability, declaration.font_size].map((dimension, index) => (
                    <td key={index}>
                      <span className={`status-badge ${dimClass(dimension)}`}>{DIM_CELL[dimension]}</span>
                    </td>
                  ))}
                  <td style={{ fontSize: 12 }}>
                    {declaration.violation_type ? `${declaration.violation_type} · ${declaration.rule_reference}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
};
