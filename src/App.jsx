import React, { useState, useEffect } from 'react';
import { RoleProvider, useRole } from './context/RoleContext.jsx';
import RolePicker from './components/shared/RolePicker.jsx';
import TabBar from './components/shared/TabBar.jsx';
import ErrorBoundary from './components/shared/ErrorBoundary.jsx';
import Scanner from './components/scanner/Scanner.jsx';
import LogList from './components/log/LogList.jsx';
import TaskList from './components/tasks/TaskList.jsx';
import Dashboard from './components/dashboard/Dashboard.jsx';
import { seedData, subscribeToLiveAlerts } from './lib/firestoreOps.js';
import { CheckCircle2, AlertTriangle, Truck, Sparkles } from 'lucide-react';
import './App.css';

function AppContent() {
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState(null);
  const [globalAlert, setGlobalAlert] = useState(null);

  // Set initial tab when role changes
  useEffect(() => {
    if (role && role.tabs.length > 0) {
      setActiveTab(role.tabs[0]);
    }
  }, [role]);

  // Seed data on first load
  useEffect(() => {
    seedData().catch(console.error);
  }, []);

  // Global synchronized live alert listener across all tabs and roles
  useEffect(() => {
    let timer = null;
    const unsub = subscribeToLiveAlerts((alert) => {
      setGlobalAlert(alert);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setGlobalAlert(prev => (prev?.id === alert.id ? null : prev));
      }, 6500);
    });

    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!role) {
    return <RolePicker />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'scanner':
        return (
          <ErrorBoundary>
            <Scanner />
          </ErrorBoundary>
        );
      case 'log':
        return (
          <ErrorBoundary>
            <LogList />
          </ErrorBoundary>
        );
      case 'tasks':
        return (
          <ErrorBoundary>
            <TaskList />
          </ErrorBoundary>
        );
      case 'dashboard':
        return (
          <ErrorBoundary>
            <Dashboard />
          </ErrorBoundary>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app">
      {/* Universal Instant Live Alert Banner (Visible on all tabs & roles) */}
      {globalAlert && (
        <aside
          className={`app__global-live-alert app__global-live-alert--${globalAlert.type || 'waste_disposed'}`}
          role="alert"
          aria-live="assertive"
        >
          <div className="app__global-live-alert-icon">
            {globalAlert.type === 'waste_disposed' ? (
              <span className="app__pulse-dot" />
            ) : globalAlert.type === 'nurse_request' ? (
              <AlertTriangle size={18} className="text-amber" />
            ) : globalAlert.type === 'logistics_dispatch' ? (
              <Truck size={18} className="text-sky" />
            ) : (
              <CheckCircle2 size={18} className="text-emerald" />
            )}
          </div>

          <div className="app__global-live-alert-content">
            <div className="app__global-live-alert-header">
              <span className="app__global-live-alert-badge">REAL-TIME PLATFORM SYNC</span>
              <span className="app__global-live-alert-title">{globalAlert.title}</span>
              <span className="app__global-live-alert-time">Just now</span>
            </div>
            <p className="app__global-live-alert-msg">{globalAlert.message}</p>
          </div>

          <div className="app__global-live-alert-actions">
            {role?.id === 'admin' && activeTab !== 'dashboard' && (
              <button 
                type="button" 
                className="app__global-live-alert-jump"
                onClick={() => setActiveTab('dashboard')}
              >
                View in Admin →
              </button>
            )}
            {role?.id === 'logistics' && activeTab !== 'tasks' && (
              <button 
                type="button" 
                className="app__global-live-alert-jump"
                onClick={() => setActiveTab('tasks')}
              >
                View Route →
              </button>
            )}
            <button 
              type="button" 
              className="app__global-live-alert-close"
              onClick={() => setGlobalAlert(null)}
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          </div>
        </aside>
      )}

      <main className="app__main">
        {renderTab()}
      </main>
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

function App() {
  return (
    <RoleProvider>
      <AppContent />
    </RoleProvider>
  );
}

export default App;
