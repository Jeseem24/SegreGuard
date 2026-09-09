import React from 'react';
import { useRole } from '../../context/RoleContext.jsx';
import { 
  Scan, 
  ClipboardList, 
  Boxes, 
  BarChart3, 
  ArrowLeftRight,
  Wifi,
  Radio
} from 'lucide-react';
import './TabBar.css';

const TAB_CONFIG = {
  scanner: { label: 'AI Scanner', icon: Scan },
  log: { label: 'Audit Log', icon: ClipboardList },
  tasks: { label: 'SLA Tasks', icon: Boxes },
  dashboard: { label: 'Command Center', icon: BarChart3 }
};

export default function TabBar({ activeTab, onTabChange }) {
  const { role, clearRole } = useRole();

  if (!role) return null;

  const visibleTabs = role.tabs;

  return (
    <nav className="tab-bar">
      <div className="tab-bar__inner">
        {/* Navigation Tabs */}
        <div className="tab-bar__tabs">
          {visibleTabs.map((tabId) => {
            const tab = TAB_CONFIG[tabId];
            if (!tab) return null;
            const IconComponent = tab.icon;
            const isActive = activeTab === tabId;

            return (
              <button
                key={tabId}
                className={`tab-bar__tab ${isActive ? 'tab-bar__tab--active' : ''}`}
                onClick={() => onTabChange(tabId)}
              >
                <div className="tab-bar__icon-wrapper">
                  <IconComponent size={19} strokeWidth={isActive ? 2.3 : 1.8} />
                </div>
                <span className="tab-bar__label">{tab.label}</span>
                {isActive && <div className="tab-bar__active-glow" />}
              </button>
            );
          })}
        </div>

        {/* Dynamic Role Switcher Dock Pill */}
        <div className="tab-bar__dock-right">
          <div className="tab-bar__sync-chip" title="Live Firebase Cluster">
            <span className="tab-bar__sync-dot"></span>
            <span className="tab-bar__sync-text">LIVE</span>
          </div>

          <button 
            className="tab-bar__role-btn" 
            onClick={clearRole} 
            title="Switch User Station / Role"
          >
            <div className="tab-bar__role-avatar">
              <span className="tab-bar__role-circle"></span>
            </div>
            <div className="tab-bar__role-info">
              <span className="tab-bar__role-station">Station</span>
              <span className="tab-bar__role-name">{role.id === 'worker' ? 'Nurse' : role.id === 'collector' ? 'Collector' : 'Admin'}</span>
            </div>
            <ArrowLeftRight size={13} className="tab-bar__role-switch-icon" />
          </button>
        </div>
      </div>
    </nav>
  );
}
