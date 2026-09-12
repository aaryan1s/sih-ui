import React from 'react';
import { Mail, Phone, Building2, MapPin, CalendarDays, PenLine, Award } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/ui';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

/**
 * My Profile — reference screen 3, shared by both portals.
 * Renders the SESSION user's data with honest "Not on file" placeholders —
 * no fabricated officer records.
 */
export const ProfilePage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const app = t.app;

  const onFile = 'Not on file';
  const details = [
    { icon: Award, label: app.profileEmployeeId || 'Employee ID', value: user?.employeeId || onFile },
    { icon: Mail, label: app.profileEmail || 'Email', value: user?.email || onFile },
    { icon: Phone, label: app.profilePhone || 'Phone', value: user?.phone || onFile },
    { icon: Building2, label: app.profileDepartment || 'Department', value: user?.department || onFile },
    { icon: PenLine, label: app.profileDesignation || 'Designation', value: user?.designation || onFile },
    { icon: MapPin, label: app.profileRegion || 'Region', value: user?.region || onFile },
    { icon: CalendarDays, label: app.profileJoined || 'Date of Joining', value: user?.dateOfJoining || onFile },
  ];

  return (
    <>
      <header className="app-page-header">
        <div>
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <span>{app.navHome || 'Home'}</span> <span aria-hidden="true">›</span> <span aria-current="page">{app.profileTitle || 'My Profile'}</span>
          </nav>
          <h1 className="app-page-title">{app.profileTitle || 'My Profile'}</h1>
        </div>
      </header>

      <section className="app-card profile-card">
        <div className="profile-head">
          <span className="profile-avatar" aria-hidden="true">{user?.initials || '?'}</span>
          <div className="profile-head-meta">
            <h2 className="profile-name">{user?.name || onFile}</h2>
            <p className="profile-role-line">
              {user?.roleLabel || user?.role || ''}{user?.department ? ` · ${user.department}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="app-btn app-btn-secondary app-btn-sm"
            onClick={() => toast.info(app.profileEditPending || 'Profile editing arrives with the backend phase — records are read-only in this demo.')}
          >
            <PenLine size={14} aria-hidden="true" /> {app.profileEdit || 'Edit Profile'}
          </button>
        </div>

        <dl className="profile-details">
          {details.map(({ icon: Icon, label, value }) => (
            <div key={label} className="profile-detail-row">
              <dt><Icon size={14} aria-hidden="true" /> {label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div className="profile-detail-row">
            <dt><Award size={14} aria-hidden="true" /> {app.profileSignature || 'Digital Signature'}</dt>
            <dd>
              <StatusBadge status="unknown" label={app.profileSigPending || 'Not registered'} />
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
};
