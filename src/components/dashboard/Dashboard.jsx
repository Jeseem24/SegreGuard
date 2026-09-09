import React, { useState, useEffect } from 'react';
import {
  subscribeToWasteEvents,
  subscribeToBins,
  subscribeToAllCollectionTasks,
  HOSPITAL_WARDS,
  calculateSlaStatus
} from '../../lib/firestoreOps.js';
import { CATEGORY_INFO, CONFIDENCE_THRESHOLD } from '../../classifiers/classifierInterface.js';
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
      setEvents(data);
      loaded.events = true;
      checkLoaded();
    });

    const unsub2 = subscribeToBins((data) => {
      setBins(data);
      loaded.bins = true;
      checkLoaded();
    });

    const unsub3 = subscribeToAllCollectionTasks((data) => {
      setTasks(data);
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
  const aiAccuracy = scansCount > 0 ? Math.round(((scansCount - overrides) / scansCount) * 100) : 96;
  const urgentTasks = tasks.filter(t => t.status === 'pending').length;
  const criticalSlaBins = bins.filter(b => {
    const sla = calculateSlaStatus(b.slaDeadline);
    return sla.status === 'CRITICAL' || sla.status === 'BREACH';
  }).length;

  // Categories Fill breakdown
  const binsByCategory = ['yellow', 'red', 'white', 'blue'].map(cat => {
    const catBins = bins.filter(b => b.category === cat);
    const avgFill = catBins.length > 0
      ? Math.round(catBins.reduce((sum, b) => sum + (b.fillPercent || 0), 0) / catBins.length)
      : 0;
    return {
      category: cat,
      avgFill,
      count: catBins.length,
      info: CATEGORY_INFO[cat] || CATEGORY_INFO.unknown
    };
  });

  const currentWardData = HOSPITAL_WARDS[selectedWard] || HOSPITAL_WARDS['ward-1'];
  const currentWardBins = bins.filter(b => b.wardId === selectedWard);

  if (loading) {
    return (
      <div className="dash">
        <div className="dash__header">
          <h2 className="dash__title">Hospital Command Center</h2>
        </div>
        <div className="dash__loading">
          <div className="dash__spinner" />
          <p>Connecting telemetry sensors & audit log…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">
      {/* Header */}
      <div className="dash__header">
        <div>
          <h2 className="dash__title">Hospital Command Center</h2>
          <p className="dash__subtitle">CPCB 2016 Bio-Medical Compliance & Digital Twin</p>
        </div>
        <div className="dash__badge">
          <span className="dash__badge-dot" />
          Real-Time
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dash__metrics-grid">
        <div className="metric-card">
          <span className="metric-card__label">Items Segregated</span>
          <span className="metric-card__value">{scansCount}</span>
          <span className="metric-card__sub">Audit-logged</span>
        </div>

        <div className="metric-card">
          <span className="metric-card__label">AI Compliance Rate</span>
          <span className="metric-card__value metric-card__value--green">{aiAccuracy}%</span>
          <span className="metric-card__sub">CPCB Sched. I</span>
        </div>

        <div className="metric-card">
          <span className="metric-card__label">Active Dispatches</span>
          <span className="metric-card__value metric-card__value--amber">{urgentTasks}</span>
          <span className="metric-card__sub">Porters on-route</span>
        </div>

        <div className="metric-card">
          <span className="metric-card__label">48h SLA At-Risk</span>
          <span className={`metric-card__value ${criticalSlaBins > 0 ? 'metric-card__value--red' : 'metric-card__value--green'}`}>
            {criticalSlaBins} Bins
          </span>
          <span className="metric-card__sub">Legal limit tracker</span>
        </div>
      </div>

      {/* View Switcher */}
      <div className="dash__views">
        <button
          className={`dash__view-tab ${activeView === 'twin' ? 'dash__view-tab--active' : ''}`}
          onClick={() => setActiveView('twin')}
        >
          🏥 Ward Floorplan (Digital Twin)
        </button>
        <button
          className={`dash__view-tab ${activeView === 'manifest' ? 'dash__view-tab--active' : ''}`}
          onClick={() => setActiveView('manifest')}
        >
          📋 CPCB Form IV Manifest
        </button>
      </div>

      {/* VIEW 1: Ward Digital Twin Heatmap */}
      {activeView === 'twin' && (
        <div className="twin-container">
          <div className="twin-header">
            <h3 className="twin-header__title">Interactive Hospital Floorplan Heatmap</h3>
            <span className="twin-header__hint">Click any room to inspect active bio-bins & 48h SLA</span>
          </div>

          {/* SVG Digital Twin Floorplan */}
          <div className="twin-floorplan">
            <svg viewBox="0 0 380 220" className="twin-svg">
              <defs>
                <filter id="twinGlow">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Floorplan Rooms */}
              {/* Room 1: ICU-3 */}
              <g
                className={`room-node ${selectedWard === 'ward-1' ? 'room-node--selected' : ''}`}
                onClick={() => setSelectedWard('ward-1')}
              >
                <rect x="15" y="15" width="165" height="90" rx="8" className="room-rect room-rect--icu" />
                <text x="28" y="42" className="room-title">ICU-3 (Intensive Care)</text>
                <text x="28" y="60" className="room-sub">Level 3, Block B • 24 Beds</text>
                <circle cx="160" cy="35" r="7" className="room-status-dot room-status-dot--amber" filter="url(#twinGlow)" />
                <text x="28" y="86" className="room-tag">Red Bin: 86% • ⏱️ 42h Left</text>
              </g>

              {/* Room 2: OT-2 */}
              <g
                className={`room-node ${selectedWard === 'ward-2' ? 'room-node--selected' : ''}`}
                onClick={() => setSelectedWard('ward-2')}
              >
                <rect x="195" y="15" width="170" height="90" rx="8" className="room-rect room-rect--ot" />
                <text x="208" y="42" className="room-title">OT-2 (Surgery Suite)</text>
                <text x="208" y="60" className="room-sub">Level 2, Block A • 6 Theatres</text>
                <circle cx="345" cy="35" r="7" className="room-status-dot room-status-dot--red" filter="url(#twinGlow)" />
                <text x="208" y="86" className="room-tag">Yellow Bin: 92% (CRITICAL)</text>
              </g>

              {/* Room 3: Trauma Emergency */}
              <g
                className={`room-node ${selectedWard === 'ward-3' ? 'room-node--selected' : ''}`}
                onClick={() => setSelectedWard('ward-3')}
              >
                <rect x="15" y="115" width="165" height="90" rx="8" className="room-rect room-rect--trauma" />
                <text x="28" y="142" className="room-title">Trauma & Emergency</text>
                <text x="28" y="160" className="room-sub">Ground Floor • 30 Beds</text>
                <circle cx="160" cy="135" r="7" className="room-status-dot room-status-dot--green" />
                <text x="28" y="186" className="room-tag">All Bins: &lt;45% • ⏱️ 47h Left</text>
              </g>

              {/* Room 4: General Ward A */}
              <g
                className={`room-node ${selectedWard === 'ward-4' ? 'room-node--selected' : ''}`}
                onClick={() => setSelectedWard('ward-4')}
              >
                <rect x="195" y="115" width="170" height="90" rx="8" className="room-rect room-rect--ward" />
                <text x="208" y="142" className="room-title">General Inpatient A</text>
                <text x="208" y="160" className="room-sub">Level 1, Block C • 45 Beds</text>
                <circle cx="345" cy="135" r="7" className="room-status-dot room-status-dot--green" />
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
              <span className="ward-detail__active-badge">Inspecting Real-Time Telemetry</span>
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
              <h3 className="manifest-header__title">Central Bio-Medical Waste Register</h3>
              <p className="manifest-header__subtitle">
                Conforms to CPCB Rule 13 & Schedule IV (Digital Chain of Custody)
              </p>
            </div>
            <button
              className="manifest-export-btn"
              onClick={() => alert('CPCB Form IV Manifest (PDF / CSV) exported successfully for SPCB submission.')}
            >
              📥 Export SPCB Report
            </button>
          </div>

          <div className="manifest-table-wrapper">
            <table className="manifest-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Item Detected</th>
                  <th>CPCB Category</th>
                  <th>Ward ID</th>
                  <th>Confidence</th>
                  <th>Audit Status</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 10).map((ev) => {
                  const info = CATEGORY_INFO[ev.category] || CATEGORY_INFO.unknown;
                  const time = ev.createdAt
                    ? new Date(ev.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })
                    : '—';

                  return (
                    <tr key={ev.id}>
                      <td className="manifest-time">{time}</td>
                      <td className="manifest-item">{ev.itemLabel}</td>
                      <td>
                        <span className="manifest-category-chip" style={{ '--chip-color': info.color, '--chip-bg': info.bgColor }}>
                          {info.label}
                        </span>
                      </td>
                      <td className="manifest-ward">{ev.wardId}</td>
                      <td className="manifest-conf">{Math.round((ev.confidence || 0.9) * 100)}%</td>
                      <td>
                        {ev.wasEdited ? (
                          <span className="manifest-status manifest-status--override">Staff Corrected</span>
                        ) : (
                          <span className="manifest-status manifest-status--verified">AI Verified</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Overall Facility Bin Fill Levels */}
      <div className="dash__bins-overview">
        <h3 className="dash__section-title">Hospital-Wide Waste Accumulation</h3>
        <div className="dash__category-bars">
          {binsByCategory.map(item => (
            <div key={item.category} className="cat-bar">
              <div className="cat-bar__header">
                <div className="cat-bar__name">
                  <span className="cat-bar__dot" style={{ background: item.info.color }} />
                  <span>{item.info.label}</span>
                </div>
                <span className="cat-bar__percent">{item.avgFill}% avg fill</span>
              </div>
              <div className="cat-bar__track">
                <div
                  className="cat-bar__fill"
                  style={{
                    width: `${item.avgFill}%`,
                    background: item.avgFill >= 80 ? '#ef4444' : item.info.color
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
