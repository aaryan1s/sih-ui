import React from 'react';
import { InspectionTable } from '../../components/common/InspectionTable';
import { useStoreData } from '../../services/dataStore';
import { useLanguage } from '../../context/LanguageContext';

/** Department-wide monitoring — live from the store, with the same functional
 * search / status tabs / sort / pagination as the inspector's history view. */
export const GovInspectionMonitoring = () => {
  const inspections = useStoreData('inspections');
  const { t } = useLanguage();
  const app = t.app;

  return (
    <>
      <header className="app-page-header">
        <div>
          <h1 className="app-page-title">{app.titleMonitoring}</h1>
          <p className="app-page-subtitle">{app.subtitleMonitoring}</p>
        </div>
      </header>
      <InspectionTable rows={inspections} detailPath="/gov/inspections" />
    </>
  );
};
