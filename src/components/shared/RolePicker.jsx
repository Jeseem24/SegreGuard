import React from 'react';
import { useRole } from '../../context/RoleContext.jsx';
import { 
  ScanLine, 
  Truck, 
  Activity, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Cpu, 
  Building2 
} from 'lucide-react';
import './RolePicker.css';

export default function RolePicker() {
  const { selectRole } = useRole();

  const roleConfigs = [
    {
      id: 'worker',
      title: 'Point-of-Care / Ward Nurse',
      roleTag: 'Live Vision Tier',
      icon: ScanLine,
      color: '#38bdf8',
      accentGlow: 'rgba(56, 189, 248, 0.18)',
      description: 'Point-of-generation smart scanner. Real-time 30 FPS edge detection and statutory CPCB bin routing.'
    },
    {
      id: 'collector',
      title: 'Collection & Logistics Fleet',
      roleTag: '48h SLA Tracking',
      icon: Truck,
      color: '#10b981',
      accentGlow: 'rgba(16, 185, 129, 0.18)',
      description: 'Ward pickup dispatch queue, interactive hospital corridor transit map, and digital custody chain.'
    },
    {
      id: 'admin',
      title: 'Infection Control & Admin',
      roleTag: 'Executive Telemetry',
      icon: Activity,
      color: '#a855f7',
      accentGlow: 'rgba(168, 85, 247, 0.18)',
      description: 'Ward digital twin heatmap, real-time segregation metrics, and one-click CPCB Form IV compliance export.'
    }
  ];

  return (
    <div className="role-picker">
      <div className="role-picker__ambient-glow"></div>

      <div className="role-picker__container">
        {/* Eyebrow & Status Header */}
        <div className="role-picker__status-strip">
          <div className="role-picker__status-pill">
            <span className="role-picker__pulse-dot"></span>
            <span className="role-picker__status-text">CLINICAL AI SYSTEM ACTIVE</span>
          </div>
          <span className="role-picker__spec-badge">CPCB BMW 2016 STATUTORY</span>
        </div>

        {/* Hero Title */}
        <div className="role-picker__hero">
          <div className="role-picker__shield-container">
            <div className="role-picker__shield-core">
              <ShieldCheck className="role-picker__shield-icon" size={32} />
            </div>
          </div>
          <h1 className="role-picker__title">
            Segre<span className="role-picker__title-accent">Guard</span>
          </h1>
          <p className="role-picker__subtitle">
            Autonomous Biomedical Waste Segregation, SLA Tracking & Regulatory Governance Platform
          </p>
        </div>

        {/* Role Cards Double Bezel Grid */}
        <div className="role-picker__cards">
          {roleConfigs.map((r) => {
            const IconComponent = r.icon;
            return (
              <div 
                key={r.id} 
                className="role-card-outer"
                onClick={() => selectRole(r.id)}
              >
                <div 
                  className="role-card-inner"
                  style={{ '--card-accent': r.color, '--card-glow': r.accentGlow }}
                >
                  <div className="role-card__top">
                    <div className="role-card__icon-wrapper" style={{ color: r.color }}>
                      <IconComponent size={22} strokeWidth={2.2} />
                    </div>
                    <span className="role-card__tag" style={{ color: r.color, borderColor: `${r.color}33` }}>
                      {r.roleTag}
                    </span>
                  </div>

                  <div className="role-card__body">
                    <h3 className="role-card__name">{r.title}</h3>
                    <p className="role-card__info">{r.description}</p>
                  </div>

                  <div className="role-card__action">
                    <span className="role-card__action-text">Launch Station</span>
                    <div className="role-card__arrow-circle">
                      <ArrowRight size={14} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Institutional Footer */}
        <div className="role-picker__footer">
          <div className="role-picker__footer-info">
            <Cpu size={14} className="role-picker__footer-icon" />
            <span>Dual AI: Edge MobileNet + Gemini 2.5 Flash Multimodal</span>
          </div>
          <div className="role-picker__footer-sep">•</div>
          <div className="role-picker__footer-info">
            <Building2 size={14} className="role-picker__footer-icon" />
            <span>Hospital Node #704</span>
          </div>
        </div>
      </div>
    </div>
  );
}
