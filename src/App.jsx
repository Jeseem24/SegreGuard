import React, { useState, useEffect } from 'react';
import { RoleProvider, useRole } from './context/RoleContext.jsx';
import RolePicker from './components/shared/RolePicker.jsx';
import TabBar from './components/shared/TabBar.jsx';
import ErrorBoundary from './components/shared/ErrorBoundary.jsx';
import Scanner from './components/scanner/Scanner.jsx';
import LogList from './components/log/LogList.jsx';
import TaskList from './components/tasks/TaskList.jsx';
import Dashboard from './components/dashboard/Dashboard.jsx';
import { seedData } from './lib/firestoreOps.js';
import './App.css';

function AppContent() {
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState(null);

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
