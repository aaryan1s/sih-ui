import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck, Search, Bell, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { EmblemOfIndia } from '../common/Logos';

export const AppShell = ({ portal, navItems, portalBadge, cta }) => {
  const { user, signOut } = useAuth();
  const { t, lang } = useLanguage();
  const app = t.app;
  const navigate = useNavigate();
  const location = useLocation();
  const pageRef = useRef(null);

  // The shell persists across child routes, so reset the content scroll on
  // navigation — every page starts at its top, beside the stationary sidebar.
  useEffect(() => {
    if (pageRef.current) pageRef.current.scrollTop = 0;
  }, [location.pathname]);

  const handleSignOut = () => {
    signOut();
    navigate('/', { replace: true });
  };

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // Close the user dropdown on outside click
  useEffect(() => {
    if (!showUserMenu) return undefined;
    const onDocClick = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showUserMenu]);

  const handleNotification = () => {
    toast.info(
      lang === 'hi'
        ? '3 अपठित सूचनाएँ — नोटिफिकेशन केंद्र बैकएंड चरण में आएगा।'
        : '3 unread notifications — notification center arrives with the backend phase.'
    );
  };

  const toast = useToast();

  return (
    <div className={`app-shell portal-${portal}`}>
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <EmblemOfIndia size={34} />
          <div>
            <div className="app-sidebar-brand-name">{app.brandName}</div>
            <div className="app-sidebar-brand-sub">{app.brandSub}</div>
          </div>
        </div>
        {cta && <div className="app-sidebar-cta">{cta}</div>}
        <nav className="sidebar-nav" aria-label={`${portalBadge} navigation`}>
          {navItems.map(({ to, icon: Icon, labelKey, label, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <span className="sidebar-link-icon">
                <Icon size={17} aria-hidden="true" />
              </span>
              {app[labelKey] || label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-user-avatar" aria-hidden="true">{user?.initials || '?'}</span>
          <div className="sidebar-user-meta">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="sidebar-user-role">{user?.roleLabel}</span>
          </div>
          <button type="button" className="sidebar-logout" onClick={handleSignOut} aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <span className={`app-topbar-portal-badge portal-badge-${portal === 'gov' ? 'gov' : 'inspector'}`}>
            <ShieldCheck size={12} aria-hidden="true" /> {lang === 'hi' ? (portal === 'gov' ? app.portalGov : app.portalInspector) : portalBadge}
          </span>
          <div className="app-topbar-search" role="search">
            <Search size={14} className="app-topbar-search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder={portal === 'gov' ? app.searchGov : app.searchInspector}
              aria-label={app.globalSearch}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.currentTarget.value.trim()) {
                  // Inspectors search their own inspection records; officers
                  // search the department-wide repository.
                  const target = portal === 'gov' ? `/gov/repository` : `/inspector/inspections`;
                  navigate(`${target}?q=${encodeURIComponent(event.currentTarget.value.trim())}`);
                }
              }}
            />
          </div>
          <div className="app-topbar-right">
            <button type="button" className="app-topbar-icon-btn" onClick={handleNotification} aria-label="Notifications">
              <Bell size={17} aria-hidden="true" />
              <span className="app-topbar-notif-dot" aria-hidden="true">3</span>
            </button>
            <div className="app-topbar-user" ref={userMenuRef}>
              <button type="button" className="app-topbar-user-btn" onClick={() => setShowUserMenu((v) => !v)} aria-expanded={showUserMenu} aria-haspopup="menu">
                <span className="app-topbar-user-avatar" aria-hidden="true">{user?.initials || '?'}</span>
                <span className="app-topbar-user-name">{user?.name}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {showUserMenu && (
                <div className="app-topbar-user-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setShowUserMenu(false); navigate(`/${portal}/profile`); }}>
                    {app.myProfile}
                  </button>
                  <button type="button" role="menuitem" className="danger" onClick={() => { setShowUserMenu(false); handleSignOut(); }}>
                    <LogOut size={14} aria-hidden="true" /> {app.signOut}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="app-page" id="main-content" ref={pageRef}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
