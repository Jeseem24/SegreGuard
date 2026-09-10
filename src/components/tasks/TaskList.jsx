import React, { useState, useEffect, useMemo } from 'react';
import {
  subscribeToPickupRequests,
  subscribeToBins,
  subscribeToLiveAlerts,
  acceptLogisticsRequest,
  completeLogisticsRequest,
  scheduleHospitalPickup,
  HOSPITALS,
  CBWTF_FACILITY
} from '../../lib/firestoreOps.js';
import { CATEGORY_INFO } from '../../classifiers/classifierInterface.js';
import { 
  Truck, 
  Navigation, 
  CheckCircle2, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  Building2, 
  ArrowRight, 
  Check, 
  ShieldCheck, 
  Sparkles,
  Package,
  Layers,
  Compass,
  Phone,
  RotateCcw,
  Activity,
  Plus,
  ChevronDown,
  ChevronUp,
  Flame,
  Zap,
  Radio,
  Gauge,
  Eye,
  EyeOff
} from 'lucide-react';
import './Tasks.css';

// High-precision coordinates for the Regional City Map SVG (400x240)
const HOSP_MAP_COORDS = {
  'hosp-apex': { x: 125, y: 120 },
  'hosp-fortis': { x: 185, y: 60 },
  'hosp-metro': { x: 285, y: 75 },
  'hosp-city': { x: 325, y: 155 },
  'hosp-apollo': { x: 220, y: 195 }
};

export default function TaskList() {
  const [requests, setRequests] = useState([]);
  const [bins, setBins] = useState([]);
  const [viewMode, setViewMode] = useState('routing'); // 'routing' | 'incoming'
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'active' | 'pending' | 'critical'
  const [showMap, setShowMap] = useState(false); // Collapsed by default for clean, clutter-free UX
  const [actionSuccess, setActionSuccess] = useState(null);
  const [liveAlert, setLiveAlert] = useState(null);
  const [selectedMapPin, setSelectedMapPin] = useState(null);
  const [expandedWardHosp, setExpandedWardHosp] = useState(null);

  useEffect(() => {
    const unsubReqs = subscribeToPickupRequests((data) => setRequests(data || []));
    const unsubBins = subscribeToBins((data) => setBins(data || []));
    const unsubAlerts = subscribeToLiveAlerts((alert) => {
      setLiveAlert(alert);
      setTimeout(() => setLiveAlert(null), 5000);
    });

    return () => {
      unsubReqs();
      unsubBins();
      unsubAlerts();
    };
  }, []);

  const showFeedback = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const handleAccept = async (requestId, hospitalName) => {
    try {
      await acceptLogisticsRequest(requestId, 'CBWTF Fleet Unit #3');
      showFeedback(`Accepted delivery request for ${hospitalName}! Added to Smart Route.`);
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  const handleComplete = async (requestId, hospitalName) => {
    try {
      await completeLogisticsRequest(requestId);
      showFeedback(`Waste collected from ${hospitalName}. Bins reset to 0% & digital custody signed ✓`);
    } catch (err) {
      console.error('Failed to complete pickup:', err);
    }
  };

  const handleScheduleDirect = async (hospitalId, hospitalName) => {
    try {
      await scheduleHospitalPickup(hospitalId, 'HIGH');
      showFeedback(`${hospitalName} prioritized and added to active transit route!`);
    } catch (err) {
      console.error('Failed to schedule pickup:', err);
    }
  };

  // Filter requests
  const incomingRequests = requests.filter(r => r.status === 'logistics_pending');
  const acceptedRequests = requests.filter(r => r.status === 'accepted');

  // Smart Routing Priority Sequence for active stops
  const sortedRoute = useMemo(() => {
    const urgencyWeight = { 'CRITICAL': 3, 'HIGH': 2, 'NORMAL': 1 };
    return [...acceptedRequests].sort((a, b) => {
      const weightA = urgencyWeight[a.urgency] || 1;
      const weightB = urgencyWeight[b.urgency] || 1;
      if (weightB !== weightA) return weightB - weightA;
      const distA = HOSPITALS[a.hospitalId]?.distanceFromHubKm || 10;
      const distB = HOSPITALS[b.hospitalId]?.distanceFromHubKm || 10;
      return distA - distB;
    });
  }, [acceptedRequests]);

  // Comprehensive Hospital List for Smart Routing
  const allHospitalsList = useMemo(() => {
    const all = Object.values(HOSPITALS).map((hosp) => {
      const activeReq = requests.find(r => r.hospitalId === hosp.id && (r.status === 'accepted' || r.status === 'logistics_pending'));
      const isAccepted = activeReq && activeReq.status === 'accepted';
      const isPending = activeReq && activeReq.status === 'logistics_pending';

      const stopIndex = isAccepted ? sortedRoute.findIndex(r => r.id === activeReq.id) : -1;

      // Hospital bins telemetry
      const hospBins = bins.filter(b => b.hospitalId === hosp.id);
      
      const getCategoryFill = (cat) => {
        const catBins = hospBins.filter(b => b.category === cat);
        if (!catBins.length) return hosp.id === 'hosp-fortis' && cat === 'red' ? 84 : 
                                     hosp.id === 'hosp-metro' && cat === 'yellow' ? 88 :
                                     hosp.id === 'hosp-apex' && cat === 'red' ? 86 : 28;
        return Math.max(...catBins.map(b => b.fillPercent || 0));
      };

      const binStats = {
        yellow: getCategoryFill('yellow'),
        red: getCategoryFill('red'),
        blue: getCategoryFill('blue'),
        white: getCategoryFill('white')
      };

      const maxFill = Math.max(binStats.yellow, binStats.red, binStats.blue, binStats.white);
      const isCritical = maxFill >= 80 || (activeReq && activeReq.urgency === 'CRITICAL');

      return {
        ...hosp,
        activeReq,
        isAccepted,
        isPending,
        stopIndex,
        binStats,
        maxFill,
        isCritical,
        estimatedBags: activeReq ? activeReq.estimatedBags : Math.max(4, Math.round(hosp.bedCount / 50)),
        estimatedWeightKg: activeReq ? activeReq.estimatedWeightKg : Number((hosp.bedCount * 0.05).toFixed(1)),
        urgency: activeReq ? activeReq.urgency : (maxFill >= 80 ? 'CRITICAL' : maxFill >= 65 ? 'HIGH' : 'NORMAL')
      };
    });

    return all.sort((a, b) => {
      if (a.isAccepted && b.isAccepted) return a.stopIndex - b.stopIndex;
      if (a.isAccepted) return -1;
      if (b.isAccepted) return 1;
      if (a.isPending && !b.isPending) return -1;
      if (!a.isPending && b.isPending) return 1;
      return b.maxFill - a.maxFill;
    });
  }, [requests, bins, sortedRoute]);

  // Apply quick filter
  const filteredHospitals = useMemo(() => {
    if (filterMode === 'active') return allHospitalsList.filter(h => h.isAccepted);
    if (filterMode === 'pending') return allHospitalsList.filter(h => h.isPending);
    if (filterMode === 'critical') return allHospitalsList.filter(h => h.isCritical);
    return allHospitalsList;
  }, [allHospitalsList, filterMode]);

  const totalBags = sortedRoute.reduce((sum, r) => sum + (r.estimatedBags || 0), 0);
  const totalWeightKg = sortedRoute.reduce((sum, r) => sum + (r.estimatedWeightKg || 0), 0).toFixed(1);
  const totalHospitalsCount = Object.keys(HOSPITALS).length;

  return (
    <div className="tasks">
      {/* Live Cross-Role Synchronized Pop-up Banner */}
      {liveAlert && (
        <div className={`tasks__live-alert-banner tasks__live-alert-banner--${liveAlert.type}`}>
          <div className="tasks__live-alert-icon">
            <span className="tasks__live-pulse-dot" />
          </div>
          <div className="tasks__live-alert-body">
            <div className="tasks__live-alert-top">
              <span className="tasks__live-alert-tag">LIVE REGIONAL NETWORK</span>
              <span className="tasks__live-alert-title">{liveAlert.title}</span>
            </div>
            <p className="tasks__live-alert-msg">{liveAlert.message}</p>
          </div>
          <button 
            type="button" 
            className="tasks__live-alert-close"
            onClick={() => setLiveAlert(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Toast Feedback */}
      {actionSuccess && (
        <div className="tasks__toast">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Compact Fleet Header */}
      <div className="tasks__header">
        <div>
          <div className="tasks__title-row">
            <Truck className="tasks__header-icon" size={20} />
            <h2 className="tasks__title">Regional Waste Logistics</h2>
          </div>
          <p className="tasks__subtitle">
            CBWTF Fleet Dispatch Matrix • Central Treatment Facility Unit #3
          </p>
        </div>
        <div className="tasks__live-badge">
          <span className="tasks__live-dot" />
          <span>ROUTE ACTIVE</span>
        </div>
      </div>

      {/* Modern, Compact KPI Strip */}
      <div className="tasks__kpi-grid">
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">Hospitals</span>
          <span className="tasks__kpi-val text-sky">{totalHospitalsCount} Monitored</span>
        </div>
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">Assigned Stops</span>
          <span className="tasks__kpi-val text-amber">{sortedRoute.length} Active</span>
        </div>
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">Current Payload</span>
          <span className="tasks__kpi-val">
            {totalWeightKg} kg ({totalBags} Bags)
          </span>
        </div>
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">SLA Health</span>
          <span className="tasks__kpi-val text-emerald">100% CPCB</span>
        </div>
      </div>

      {/* Sleek View Toggle */}
      <div className="tasks__view-toggle">
        <button
          type="button"
          className={`tasks__toggle-btn ${viewMode === 'routing' ? 'tasks__toggle-btn--active' : ''}`}
          onClick={() => setViewMode('routing')}
        >
          <Compass size={15} />
          <span>Smart Route &amp; All Hospitals ({totalHospitalsCount})</span>
        </button>

        <button
          type="button"
          className={`tasks__toggle-btn ${viewMode === 'incoming' ? 'tasks__toggle-btn--active' : ''}`}
          onClick={() => setViewMode('incoming')}
        >
          <Package size={15} />
          <span>Incoming Requests ({incomingRequests.length})</span>
        </button>
      </div>

      {/* VIEW 1: Smart Route & All Hospitals Transit Grid */}
      {viewMode === 'routing' && (
        <div className="routing-view">
          {/* Streamlined Transit Pipeline Bar */}
          <div className="route-pipeline-bar">
            <div className="route-pipeline-bar__left">
              <span className="route-pipeline-bar__title">Optimal Transit Corridor:</span>
              <div className="route-pipeline-bar__stops">
                {sortedRoute.length > 0 ? (
                  sortedRoute.map((stop, idx) => (
                    <span key={stop.id} className="route-pipeline-chip">
                      <strong>#{idx + 1}</strong> {HOSPITALS[stop.hospitalId]?.shortName || stop.hospitalName}
                    </span>
                  ))
                ) : (
                  <span className="route-pipeline-chip route-pipeline-chip--empty">No active stops assigned</span>
                )}
                <ArrowRight size={12} className="text-muted" />
                <span className="route-pipeline-chip route-pipeline-chip--hub">CBWTF Hub</span>
              </div>
            </div>

            <button
              type="button"
              className={`route-map-toggle-btn ${showMap ? 'route-map-toggle-btn--active' : ''}`}
              onClick={() => setShowMap(!showMap)}
            >
              {showMap ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{showMap ? 'Hide Map' : 'Show Map'}</span>
            </button>
          </div>

          {/* Collapsible Clean Regional Map */}
          {showMap && (
            <div className="route-map-container">
              <div className="route-map__legend">
                <span className="route-map__legend-item">
                  <span className="route-map__legend-dot route-map__legend-dot--hub" /> CBWTF Hub
                </span>
                <span className="route-map__legend-item">
                  <span className="route-map__legend-dot route-map__legend-dot--active" /> Active Stop
                </span>
                <span className="route-map__legend-item">
                  <span className="route-map__legend-dot route-map__legend-dot--pending" /> Pending
                </span>
                <span className="route-map__legend-item">
                  <span className="route-map__legend-dot route-map__legend-dot--standby" /> Standby
                </span>
              </div>

              <svg className="route-map" viewBox="0 0 400 240">
                <defs>
                  <linearGradient id="multiHospGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="50%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                  <filter id="hospGlow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <pattern id="cityGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  </pattern>
                </defs>

                <rect width="400" height="240" fill="url(#cityGrid)" />

                {/* Metro Corridor Boundary */}
                <rect x="10" y="10" width="380" height="220" rx="12" fill="rgba(15, 23, 42, 0.6)" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" />
                <text x="20" y="26" fill="#64748b" fontSize="7.5" fontWeight="700" letterSpacing="1" fontFamily="JetBrains Mono">
                  METROPOLITAN BIO-WASTE TRANSIT GRID
                </text>

                {/* Animated Optimal Transit Path connecting Hub -> Fortis -> Metro -> St Jude -> Hub */}
                <path
                  d="M 65 195 L 185 60 L 285 75 L 325 155 Z"
                  fill="rgba(56, 189, 248, 0.03)"
                  stroke="url(#multiHospGradient)"
                  strokeWidth="2"
                  strokeDasharray="5 3"
                  className="route-path-animated"
                />

                {/* Central CBWTF Hub Node */}
                <g transform="translate(65, 195)">
                  <circle r="14" fill="#070d1d" stroke="#10b981" strokeWidth="2.5" filter="url(#hospGlow)" />
                  <circle r="5" fill="#10b981" />
                  <text y="22" textAnchor="middle" fill="#34d399" fontSize="8" fontWeight="800" fontFamily="JetBrains Mono">
                    CBWTF Hub
                  </text>
                </g>

                {/* Hospital Nodes on City Map */}
                {allHospitalsList.map((h) => {
                  const coords = HOSP_MAP_COORDS[h.id] || { x: 200, y: 120 };
                  const x = coords.x;
                  const y = coords.y;
                  const isSelected = selectedMapPin === h.id;

                  return (
                    <g
                      key={h.id}
                      transform={`translate(${x}, ${y})`}
                      className={`hosp-map-pin ${h.isAccepted ? 'pin-pulse' : ''}`}
                      onClick={() => setSelectedMapPin(selectedMapPin === h.id ? null : h.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle
                        r={h.isAccepted ? 13 : h.isPending ? 11 : 9}
                        fill={h.isAccepted ? '#0284c7' : h.isPending ? '#b45309' : '#1e293b'}
                        stroke={h.isAccepted ? '#38bdf8' : h.isPending ? '#fbbf24' : '#475569'}
                        strokeWidth={h.isAccepted || isSelected ? 2.5 : 1.2}
                        filter={h.isAccepted || isSelected ? 'url(#hospGlow)' : undefined}
                      />
                      <text y="3" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="800" fontFamily="JetBrains Mono">
                        {h.shortName.slice(0, 3).toUpperCase()}
                      </text>
                      <text y="20" textAnchor="middle" fill={h.isAccepted ? '#38bdf8' : h.isPending ? '#fbbf24' : '#cbd5e1'} fontSize="7.5" fontWeight="700">
                        {h.shortName}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* Clean Quick Filter Pills */}
          <div className="hosp-filter-strip">
            <button
              type="button"
              className={`hosp-filter-pill ${filterMode === 'all' ? 'hosp-filter-pill--active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All Facilities ({allHospitalsList.length})
            </button>
            <button
              type="button"
              className={`hosp-filter-pill ${filterMode === 'active' ? 'hosp-filter-pill--active' : ''}`}
              onClick={() => setFilterMode('active')}
            >
              Active Stops ({allHospitalsList.filter(h => h.isAccepted).length})
            </button>
            <button
              type="button"
              className={`hosp-filter-pill ${filterMode === 'pending' ? 'hosp-filter-pill--active' : ''}`}
              onClick={() => setFilterMode('pending')}
            >
              Pending Pickups ({allHospitalsList.filter(h => h.isPending).length})
            </button>
            <button
              type="button"
              className={`hosp-filter-pill ${filterMode === 'critical' ? 'hosp-filter-pill--active' : ''}`}
              onClick={() => setFilterMode('critical')}
            >
              Critical &gt;80% ({allHospitalsList.filter(h => h.isCritical).length})
            </button>
          </div>

          {/* STREAMLINED ALL-HOSPITALS LIST */}
          <div className="route-stops-list">
            {filteredHospitals.map((hosp) => {
              const isFirst = hosp.isAccepted && hosp.stopIndex === 0;
              const isExpanded = expandedWardHosp === hosp.id;

              return (
                <div 
                  key={hosp.id} 
                  className={`hosp-clean-card ${hosp.isAccepted ? 'hosp-clean-card--active' : ''} ${isFirst ? 'hosp-clean-card--first' : ''} ${hosp.isPending ? 'hosp-clean-card--pending' : ''}`}
                >
                  {/* Header Row */}
                  <div className="hosp-clean-card__header">
                    <div className="hosp-clean-card__identity">
                      {hosp.isAccepted ? (
                        <span className={`hosp-clean-badge ${isFirst ? 'hosp-clean-badge--first' : ''}`}>
                          STOP #{hosp.stopIndex + 1} {isFirst ? '• NEXT' : ''}
                        </span>
                      ) : hosp.isPending ? (
                        <span className="hosp-clean-badge hosp-clean-badge--pending">
                          PENDING
                        </span>
                      ) : (
                        <span className="hosp-clean-badge hosp-clean-badge--standby">
                          STANDBY
                        </span>
                      )}
                      <div>
                        <h4 className="hosp-clean-card__name">{hosp.name}</h4>
                        <span className="hosp-clean-card__sub">
                          <MapPin size={10} /> {hosp.cityZone} • <strong>{hosp.distanceFromHubKm} km</strong> from Hub
                        </span>
                      </div>
                    </div>

                    <div className="hosp-clean-card__meta-right">
                      <span className={`hosp-urgency-pill hosp-urgency-pill--${hosp.urgency.toLowerCase()}`}>
                        {hosp.urgency}
                      </span>
                    </div>
                  </div>

                  {/* Compact Inline 4-Bin Telemetry Strip */}
                  <div className="hosp-clean-bins-bar">
                    <div className="hosp-clean-bin">
                      <span className="hosp-clean-bin__dot bg-yellow" />
                      <span className="hosp-clean-bin__name">Yellow</span>
                      <span className="hosp-clean-bin__pct">{hosp.binStats.yellow}%</span>
                      <div className="hosp-clean-bin__track">
                        <div className="hosp-clean-bin__fill bg-yellow" style={{ width: `${hosp.binStats.yellow}%` }} />
                      </div>
                    </div>

                    <div className="hosp-clean-bin">
                      <span className="hosp-clean-bin__dot bg-red" />
                      <span className="hosp-clean-bin__name">Red</span>
                      <span className="hosp-clean-bin__pct">{hosp.binStats.red}%</span>
                      <div className="hosp-clean-bin__track">
                        <div className="hosp-clean-bin__fill bg-red" style={{ width: `${hosp.binStats.red}%` }} />
                      </div>
                    </div>

                    <div className="hosp-clean-bin">
                      <span className="hosp-clean-bin__dot bg-blue" />
                      <span className="hosp-clean-bin__name">Blue</span>
                      <span className="hosp-clean-bin__pct">{hosp.binStats.blue}%</span>
                      <div className="hosp-clean-bin__track">
                        <div className="hosp-clean-bin__fill bg-blue" style={{ width: `${hosp.binStats.blue}%` }} />
                      </div>
                    </div>

                    <div className="hosp-clean-bin">
                      <span className="hosp-clean-bin__dot bg-white" />
                      <span className="hosp-clean-bin__name">White</span>
                      <span className="hosp-clean-bin__pct">{hosp.binStats.white}%</span>
                      <div className="hosp-clean-bin__track">
                        <div className="hosp-clean-bin__fill bg-white" style={{ width: `${hosp.binStats.white}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Expandable Ward Details (If Open) */}
                  {isExpanded && (
                    <div className="hosp-clean-drawer">
                      <span className="hosp-clean-drawer__title">Internal Clinical Wards:</span>
                      <div className="hosp-clean-drawer__grid">
                        {Object.entries(hosp.wards).map(([wId, ward]) => (
                          <div key={wId} className="hosp-clean-ward-item">
                            <strong>{ward.name}</strong>
                            <span>{ward.floor} • {ward.rooms ? ward.rooms.join(', ') : `${ward.bedCount} beds`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clean Bottom Action Row */}
                  <div className="hosp-clean-card__footer">
                    <div className="hosp-clean-card__footer-left">
                      <span className="hosp-clean-cargo">
                        <Package size={12} /> ~{hosp.estimatedWeightKg} kg ({hosp.estimatedBags} Bags)
                      </span>
                      <button
                        type="button"
                        className="hosp-clean-inspect-toggle"
                        onClick={() => setExpandedWardHosp(isExpanded ? null : hosp.id)}
                      >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        <span>{isExpanded ? 'Hide' : 'Wards'}</span>
                      </button>
                    </div>

                    <div className="hosp-clean-card__footer-right">
                      {hosp.isAccepted ? (
                        <button
                          type="button"
                          className="hosp-clean-btn hosp-clean-btn--collect"
                          onClick={() => handleComplete(hosp.activeReq.id, hosp.name)}
                        >
                          <CheckCircle2 size={14} />
                          <span>Confirm Pickup</span>
                        </button>
                      ) : hosp.isPending ? (
                        <button
                          type="button"
                          className="hosp-clean-btn hosp-clean-btn--accept"
                          onClick={() => handleAccept(hosp.activeReq.id, hosp.name)}
                        >
                          <Plus size={14} />
                          <span>Accept Request</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="hosp-clean-btn hosp-clean-btn--add"
                          onClick={() => handleScheduleDirect(hosp.id, hosp.name)}
                        >
                          <Zap size={13} />
                          <span>Add to Route</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Clean Final Destination Banner */}
            <div className="hosp-clean-card hosp-clean-card--final">
              <div className="hosp-clean-card__header">
                <div className="hosp-clean-card__identity">
                  <span className="hosp-clean-badge hosp-clean-badge--hub">
                    FINAL DESTINATION
                  </span>
                  <div>
                    <h4 className="hosp-clean-card__name">{CBWTF_FACILITY.name}</h4>
                    <span className="hosp-clean-card__sub">
                      <MapPin size={10} /> {CBWTF_FACILITY.address} • Central Unloading Bay
                    </span>
                  </div>
                </div>
                <span className="hosp-clean-cert">
                  <ShieldCheck size={14} className="text-emerald" /> CPCB Validated
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Incoming Hospital Requests Queue */}
      {viewMode === 'incoming' && (
        <div className="incoming-view">
          {incomingRequests.length === 0 ? (
            <div className="tasks__empty-card">
              <div className="tasks__empty-icon-wrap">
                <CheckCircle2 size={32} className="text-emerald" />
              </div>
              <h3 className="tasks__empty-title">All Hospital Requests Handled</h3>
              <p className="tasks__empty-desc">
                There are no pending hospital requests in the regional queue. All hospitals are monitored in the Smart Route.
              </p>
              <button 
                type="button" 
                className="tasks__mock-btn"
                onClick={() => setViewMode('routing')}
              >
                <Navigation size={14} />
                <span>View Smart Route ({totalHospitalsCount} Facilities)</span>
              </button>
            </div>
          ) : (
            <div className="incoming-requests-list">
              {incomingRequests.map((req) => (
                <div key={req.id} className="hosp-clean-card hosp-clean-card--pending">
                  <div className="hosp-clean-card__header">
                    <div className="hosp-clean-card__identity">
                      <span className="hosp-clean-badge hosp-clean-badge--pending">REQUEST</span>
                      <div>
                        <h4 className="hosp-clean-card__name">{req.hospitalName}</h4>
                        <span className="hosp-clean-card__sub">{req.hospitalAddress}</span>
                      </div>
                    </div>
                    <span className={`hosp-urgency-pill hosp-urgency-pill--${req.urgency.toLowerCase()}`}>
                      {req.urgency}
                    </span>
                  </div>

                  <p className="incoming-card-reason">{req.reason}</p>

                  <div className="hosp-clean-card__footer">
                    <span className="hosp-clean-cargo">
                      <Package size={12} /> {req.estimatedWeightKg} kg ({req.estimatedBags} bags) • {req.wardName}
                    </span>
                    <button
                      type="button"
                      className="hosp-clean-btn hosp-clean-btn--accept"
                      onClick={() => handleAccept(req.id, req.hospitalName)}
                    >
                      <Check size={14} />
                      <span>Accept for Route</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
