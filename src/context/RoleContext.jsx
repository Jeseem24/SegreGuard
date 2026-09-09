import React, { createContext, useContext, useState, useCallback } from 'react';

const RoleContext = createContext(null);

const ROLES = {
  worker: {
    id: 'worker',
    label: 'Healthcare Worker',
    icon: '🏥',
    description: 'Scan & classify biomedical waste',
    tabs: ['scanner', 'log'],
    wardId: 'ward-1',
    userId: 'worker-1',
    hospitalId: 'hospital-1'
  },
  collector: {
    id: 'collector',
    label: 'Collection Worker',
    icon: '🚛',
    description: 'Pickup & transport waste',
    tabs: ['tasks'],
    wardId: 'ward-1',
    userId: 'collector-1',
    hospitalId: 'hospital-1'
  },
  admin: {
    id: 'admin',
    label: 'Hospital Admin',
    icon: '📊',
    description: 'Monitor, reports & oversight',
    tabs: ['dashboard', 'log'],
    wardId: null, // admin sees all wards
    userId: 'admin-1',
    hospitalId: 'hospital-1'
  }
};

export function RoleProvider({ children }) {
  const [role, setRole] = useState(null);

  const selectRole = useCallback((roleId) => {
    setRole(ROLES[roleId] || null);
  }, []);

  const clearRole = useCallback(() => {
    setRole(null);
  }, []);

  return (
    <RoleContext.Provider value={{ role, selectRole, clearRole, ROLES }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}

export { ROLES };
