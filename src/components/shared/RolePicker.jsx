import React from 'react';
import { useRole } from '../../context/RoleContext.jsx';
import './RolePicker.css';

export default function RolePicker() {
  const { selectRole, ROLES } = useRole();

  return (
    <div className="role-picker">
      <div className="role-picker__header">
        <div className="role-picker__logo">
          <span className="role-picker__logo-icon">🛡️</span>
          <h1 className="role-picker__title">SegreGuard</h1>
        </div>
        <p className="role-picker__subtitle">
          AI-Powered Biomedical Waste Segregation & Traceability
        </p>
      </div>

      <div className="role-picker__cards">
        {Object.values(ROLES).map((r) => (
          <button
            key={r.id}
            className="role-card"
            onClick={() => selectRole(r.id)}
          >
            <span className="role-card__icon">{r.icon}</span>
            <div className="role-card__text">
              <span className="role-card__label">{r.label}</span>
              <span className="role-card__desc">{r.description}</span>
            </div>
            <span className="role-card__arrow">→</span>
          </button>
        ))}
      </div>

      <p className="role-picker__footer">
        Select your role to continue
      </p>
    </div>
  );
}
