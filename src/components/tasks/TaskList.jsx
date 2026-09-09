import React, { useState, useEffect } from 'react';
import {
  subscribeToBins,
  subscribeToWasteEvents,
  subscribeToCollectionTasks,
  markBinCollected,
  markWardCollected,
  calculateSlaStatus,
  requestPickup,
  updateBinFill,
  HOSPITAL_WARDS
} from '../../lib/firestoreOps.js';
import { CATEGORY_INFO } from '../../classifiers/classifierInterface.js';
import { 
  Boxes, 
  Map, 
  Clock, 
  CheckCircle2, 
  Truck, 
  Navigation, 
  Sparkles, 
  PlusCircle,
  Building2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RotateCcw,
  Check,
  QrCode,
  Layers,
  ArrowRight
} from 'lucide-react';
import './Tasks.css';

export default function TaskList() {
  const [bins, setBins] = useState([]);
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'route'
  const [expandedWards, setExpandedWards] = useState({ 'ward-1': true, 'ward-2': true }); // Default first 2 open
  const [actionSuccess, setActionSuccess] = useState(null); // feedback toast
  const [selectedMapWard, setSelectedMapWard] = useState(null);

  useEffect(() => {
    const unsubBins = subscribeToBins((data) => setBins(data || []));
    const unsubEvents = subscribeToWasteEvents(null, (data) => setEvents(data || []));
    const unsubTasks = subscribeToCollectionTasks((data) => setTasks(data || []));

    return () => {
      unsubBins();
      unsubEvents();
      unsubTasks();
    };
  }, []);

  const toggleWard = (wardId) => {
    setExpandedWards(prev => ({
      ...prev,
      [wardId]: !prev[wardId]
    }));
  };

  const handleConfirmBinPickup = async (binId, wardName, categoryLabel) => {
    try {
      await markBinCollected(binId);
      showFeedback(`Reset ${categoryLabel} in ${wardName} to 0% capacity`);
    } catch (err) {
      console.error('Failed to collect bin:', err);
    }
  };

  const handleConfirmWardPickup = async (wardId, wardName) => {
    try {
      await markWardCollected(wardId);
      showFeedback(`Collected all 4 bins for ${wardName}`);
    } catch (err) {
      console.error('Failed to collect ward:', err);
    }
  };

  const showFeedback = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => {
      setActionSuccess(null);
    }, 3200);
  };

  const handleSimulateWardAlert = async () => {
    const wardKeys = Object.keys(HOSPITAL_WARDS);
    const randomWard = wardKeys[Math.floor(Math.random() * wardKeys.length)];
    const categories = ['yellow', 'red', 'white', 'blue'];
    const randomCat = categories[Math.floor(Math.random() * categories.length)];
    
    // Increment fill by 40% to push toward/over capacity
    await updateBinFill(randomCat, randomWard, 40);
    showFeedback(`Simulated bio-waste fill surge in ${HOSPITAL_WARDS[randomWard].name}`);
  };

  // Group bins and waste events by ward
  const wardEntries = Object.entries(HOSPITAL_WARDS);

  // Quick statistics calculation
  const totalBins = bins.length;
  const criticalBins = bins.filter(b => (b.fillPercent || 0) >= 80);
  const urgentSlaBins = bins.filter(b => {
    const sla = calculateSlaStatus(b.slaDeadline);
    return sla.status === 'CRITICAL' || sla.status === 'BREACH';
  });

  return (
    <div className="tasks">
      {/* Toast Notification */}
      {actionSuccess && (
        <div className="tasks__toast">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Header */}
      <div className="tasks__header">
        <div>
          <div className="tasks__title-row">
            <Truck className="tasks__header-icon" size={20} />
            <h2 className="tasks__title">Logistics & SLA Dispatch</h2>
          </div>
          <p className="tasks__subtitle">Ward-wise bio-medical custody, fill monitoring & 48h CPCB SLA</p>
        </div>
        <div className="tasks__live-badge">
          <span className="tasks__live-dot" />
          <span>REALTIME</span>
        </div>
      </div>

      {/* KPI Overview Pills */}
      <div className="tasks__kpi-grid">
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">Active Wards</span>
          <span className="tasks__kpi-val">{wardEntries.length} Units</span>
        </div>
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">High-Fill Bins (≥80%)</span>
          <span className={`tasks__kpi-val ${criticalBins.length > 0 ? 'text-amber' : 'text-emerald'}`}>
            {criticalBins.length} Bins
          </span>
        </div>
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">CPCB 48h SLA Alerts</span>
          <span className={`tasks__kpi-val ${urgentSlaBins.length > 0 ? 'text-rose' : 'text-emerald'}`}>
            {urgentSlaBins.length} Urgent
          </span>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="tasks__view-toggle">
        <button
          type="button"
          className={`tasks__toggle-btn ${viewMode === 'list' ? 'tasks__toggle-btn--active' : ''}`}
          onClick={() => setViewMode('list')}
        >
          <Building2 size={15} />
          <span>Ward-Wise Dispatch ({wardEntries.length})</span>
        </button>
        <button
          type="button"
          className={`tasks__toggle-btn ${viewMode === 'route' ? 'tasks__toggle-btn--active' : ''}`}
          onClick={() => setViewMode('route')}
        >
          <Navigation size={15} />
          <span>Corridor Transit Map</span>
        </button>
      </div>

      {/* VIEW 1: Ward-Wise Station List */}
      {viewMode === 'list' && (
        <div className="ward-list">
          <div className="tasks__toolbar">
            <span className="tasks__toolbar-info">
              Showing 4 hospital containment zones. Expand any ward to inspect 4-color bin fill levels.
            </span>
            <button 
              type="button"
              className="tasks__quick-sim-btn"
              onClick={handleSimulateWardAlert}
            >
              <PlusCircle size={14} />
              <span>Simulate Ward Surge</span>
            </button>
          </div>

          {wardEntries.map(([wardId, ward]) => {
            const wardBins = bins.filter(b => b.wardId === wardId);
            const wardEvents = events.filter(e => e.wardId === wardId);
            const isExpanded = !!expandedWards[wardId];

            // Compute highest fill bin in ward
            let maxFill = 0;
            let maxFillCategory = 'yellow';
            let mostUrgentSla = null;

            wardBins.forEach(b => {
              if ((b.fillPercent || 0) > maxFill) {
                maxFill = b.fillPercent || 0;
                maxFillCategory = b.category;
              }
              const sla = calculateSlaStatus(b.slaDeadline);
              if (!mostUrgentSla || sla.hoursLeft < mostUrgentSla.hoursLeft) {
                mostUrgentSla = sla;
              }
            });

            const maxFillInfo = CATEGORY_INFO[maxFillCategory] || CATEGORY_INFO.unknown;
            const hasCritical = maxFill >= 80;
            const hasSlaWarning = mostUrgentSla && (mostUrgentSla.status === 'CRITICAL' || mostUrgentSla.status === 'BREACH');

            return (
              <div 
                key={wardId}
                className={`ward-card ${hasCritical ? 'ward-card--critical' : ''} ${isExpanded ? 'ward-card--expanded' : ''}`}
              >
                {/* Ward Header / Master Summary */}
                <div className="ward-card__header" onClick={() => toggleWard(wardId)}>
                  <div className="ward-card__title-col">
                    <div className="ward-card__location-badge">
                      <Building2 size={14} />
                      <span>{ward.floor}</span>
                    </div>
                    <h3 className="ward-card__name">{ward.name}</h3>
                    <div className="ward-card__meta-tags">
                      <span className="ward-card__meta-pill">
                        <Layers size={12} />
                        {wardEvents.length} items logged
                      </span>
                      <span className="ward-card__meta-pill">
                        {ward.bedCount} Beds
                      </span>
                    </div>
                  </div>

                  <div className="ward-card__status-col">
                    {/* Highest Fill Level indicator */}
                    <div className="ward-card__fill-indicator">
                      <div className="ward-card__fill-gauge">
                        <div 
                          className="ward-card__fill-bar" 
                          style={{ 
                            width: `${maxFill}%`,
                            background: maxFill >= 80 ? '#ef4444' : maxFill >= 50 ? '#f59e0b' : '#10b981'
                          }} 
                        />
                      </div>
                      <div className="ward-card__fill-labels">
                        <span className="ward-card__fill-text">
                          Peak: <strong>{maxFill}%</strong> ({maxFillInfo.label.split(' ')[0]})
                        </span>
                        {hasCritical && <span className="ward-card__crit-tag">OVERFLOW ALERT</span>}
                      </div>
                    </div>

                    {/* SLA status */}
                    {mostUrgentSla && (
                      <div className={`ward-card__sla-chip ward-card__sla-chip--${mostUrgentSla.status.toLowerCase()}`}>
                        <Clock size={11} />
                        <span>CPCB SLA: {mostUrgentSla.hoursLeft}h left</span>
                      </div>
                    )}
                  </div>

                  <button 
                    type="button" 
                    className="ward-card__chevron-btn"
                    aria-label="Toggle ward details"
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>

                {/* Ward Level One-Click Confirm Pickup */}
                <div className="ward-card__quick-actions">
                  <button
                    type="button"
                    className="ward-card__collect-all-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConfirmWardPickup(wardId, ward.name);
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Confirm Full Ward Pickup (Reset All 4 Bins)</span>
                  </button>
                </div>

                {/* Expanded Details: 4-Bin Matrix & Station Diagnostics */}
                {isExpanded && (
                  <div className="ward-card__body">
                    <div className="ward-card__body-header">
                      <h4 className="ward-card__body-title">Statutory 4-Color Segregation Bins</h4>
                      <span className="ward-card__body-sub">CPCB 2016 Rule 4 Standard</span>
                    </div>

                    <div className="ward-bins-grid">
                      {['yellow', 'red', 'white', 'blue'].map((cat) => {
                        const bin = wardBins.find(b => b.category === cat) || {
                          id: `bin-${cat}-${wardId}`,
                          fillPercent: 0,
                          barcodeId: `BIN-${cat.toUpperCase()}-${wardId.toUpperCase()}`,
                          slaDeadline: Date.now() + 48 * 3600 * 1000
                        };
                        const catInfo = CATEGORY_INFO[cat] || CATEGORY_INFO.unknown;
                        const binEvents = wardEvents.filter(e => e.category === cat);
                        const binSla = calculateSlaStatus(bin.slaDeadline);
                        const fill = bin.fillPercent || 0;
                        const isOver = fill >= 80;

                        return (
                          <div 
                            key={cat}
                            className={`bin-cell ${isOver ? 'bin-cell--critical' : ''}`}
                            style={{ '--bin-theme': catInfo.color }}
                          >
                            <div className="bin-cell__top">
                              <div className="bin-cell__badge" style={{ background: `${catInfo.color}20`, borderColor: `${catInfo.color}50` }}>
                                <span className="bin-cell__dot" style={{ background: catInfo.color }} />
                                <span className="bin-cell__label" style={{ color: catInfo.color }}>{catInfo.label}</span>
                              </div>
                              <span className="bin-cell__barcode">
                                <QrCode size={11} />
                                {bin.barcodeId}
                              </span>
                            </div>

                            {/* Capacity Meter */}
                            <div className="bin-cell__meter-section">
                              <div className="bin-cell__meter-header">
                                <span className="bin-cell__meter-title">Fill Status</span>
                                <span className="bin-cell__meter-val" style={{ color: fill >= 80 ? '#f87171' : fill >= 50 ? '#fbbf24' : '#34d399' }}>
                                  {fill}%
                                </span>
                              </div>
                              <div className="bin-cell__meter-track">
                                <div 
                                  className="bin-cell__meter-fill" 
                                  style={{ 
                                    width: `${fill}%`, 
                                    background: catInfo.color 
                                  }} 
                                />
                              </div>
                            </div>

                            {/* Item Count & SLA */}
                            <div className="bin-cell__meta-row">
                              <span className="bin-cell__items-count">
                                <strong>{binEvents.length}</strong> items logged
                              </span>
                              <span className={`bin-cell__sla-text bin-cell__sla-text--${binSla.status.toLowerCase()}`}>
                                <Clock size={11} />
                                {binSla.text}
                              </span>
                            </div>

                            {/* Bin Action */}
                            <button
                              type="button"
                              className="bin-cell__action-btn"
                              onClick={() => handleConfirmBinPickup(bin.id, ward.name, catInfo.label)}
                            >
                              <RotateCcw size={13} />
                              <span>Confirm Bin Pickup</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: Route Optimization Corridor Map */}
      {viewMode === 'route' && (
        <div className="route-view">
          <div className="route-view__metrics">
            <div className="route-metric">
              <span className="route-metric__label">Stations Active</span>
              <span className="route-metric__value">{wardEntries.length} Wards</span>
            </div>
            <div className="route-metric">
              <span className="route-metric__label">Urgent Bins</span>
              <span className="route-metric__value route-metric__value--highlight">
                {criticalBins.length} Over 80%
              </span>
            </div>
            <div className="route-metric">
              <span className="route-metric__label">Exposure Risk</span>
              <span className="route-metric__value text-emerald">Minimal / Compliant</span>
            </div>
          </div>

          <div className="route-map-container">
            <svg className="route-map" viewBox="0 0 400 320">
              <defs>
                <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Blueprint Grid */}
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              </pattern>
              <rect width="400" height="320" fill="url(#grid)" />

              {/* Facility Floorplan Boundary */}
              <rect x="20" y="20" width="360" height="280" rx="16" fill="rgba(15, 23, 42, 0.7)" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1.5" />
              <text x="35" y="45" fill="#64748b" fontSize="9" fontWeight="700" letterSpacing="1" fontFamily="JetBrains Mono">
                FACILITY FLOORPLAN • WARD LOGISTICS MATRIX
              </text>

              {/* Transit Path Line */}
              <path
                d="M 55 255 L 125 125 L 285 95 L 270 235 Z"
                fill="rgba(56, 189, 248, 0.04)"
                stroke="url(#routeGradient)"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                className="route-path-animated"
              />

              {/* Central Bio-Waste Collection Hub */}
              <g transform="translate(55, 255)">
                <circle r="14" fill="#0b1329" stroke="#10b981" strokeWidth="2.5" filter="url(#glow)" />
                <circle r="5" fill="#10b981" />
                <text y="24" textAnchor="middle" fill="#34d399" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono">
                  CBWTF Bay
                </text>
              </g>

              {/* Hospital Wards Nodes */}
              {wardEntries.map(([wId, ward]) => {
                const wardBins = bins.filter(b => b.wardId === wId);
                const hasOver = wardBins.some(b => (b.fillPercent || 0) >= 80);
                const x = ward.coords.x * 3.6;
                const y = ward.coords.y * 2.8;
                const isSelected = selectedMapWard && selectedMapWard.id === wId;

                return (
                  <g
                    key={wId}
                    transform={`translate(${x}, ${y})`}
                    className="route-pin"
                    onClick={() => setSelectedMapWard(ward)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      r={hasOver ? 16 : 12}
                      fill={hasOver ? '#ef4444' : '#1e293b'}
                      stroke={isSelected ? '#38bdf8' : hasOver ? '#fee2e2' : '#475569'}
                      strokeWidth={isSelected ? 3 : hasOver ? 2 : 1.2}
                      filter={hasOver || isSelected ? 'url(#glow)' : undefined}
                      className={hasOver ? 'pin-pulse' : ''}
                    />
                    <text y="3.5" textAnchor="middle" fill={hasOver ? '#ffffff' : '#94a3b8'} fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">
                      {wId.replace('ward-', 'W')}
                    </text>
                    <text y="24" textAnchor="middle" fill={isSelected ? '#38bdf8' : '#cbd5e1'} fontSize="8" fontWeight="600">
                      {ward.name.split(' ')[0]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Interactive Selected Station Popover */}
          {selectedMapWard && (
            <div className="route-station-card">
              <div className="route-station-card__header">
                <div>
                  <h4 className="route-station-card__title">{selectedMapWard.name}</h4>
                  <p className="route-station-card__sub">{selectedMapWard.floor} • Node {selectedMapWard.id.toUpperCase()}</p>
                </div>
                <button 
                  type="button"
                  className="route-station-card__close"
                  onClick={() => setSelectedMapWard(null)}
                  title="Close station details"
                >
                  ✕
                </button>
              </div>

              <div className="route-station-card__body">
                <div className="route-station-card__bins">
                  {['yellow', 'red', 'white', 'blue'].map(cat => {
                    const b = bins.find(item => item.wardId === selectedMapWard.id && item.category === cat) || {
                      id: `bin-${cat}-${selectedMapWard.id}`,
                      fillPercent: 0
                    };
                    const cInfo = CATEGORY_INFO[cat] || CATEGORY_INFO.unknown;
                    const fill = b.fillPercent || 0;

                    return (
                      <div key={cat} className="route-station-bin-pill">
                        <span className="route-station-bin-dot" style={{ background: cInfo.color }} />
                        <span className="route-station-bin-name">{cInfo.label.split(' ')[0]}</span>
                        <span className="route-station-bin-pct" style={{ color: fill >= 80 ? '#f87171' : '#cbd5e1' }}>
                          {fill}%
                        </span>
                        <button
                          type="button"
                          className="route-station-reset-btn"
                          onClick={() => handleConfirmBinPickup(b.id, selectedMapWard.name, cInfo.label)}
                          title="Reset Bin"
                        >
                          <RotateCcw size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="route-station-collect-ward-btn"
                  onClick={() => {
                    handleConfirmWardPickup(selectedMapWard.id, selectedMapWard.name);
                    setSelectedMapWard(null);
                  }}
                >
                  <CheckCircle2 size={14} />
                  <span>Confirm Pickup for Entire Ward</span>
                </button>
              </div>
            </div>
          )}

          <div className="route-view__tip">
            <Sparkles size={16} className="text-sky" />
            <span>
              <strong>Floorplan Navigation:</strong> Tap any station pin to view 4-bin capacity status and immediately confirm ward transit collections.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
