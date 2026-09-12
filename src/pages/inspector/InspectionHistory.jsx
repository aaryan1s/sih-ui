import React from 'react';
import { InspectionTable } from '../../components/common/InspectionTable';
import { useStoreData } from '../../services/dataStore';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Inspection History (reference screen 9).
 * Reads from the central store — inspections submitted in the wizard appear
 * here immediately, with search, status tabs, sorting and pagination.
 */
export const InspectionHistory = () => {
  const inspections = useStoreData('inspections');
  const { t } = useLanguage();

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{t.app.titleHistory}</h1>
          <p className="app-page-subtitle">{t.app.subtitleHistory}</p>
        </div>
      </header>

      <InspectionTable rows={inspections} detailPath="/inspector/inspections" />
    </>
  );
};
