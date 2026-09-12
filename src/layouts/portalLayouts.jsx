import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSearch,
  Building2,
  FileText,
  Settings,
  ClipboardList,
  ShieldAlert,
  Scale,
  BarChart3,
  Database,
  UserRound,
} from 'lucide-react';
import { AppShell } from '../components/shell/AppShell';
import { useLanguage } from '../context/LanguageContext';

// Nav labels reference the centralized app dictionary by key (t.app[labelKey]);
// `label` is the English default/fallback.
const INSPECTOR_NAV = [
  { to: '/inspector', icon: LayoutDashboard, labelKey: 'navDashboard', label: 'Dashboard', end: true },
  { to: '/inspector/inspections/new', icon: ClipboardList, labelKey: 'navNewInspection', label: 'New Inspection' },
  { to: '/inspector/inspections', icon: FileSearch, labelKey: 'navInspections', label: 'Inspections', end: true },
  { to: '/inspector/reports', icon: FileText, labelKey: 'navReports', label: 'Reports' },
  { to: '/inspector/manufacturers', icon: Building2, labelKey: 'navManufacturers', label: 'Manufacturers' },
  { to: '/inspector/profile', icon: UserRound, labelKey: 'navProfile', label: 'My Profile' },
  { to: '/inspector/settings', icon: Settings, labelKey: 'navSettings', label: 'Settings' },
];

const GOV_NAV = [
  { to: '/gov', icon: LayoutDashboard, labelKey: 'navDashboard', label: 'Dashboard', end: true },
  { to: '/gov/inspections', icon: FileSearch, labelKey: 'navInspections', label: 'Inspections' },
  { to: '/gov/violations', icon: ShieldAlert, labelKey: 'navViolations', label: 'Violations' },
  { to: '/gov/cases', icon: Scale, labelKey: 'navCases', label: 'Cases & Enforcement' },
  { to: '/gov/manufacturers', icon: Building2, labelKey: 'navManufacturers', label: 'Manufacturers' },
  { to: '/gov/analytics', icon: BarChart3, labelKey: 'navAnalytics', label: 'Analytics' },
  { to: '/gov/repository', icon: Database, labelKey: 'navRepository', label: 'Repository' },
  { to: '/gov/reports', icon: FileText, labelKey: 'navReports', label: 'Reports' },
  { to: '/gov/profile', icon: UserRound, labelKey: 'navProfile', label: 'My Profile' },
  { to: '/gov/settings', icon: Settings, labelKey: 'navSettings', label: 'Settings' },
];

export const InspectorLayout = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <AppShell
      portal="inspector"
      portalBadge="Inspector Portal"
      navItems={INSPECTOR_NAV}
      cta={
        <button type="button" className="app-btn app-btn-primary" onClick={() => navigate('/inspector/inspections/new')}>
          <ClipboardList size={16} aria-hidden="true" /> {t.app.navNewInspection}
        </button>
      }
    />
  );
};

export const GovLayout = () => (
  <AppShell portal="gov" portalBadge="Govt. Officer Portal" navItems={GOV_NAV} />
);
