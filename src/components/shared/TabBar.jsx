import React, { useState } from 'react';
import { useRole } from '../../context/RoleContext.jsx';
import './TabBar.css';

const TAB_CONFIG = {
  scanner: { label: 'Scanner', icon: '📷' },
  log: { label: 'Log', icon: '📋' },
  tasks: { label: 'Tasks', icon: '📦' },
  dashboard: { label: 'Dashboard', icon: '📊' }
};

export default function TabBar({ activeTab, onTabChange }) {
  const { role, clearRole } = useRole();

  if (!role) return null;

  const visibleTabs = role.tabs;

  return (
    <nav className="tab-bar">
      <div className="tab-bar__tabs">
        {visibleTabs.map((tabId) => {
          const tab = TAB_CONFIG[tabId];
          return (
            <button
              key={tabId}
              className={`tab-bar__tab ${activeTab === tabId ? 'tab-bar__tab--active' : ''}`}
              onClick={() => onTabChange(tabId)}
            >
              <span className="tab-bar__icon">{tab.icon}</span>
              <span className="tab-bar__label">{tab.label}</span>
            </button>
          );
        })}
      </div>
      <button className="tab-bar__role-badge" onClick={clearRole} title="Switch role">
        <span>{role.icon}</span>
        <span className="tab-bar__role-name">{role.label}</span>
      </button>
    </nav>
  );
}
