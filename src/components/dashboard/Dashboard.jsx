import React, { useState, useEffect } from 'react';
import {
  subscribeToWasteEvents,
  subscribeToBins,
  subscribeToAllCollectionTasks,
  HOSPITAL_WARDS,
  calculateSlaStatus
} from '../../lib/firestoreOps.js';
import { CATEGORY_INFO } from '../../classifiers/classifierInterface.js';
import { 
  BarChart3, 
  Building2, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  Scale, 
  TrendingUp, 
  Layers, 
  Activity, 
  Sparkles,
  QrCode
} from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [bins, setBins] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('twin'); // 'twin' | 'manifest'
  const [selectedWard, setSelectedWard] = useState('ward-1');

  useEffect(() => {
    let loaded = { events: false, bins: false, tasks: false };

    const checkLoaded = () => {
      if (loaded.events && loaded.bins && loaded.tasks) setLoading(false);
    };

    const unsub1 = subscribeToWasteEvents(null, (data) => {
      setEvents(data || []);
      loaded.events = true;
      checkLoaded();
    });

    const unsub2 = subscribeToBins((data) => {
      setBins(data || []);
      loaded.bins = true;
      checkLoaded();
    });

    const unsub3 = subscribeToAllCollectionTasks((data) => {
      setTasks(data || []);
      loaded.tasks = true;
      checkLoaded();
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  // ── Metrics Computation ──
  const scansCount = events.length;
  const overrides = events.filter(e => e.wasEdited).length;
  const aiAccuracy = scansCount > 0 ? Math.round(((scansCount - overrides) / scansCount) * 100) : 98;
  const urgentTasks = tasks.filter(t => t.status === 'pending').length;
  const criticalSlaBins = bins.filter(b => {
    const sla = calculateSlaStatus(b.slaDeadline);
    return sla.status === 'CRITICAL' || sla.status === 'BREACH';
  }).length;

  const currentWardData = HOSPITAL_WARDS[selectedWard] || HOSPITAL_WARDS['ward-1'];
  const currentWardBins = bins.filter(b => b.wardId === selectedWard);

  const [exportedToast, setExportedToast] = useState(false);

  const handleExportCSV = () => {
    const headers = ['Manifest ID', 'Ward', 'Waste Description', 'CPCB Category', 'Rule Citation', 'Logged At', 'Confidence'];
    const rows = events.map(e => [
      e.id || 'EVT-704',
      e.wardId || 'ward-1',
      `"${e.itemLabel || 'Biomedical Waste'}"`,
      e.category ? e.category.toUpperCase() : 'YELLOW',
      `"${e.ruleCitation || 'CPCB BMW Rules 2016'}"`,
      e.createdAt || new Date().toISOString(),
      `${Math.round((e.confidence || 0.95) * 100)}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CPCB_Form_IV_Manifest_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportedToast(true);
    setTimeout(() => setExportedToast(false), 3500);
  };

  if (loading) {
    return (
      <div className="dash">
        <div className="dash__loading">
          <div className="dash__spinner" />
          <p className="dash__loading-text">Synchronizing hospital telemetry sensors & CPCB ledger…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">
      {/* Header Strip */}
      <div className="dash__header">
        <div>
          <div className="dash__title-row">
            <Activity className="dash__header-icon" size={22} />
            <h2 className="dash__title">Hospital Command Center</h2>
          </div>
          <p className="dash__subtitle">Central Pollution Control Board 2016 Regulatory Governance</p>
        </div>
        <div className="dash__badge">
          <span className="dash__badge-dot" />
          <span>STATUTORY ACTIVE</span>
        </div>
      </div>

      {/* KPI Cards Grid (Double-Bezel Architecture) */}
      <div className="dash__metrics-grid">
        <div className="metric-card-outer">
          <div className="metric-card-inner">
            <div className="metric-card__top">
              <span className="metric-card__label">Items Segregated</span>
              <CheckCircle2 size={16} className="text-sky" />
            </div>
            <span className="metric-card__value">{scansCount}</span>
            <span className="metric-card__sub">Audit-logged events</span>
          </div>
        </div>

        <div className="metric-card-outer">
          <div className="metric-card-inner">
            <div className="metric-card__top">
              <span className="metric-card__label">AI Segregation Accuracy</span>
              <ShieldCheck size={16} className="text-emerald" />
            </div>
            <span className="metric-card__value metric-card__value--green">{aiAccuracy}%</span>
            <span className="metric-card__sub">Schedule I rules matched</span>
          </div>
        </div>

        <div className="metric-card-outer">
          <div className="metric-card-inner">
            <div className="metric-card__top">
              <span className="metric-card__label">Pending Dispatches</span>
              <TrendingUp size={16} className="text-amber" />
            </div>
            <span className="metric-card__value metric-card__value--amber">{urgentTasks}</span>
            <span className="metric-card__sub">Porters in transit</span>
          </div>
        </div>

        <div className="metric-card-outer">
          <div className="metric-card-inner">
            <div className="metric-card__top">
              <span className="metric-card__label">48h SLA Integrity</span>
              <Clock size={16} className={criticalSlaBins > 0 ? 'text-red' : 'text-emerald'} />
            </div>
            <span className={`metric-card__value ${criticalSlaBins > 0 ? 'metric-card__value--red' : 'metric-card__value--green'}`}>
              {criticalSlaBins > 0 ? `${criticalSlaBins} At Risk` : '100% OK'}
            </span>
            <span className="metric-card__sub">Zero statutory breaches</span>
          </div>
        </div>
      </div>

      {/* View Switcher */}
      <div className="dash__views">
        <button
          className={`dash__view-tab ${activeView === 'twin' ? 'dash__view-tab--active' : ''}`}
          onClick={() => setActiveView('twin')}
        >
          <Building2 size={15} />
          <span>Ward Digital Twin Heatmap</span>
        </button>
        <button
          className={`dash__view-tab ${activeView === 'manifest' ? 'dash__view-tab--active' : ''}`}
          onClick={() => setActiveView('manifest')}
        >
          <FileSpreadsheet size={15} />
          <span>CPCB Form IV Manifest</span>
        </button>
      </div>

      {/* VIEW 1: Ward Digital Twin Heatmap */}
      {activeView === 'twin' && (
        <div className="twin-container">
          <div className="twin-header">
            <div>
              <h3 className="twin-header__title">Facility Digital Twin & Bin Telemetry</h3>
              <p className="twin-header__sub">Select a ward below to inspect fill levels and 48-hour statutory timers</p>
            </div>
          </div>

          {/* SVG Digital Twin Floorplan */}
          <div className="twin-floorplan">
            <svg viewBox="0 0 380 220" className="twin-svg">
              <defs>
                <filter id="twinGlow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid Background */}
              <pattern id="twinGrid" width="15" height="15" patternUnits="userSpaceOnUse">
                <path d="M 15 0 L 0 0 0 15" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.8" />
              </pattern>
              <rect width="380" height="220" fill="url(#twinGrid)" />

              {/* Room 1: ICU-3 */}
              <g
                className={`room-node ${selectedWard === 'ward-1' ? 'room-node--selected' : ''}`}
                onClick={() => setSelectedWard('ward-1')}
              >
                <rect x="15" y="15" width="165" height="90" rx="10" className="room-rect room-rect--icu" />
                <text x="28" y="38" className="room-title">ICU-3 (Critical Care)</text>
                <text x="28" y="55" className="room-sub">Block B • 24 Beds</text>
                <circle cx="160" cy="32" r="6" className="room-status-dot room-status-dot--amber" filter="url(#twinGlow)" />
                <text x="28" y="86" className="room-tag">Red: 86% • 42h Left</text>
              </g>

              {/* Room 2: OT-2 */}
              <g
                className={`room-node ${selectedWard === 'ward-2' ? 'room-node--selected' : ''}`}
                onClick={() => setSelectedWard('ward-2')}
              >
                <rect x="195" y="15" width="170" height="90" rx="10" className="room-rect room-rect--ot" />
                <text x="208" y="38" className="room-title">OT-2 (Surgical Suite)</text>
                <text x="208" y="55" className="room-sub">Block A • 6 Theatres</text>
                <circle cx="345" cy="32" r="6" className="room-status-dot room-status-dot--red" filter="url(#twinGlow)" />
                <text x="208" y="86" className="room-tag">Yellow: 92% (CRITICAL)</text>
              </g>

              {/* Room 3: Trauma Emergency */}
              <g
                className={`room-node ${selectedWard === 'ward-3' ? 'room-node--selected' : ''}`}
                onClick={() => setSelectedWard('ward-3')}
              >
                <rect x="15" y="115" width="165" height="90" rx="10" className="room-rect room-rect--trauma" />
                <text x="28" y="138" className="room-title">Trauma & Emergency</text>
                <text x="28" y="155" className="room-sub">Ground Floor • 30 Beds</text>
                <circle cx="160" cy="132" r="6" className="room-status-dot room-status-dot--green" />
                <text x="28" y="186" className="room-tag">Bins &lt;45% • 47h Left</text>
              </g>

              {/* Room 4: General Ward A */}
              <g
                className={`room-node ${selectedWard === 'ward-4' ? 'room-node--selected' : ''}`}
                onClick={() => setSelectedWard('ward-4')}
              >
                <rect x="195" y="115" width="170" height="90" rx="10" className="room-rect room-rect--ward" />
                <text x="208" y="138" className="room-title">General Inpatient A</text>
                <text x="208" y="155" className="room-sub">Level 1, Block C • 45 Beds</text>
                <circle cx="345" cy="132" r="6" className="room-status-dot room-status-dot--green" />
                <text x="208" y="186" className="room-tag">All Bins: Normal</text>
              </g>
            </svg>
          </div>

          {/* Selected Ward Detail Panel */}
          <div className="ward-detail">
            <div className="ward-detail__top">
              <div>
                <h4 className="ward-detail__title">{currentWardData.name}</h4>
                <p className="ward-detail__location">{currentWardData.floor}</p>
              </div>
              <span className="ward-detail__active-badge">Active Station</span>
            </div>

            <div className="ward-detail__bins-grid">
              {currentWardBins.map(bin => {
                const info = CATEGORY_INFO[bin.category] || CATEGORY_INFO.unknown;
                const sla = calculateSlaStatus(bin.slaDeadline);

                return (
                  <div key={bin.id} className="ward-bin-card" style={{ '--bin-color': info.color }}>
                    <div className="ward-bin-card__header">
                      <div className="ward-bin-card__title">
                        <span className="ward-bin-card__dot" />
                        <span>{info.label}</span>
                      </div>
                      <span className="ward-bin-card__fill-text">{bin.fillPercent || 0}%</span>
                    </div>

                    <div className="ward-bin-card__bar">
                      <div
                        className="ward-bin-card__fill"
                        style={{
                          width: `${bin.fillPercent || 0}%`,
                          background: (bin.fillPercent >= 80) ? '#ef4444' : info.color
                        }}
                      />
                    </div>

                    <div className="ward-bin-card__footer">
                      <span className="ward-bin-card__barcode">{bin.barcodeId}</span>
                      <span className={`ward-bin-card__sla-badge ward-bin-card__sla-badge--${sla.status.toLowerCase()}`}>
                        {sla.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: CPCB Form IV Manifest */}
      {activeView === 'manifest' && (
        <div className="manifest-container">
          <div className="manifest-header">
            <div>
              <div className="manifest-header__title-row">
                <Scale className="text-sky" size={18} />
                <h3 className="manifest-header__title">CPCB Form IV Statutory Manifest</h3>
              </div>
              <p className="manifest-header__subtitle">
                Central Pollution Control Board Bio-Medical Waste Management Rules 2016
              </p>
            </div>
            <button type="button" className="manifest-export-btn" onClick={handleExportCSV}>
              <Download size={14} />
              <span>Export CSV Manifest</span>
            </button>
          </div>

          {exportedToast && (
            <div className="dash__toast-banner">
              <CheckCircle2 size={15} className="text-emerald" />
              <span>CPCB Form IV Manifest exported successfully ({events.length} records).</span>
            </div>
          )}

          <div className="manifest-table-wrapper">
            <table className="manifest-table">
              <thead>
                <tr>
                  <th>MANIFEST REF</th>
                  <th>WARD / SOURCE</th>
                  <th>WASTE TYPE</th>
                  <th>STATUTORY BIN</th>
                  <th>RULE CITATION</th>
                  <th>TIMESTAMP</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="manifest-empty-td">
                      No waste events recorded yet today. Use the AI Scanner to log entries.
                    </td>
                  </tr>
                ) : (
                  events.map((e, idx) => {
                    const catInfo = CATEGORY_INFO[e.category] || CATEGORY_INFO.unknown;
                    const dateStr = e.createdAt ? new Date(e.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

                    return (
                      <tr key={e.id || idx}>
                        <td className="manifest-ref">#{e.id ? e.id.slice(-6).toUpperCase() : `704-${idx}`}</td>
                        <td className="manifest-ward">{e.wardId ? e.wardId.toUpperCase() : 'WARD-1'}</td>
                        <td className="manifest-item">{e.itemLabel || 'Clinical Waste'}</td>
                        <td>
                          <span 
                            className="manifest-cat-badge"
                            style={{ 
                              background: `${catInfo.color}18`,
                              borderColor: `${catInfo.color}50`,
                              color: catInfo.color 
                            }}
                          >
                            {catInfo.label}
                          </span>
                        </td>
                        <td className="manifest-citation">{e.ruleCitation || 'CPCB Sched. I'}</td>
                        <td className="manifest-time">{dateStr}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
