import React, { useRef } from 'react';
import { User, Landmark } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const TAB_IDS = ['credentials', 'sso'];

export const LoginTabs = ({ activeTab, onTabChange }) => {
  const { t } = useLanguage();
  const tabRefs = useRef({});

  const handleKeyDown = (event) => {
    const currentIndex = TAB_IDS.indexOf(activeTab);
    let nextIndex = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % TAB_IDS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + TAB_IDS.length) % TAB_IDS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = TAB_IDS.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = TAB_IDS[nextIndex];
    onTabChange(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  return (
    <div className="login-tabs-container" role="tablist" aria-label="Login method">
      {TAB_IDS.map((tabId) => (
        <button
          key={tabId}
          ref={(el) => (tabRefs.current[tabId] = el)}
          type="button"
          role="tab"
          id={`tab-${tabId}`}
          aria-selected={activeTab === tabId}
          aria-controls={`panel-${tabId}`}
          tabIndex={activeTab === tabId ? 0 : -1}
          className={`login-tab-btn ${activeTab === tabId ? 'active' : ''}`}
          onClick={() => onTabChange(tabId)}
          onKeyDown={handleKeyDown}
        >
          {tabId === 'credentials' ? <User size={16} className="tab-icon" aria-hidden="true" /> : <Landmark size={16} className="tab-icon" aria-hidden="true" />}
          <span>{tabId === 'credentials' ? t.tabCredentials : t.tabSso}</span>
        </button>
      ))}
    </div>
  );
};
