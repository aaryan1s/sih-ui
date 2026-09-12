import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { LandingPage } from '../LandingPage';
import { RequireRole } from './guards';
import { InspectorLayout, GovLayout } from '../layouts/portalLayouts';
import { InspectorDashboard } from '../pages/inspector/InspectorDashboard';
import { InspectionHistory } from '../pages/inspector/InspectionHistory';
import { InspectionDetail } from '../pages/inspector/InspectionDetail';
import { ManufacturerList, ManufacturerProfile } from '../pages/inspector/Manufacturers';
import { NewInspection } from '../pages/inspector/NewInspection';
import { InspectorReports } from '../pages/inspector/InspectorReports';
import { ProfilePage } from '../pages/common/ProfilePage';
import { SettingsPage } from '../pages/common/SettingsPage';
import { GovDashboard } from '../pages/gov/GovDashboard';
import { GovInspectionMonitoring } from '../pages/gov/GovMonitoring';
import { GovInspectionDetail } from '../pages/gov/GovInspectionDetail';
import { Violations } from '../pages/gov/Violations';
import { CaseQueue, CaseReview } from '../pages/gov/Cases';
import { GovManufacturerList, GovManufacturerProfile } from '../pages/gov/GovManufacturers';
import { GovAnalytics } from '../pages/gov/GovAnalytics';
import { GovRepository } from '../pages/gov/GovRepository';
import { GovReports } from '../pages/gov/GovPlaceholder';
import { Unauthorized, NotFound } from '../pages/errors/ErrorPages';

export const AppRoutes = () => (
  <Routes>
    {/* Public: landing + login (existing UI, now role-aware) */}
    <Route path="/" element={<LandingPage />} />

    {/* Inspector portal */}
    <Route
      path="/inspector"
      element={
        <RequireRole role="inspector">
          <InspectorLayout />
        </RequireRole>
      }
    >
      <Route index element={<InspectorDashboard />} />
      <Route path="inspections" element={<InspectionHistory />} />
      <Route path="inspections/new" element={<NewInspection />} />
      <Route path="inspections/:id" element={<InspectionDetail />} />
      <Route path="manufacturers" element={<ManufacturerList />} />
      <Route path="manufacturers/:id" element={<ManufacturerProfile />} />
      <Route path="reports" element={<InspectorReports />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>

    {/* Government portal */}
    <Route
      path="/gov"
      element={
        <RequireRole role="gov_officer">
          <GovLayout />
        </RequireRole>
      }
    >
      <Route index element={<GovDashboard />} />
      <Route path="inspections" element={<GovInspectionMonitoring />} />
      <Route path="inspections/:id" element={<GovInspectionDetail />} />
      <Route path="violations" element={<Violations />} />
      <Route path="cases" element={<CaseQueue />} />
      <Route path="cases/:id" element={<CaseReview />} />
      <Route path="manufacturers" element={<GovManufacturerList />} />
      <Route path="manufacturers/:id" element={<GovManufacturerProfile />} />
      <Route path="analytics" element={<GovAnalytics />} />
      <Route path="repository" element={<GovRepository />} />
      <Route path="reports" element={<GovReports />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>

    {/* Errors */}
    <Route path="/unauthorized" element={<Unauthorized />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);
