import React, { useState, useEffect, useMemo } from 'react';
import {
  subscribeToPickupRequests,
  subscribeToBins,
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
  Gauge
} from 'lucide-react';
import './Tasks.css';

// High-precision coordinates for the Regional City Map SVG (400x280)
const HOSP_MAP_COORDS = {
  'hosp-apex': { x: 125, y: 140 },
  'hosp-fortis': { x: 185, y: 70 },
  'hosp-metro': { x: 285, y: 85 },
  'hosp-city': { x: 325, y: 175 },
  'hosp-apollo': { x: 220, y: 225 }
};

export default function TaskList() {
  const [requests, setRequests] = useState([]);
  const [bins, setBins] = useState([]);
  const [viewMode, setViewMode] = useState('routing'); // 'routing' | 'incoming'
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'active' | 'pending' | 'critical'
  const [actionSuccess, setActionSuccess] = useState(null);
  const [selectedMapPin, setSelectedMapPin] = useState(null);
  const [expandedWardHosp, setExpandedWardHosp] = useState(null);

  useEffect(() => {
    const unsubReqs = subscribeToPickupRequests((data) => setRequests(data || []));
    const unsubBins = subscribeToBins((data) => setBins(data || []));

    return () => {
      unsubReqs();
      unsubBins();
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
      // Secondary: shorter distance first
      const distA = HOSPITALS[a.hospitalId]?.distanceFromHubKm || 10;
      const distB = HOSPITALS[b.hospitalId]?.distanceFromHubKm || 10;
      return distA - distB;
    });
  }, [acceptedRequests]);

  // Comprehensive Hospital List for Smart Routing
  // Combines all 5 hospitals with their real-time telemetry, routing status, and priority
  const allHospitalsList = useMemo(() => {
    const all = Object.values(HOSPITALS).map((hosp) => {
      const activeReq = requests.find(r => r.hospitalId === hosp.id && (r.status === 'accepted' || r.status === 'logistics_pending'));
      const isAccepted = activeReq && activeReq.status === 'accepted';
      const isPending = activeReq && activeReq.status === 'logistics_pending';

      // Find stop index if accepted
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

    // Sort order:
    // 1. Active Route stops first (Stop #1, Stop #2, ...)
    // 2. Pending requests needing acceptance
    // 3. Standby hospitals sorted by fill level descending
    return all.sort((a, b) => {
      if (a.isAccepted && b.isAccepted) return a.stopIndex - b.stopIndex;
      if (a.isAccepted) return -1;
      if (b.isAccepted) return 1;
      if (a.isPending && !b.isPending) return -1;
      if (!a.isPending && b.isPending) return 1;
      return b.maxFill - a.maxFill;
    });
  }, [requests, bins, sortedRoute]);

  // Apply quick filter on all hospitals list
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
      {/* Toast Feedback */}
      {actionSuccess && (
        <div className="tasks__toast">
          <CheckCircle2 size={16} className="text-emerald" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Logistics Header */}
      <div className="tasks__header">
        <div>
          <div className="tasks__title-row">
            <Truck className="tasks__header-icon" size={22} />
            <h2 className="tasks__title">Regional Bio-Waste Transporter</h2>
          </div>
          <p className="tasks__subtitle">
            Central Bio-Medical Waste Treatment Facility (CBWTF Hub) • Fleet Dispatch Matrix
          </p>
        </div>
        <div className="tasks__live-badge">
          <span className="tasks__live-dot" />
          <span>FLEET UNIT #3 • ACTIVE ROUTE</span>
        </div>
      </div>

      {/* Fleet KPI Bar */}
      <div className="tasks__kpi-grid">
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">Network Hospitals</span>
          <span className="tasks__kpi-val text-sky">{totalHospitalsCount} Monitored</span>
        </div>
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">Active Route Stops</span>
          <span className="tasks__kpi-val text-amber">{sortedRoute.length} Assigned</span>
        </div>
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">Active Route Cargo</span>
          <span className="tasks__kpi-val">
            {totalWeightKg} kg ({totalBags} Bags)
          </span>
        </div>
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">Statutory Compliance</span>
          <span className="tasks__kpi-val text-emerald">100% (CPCB 48h)</span>
        </div>
      </div>

      {/* View Toggle Tabs */}
      <div className="tasks__view-toggle">
        <button
          type="button"
          className={`tasks__toggle-btn ${viewMode === 'routing' ? 'tasks__toggle-btn--active' : ''}`}
          onClick={() => setViewMode('routing')}
        >
          <Compass size={16} />
          <span>Smart Route & All Hospitals ({totalHospitalsCount})</span>
        </button>

        <button
          type="button"
          className={`tasks__toggle-btn ${viewMode === 'incoming' ? 'tasks__toggle-btn--active' : ''}`}
          onClick={() => setViewMode('incoming')}
        >
          <Package size={16} />
          <span>Incoming Requests ({incomingRequests.length})</span>
        </button>
      </div>

      {/* VIEW 1: Smart Route & All Hospitals Transit Grid */}
      {viewMode === 'routing' && (
        <div className="routing-view">
          {/* Smart Route Narrative Banner */}
          <div className="route-banner">
            <div className="route-banner__content">
              <div className="route-banner__title-row">
                <Sparkles size={16} className="text-amber" />
                <h3 className="route-banner__title">AI Regional Transit Corridor</h3>
              </div>
              <p className="route-banner__desc">
                Multi-stop optimization prioritizing statutory emergency pickups (CPCB 48h threshold) across all regional healthcare institutions.
              </p>
            </div>
            <div className="route-banner__eta-badge">
              <span className="route-banner__eta-label">ESTIMATED CYCLE</span>
              <span className="route-banner__eta-val">{Math.max(25, sortedRoute.length * 15 + 10)} mins</span>
            </div>
          </div>

          {/* Regional City Transit Map (SVG Blueprint) */}
          <div className="route-map-container">
            <div className="route-map__legend">
              <span className="route-map__legend-item">
                <span className="route-map__legend-dot route-map__legend-dot--hub" /> CBWTF Hub
              </span>
              <span className="route-map__legend-item">
                <span className="route-map__legend-dot route-map__legend-dot--active" /> Active Stop
              </span>
              <span className="route-map__legend-item">
                <span className="route-map__legend-dot route-map__legend-dot--pending" /> Pending Dispatch
              </span>
              <span className="route-map__legend-item">
                <span className="route-map__legend-dot route-map__legend-dot--standby" /> Standby
              </span>
            </div>

            <svg className="route-map" viewBox="0 0 400 280">
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
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                </pattern>
              </defs>

              <rect width="400" height="280" fill="url(#cityGrid)" />

              {/* Metro Corridor Boundary */}
              <rect x="12" y="12" width="376" height="256" rx="14" fill="rgba(15, 23, 42, 0.7)" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1.2" />
              <text x="24" y="32" fill="#64748b" fontSize="8" fontWeight="700" letterSpacing="1" fontFamily="JetBrains Mono">
                REGIONAL METROPOLITAN BIO-WASTE TRANSIT GRID
              </text>

              {/* Animated Optimal Transit Path connecting Hub -> Fortis -> Metro -> St Jude -> Hub */}
              <path
                d="M 68 225 L 185 70 L 285 85 L 325 175 Z"
                fill="rgba(56, 189, 248, 0.04)"
                stroke="url(#multiHospGradient)"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                className="route-path-animated"
              />

              {/* Central CBWTF Hub Node */}
              <g transform="translate(68, 225)">
                <circle r="16" fill="#070d1d" stroke="#10b981" strokeWidth="2.5" filter="url(#hospGlow)" />
                <circle r="6" fill="#10b981" />
                <text y="24" textAnchor="middle" fill="#34d399" fontSize="8.5" fontWeight="800" fontFamily="JetBrains Mono">
                  CBWTF Hub
                </text>
              </g>

              {/* Hospital Nodes on City Map */}
              {allHospitalsList.map((h) => {
                const coords = HOSP_MAP_COORDS[h.id] || { x: 200, y: 140 };
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
                      r={h.isAccepted ? 15 : h.isPending ? 13 : 10}
                      fill={h.isAccepted ? '#0284c7' : h.isPending ? '#b45309' : '#1e293b'}
                      stroke={h.isAccepted ? '#38bdf8' : h.isPending ? '#fbbf24' : '#475569'}
                      strokeWidth={h.isAccepted || isSelected ? 3 : 1.5}
                      filter={h.isAccepted || isSelected ? 'url(#hospGlow)' : undefined}
                    />
                    <text y="3.5" textAnchor="middle" fill="#ffffff" fontSize="8" fontWeight="800" fontFamily="JetBrains Mono">
                      {h.shortName.slice(0, 3).toUpperCase()}
                    </text>
                    <text y="24" textAnchor="middle" fill={h.isAccepted ? '#38bdf8' : h.isPending ? '#fbbf24' : '#cbd5e1'} fontSize="8" fontWeight="700">
                      {h.shortName}
                    </text>

                    {/* Popover on map pin click */}
                    {isSelected && (
                      <g transform="translate(0, -32)">
                        <rect x="-60" y="-18" width="120" height="26" rx="6" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                        <text y="-4" textAnchor="middle" fill="#f8fafc" fontSize="7.5" fontWeight="700">
                          {h.shortName} • {h.distanceFromHubKm}km
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Filter Pills Bar */}
          <div className="hosp-filter-strip">
            <div className="hosp-filter-strip__label">
              <span>Filter Regional Facilities:</span>
            </div>
            <div className="hosp-filter-strip__pills">
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
                Critical Waste &gt;80% ({allHospitalsList.filter(h => h.isCritical).length})
              </button>
            </div>
          </div>

          {/* ALL HOSPITALS ROUTE LIST */}
          <div className="all-hospitals-route-list">
            <div className="route-itinerary__header">
              <div>
                <h4 className="route-itinerary__title">Regional Healthcare Network Itinerary</h4>
                <span className="route-itinerary__sub">
                  Showing all {filteredHospitals.length} hospitals with real-time 4-bin fill telemetry &amp; collection status
                </span>
              </div>
            </div>

            <div className="route-stops-list">
              {filteredHospitals.map((hosp) => {
                const isFirst = hosp.isAccepted && hosp.stopIndex === 0;
                const isExpanded = expandedWardHosp === hosp.id;

                return (
                  <div 
                    key={hosp.id} 
                    className={`hosp-transit-card ${hosp.isAccepted ? 'hosp-transit-card--active' : ''} ${isFirst ? 'hosp-transit-card--first' : ''} ${hosp.isPending ? 'hosp-transit-card--pending' : ''} ${hosp.isCritical ? 'hosp-transit-card--critical' : ''}`}
                    onClick={() => setSelectedMapPin(hosp.id)}
                  >
                    {/* Top Identity Row */}
                    <div className="hosp-transit-card__top">
                      <div className="hosp-transit-card__badge-col">
                        {hosp.isAccepted ? (
                          <span className={`hosp-transit-card__stop-pill ${isFirst ? 'hosp-transit-card__stop-pill--next' : ''}`}>
                            STOP #{hosp.stopIndex + 1} {isFirst ? '• NEXT WAYPOINT' : '• EN ROUTE'}
                          </span>
                        ) : hosp.isPending ? (
                          <span className="hosp-transit-card__stop-pill hosp-transit-card__stop-pill--pending">
                            DISPATCH PENDING
                          </span>
                        ) : (
                          <span className="hosp-transit-card__stop-pill hosp-transit-card__stop-pill--standby">
                            ROUTINE STANDBY
                          </span>
                        )}
                      </div>

                      <div className="hosp-transit-card__urgency-col">
                        <span className={`hosp-urgency-badge hosp-urgency-badge--${hosp.urgency.toLowerCase()}`}>
                          {hosp.urgency}
                        </span>
                      </div>
                    </div>

                    {/* Hospital Name & Zone */}
                    <div className="hosp-transit-card__title-row">
                      <div>
                        <h4 className="hosp-transit-card__name">{hosp.name}</h4>
                        <p className="hosp-transit-card__address">
                          <MapPin size={11} /> {hosp.cityZone} • <strong>{hosp.distanceFromHubKm} km</strong> from CBWTF Hub
                        </p>
                      </div>
                      <div className="hosp-transit-card__cargo-badge">
                        <Package size={13} />
                        <span>~{hosp.estimatedWeightKg} kg ({hosp.estimatedBags} Bags)</span>
                      </div>
                    </div>

                    {/* 4-BIN STATUTORY TELEMETRY STRIP */}
                    <div className="hosp-transit-card__bins-section">
                      <div className="hosp-bins-header">
                        <span className="hosp-bins-title">
                          <Gauge size={12} /> Statutory 4-Color Bin Levels
                        </span>
                        <span className="hosp-bins-bedcount">
                          {hosp.bedCount} Beds • {Object.keys(hosp.wards).length} Clinical Wards
                        </span>
                      </div>

                      <div className="hosp-bins-meter-grid">
                        {/* Yellow: Anatomical */}
                        <div className={`hosp-bin-bar-item ${hosp.binStats.yellow >= 80 ? 'hosp-bin-bar-item--danger' : ''}`}>
                          <div className="hosp-bin-bar-label">
                            <span className="hosp-bin-color-tag hosp-bin-color-tag--yellow" />
                            <span>Yellow (Anatomy)</span>
                            <span className="hosp-bin-bar-pct">{hosp.binStats.yellow}%</span>
                          </div>
                          <div className="hosp-bin-track">
                            <div 
                              className="hosp-bin-fill hosp-bin-fill--yellow" 
                              style={{ width: `${Math.min(100, hosp.binStats.yellow)}%` }} 
                            />
                          </div>
                        </div>

                        {/* Red: Contaminated Plastic */}
                        <div className={`hosp-bin-bar-item ${hosp.binStats.red >= 80 ? 'hosp-bin-bar-item--danger' : ''}`}>
                          <div className="hosp-bin-bar-label">
                            <span className="hosp-bin-color-tag hosp-bin-color-tag--red" />
                            <span>Red (Plastics)</span>
                            <span className="hosp-bin-bar-pct">{hosp.binStats.red}%</span>
                          </div>
                          <div className="hosp-bin-track">
                            <div 
                              className="hosp-bin-fill hosp-bin-fill--red" 
                              style={{ width: `${Math.min(100, hosp.binStats.red)}%` }} 
                            />
                          </div>
                        </div>

                        {/* Blue: Glassware */}
                        <div className={`hosp-bin-bar-item ${hosp.binStats.blue >= 80 ? 'hosp-bin-bar-item--danger' : ''}`}>
                          <div className="hosp-bin-bar-label">
                            <span className="hosp-bin-color-tag hosp-bin-color-tag--blue" />
                            <span>Blue (Glass/Vials)</span>
                            <span className="hosp-bin-bar-pct">{hosp.binStats.blue}%</span>
                          </div>
                          <div className="hosp-bin-track">
                            <div 
                              className="hosp-bin-fill hosp-bin-fill--blue" 
                              style={{ width: `${Math.min(100, hosp.binStats.blue)}%` }} 
                            />
                          </div>
                        </div>

                        {/* White / Sharps */}
                        <div className={`hosp-bin-bar-item ${hosp.binStats.white >= 80 ? 'hosp-bin-bar-item--danger' : ''}`}>
                          <div className="hosp-bin-bar-label">
                            <span className="hosp-bin-color-tag hosp-bin-color-tag--white" />
                            <span>White (Sharps)</span>
                            <span className="hosp-bin-bar-pct">{hosp.binStats.white}%</span>
                          </div>
                          <div className="hosp-bin-track">
                            <div 
                              className="hosp-bin-fill hosp-bin-fill--white" 
                              style={{ width: `${Math.min(100, hosp.binStats.white)}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Ward Telemetry Breakdown */}
                    {isExpanded && (
                      <div className="hosp-ward-breakdown-drawer">
                        <div className="hosp-ward-breakdown-drawer__header">
                          <Layers size={13} />
                          <span>Internal Clinical Ward Breakdown:</span>
                        </div>
                        <div className="hosp-ward-chips">
                          {Object.entries(hosp.wards).map(([wId, ward]) => (
                            <div key={wId} className="hosp-ward-chip">
                              <span className="hosp-ward-chip__name">{ward.name}</span>
                              <span className="hosp-ward-chip__meta">
                                {ward.floor} • {ward.rooms ? ward.rooms.join(', ') : `${ward.bedCount} beds`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="hosp-transit-card__action-bar">
                      <div className="hosp-transit-card__action-left">
                        <button
                          type="button"
                          className="hosp-transit-card__expand-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedWardHosp(isExpanded ? null : hosp.id);
                          }}
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          <span>{isExpanded ? 'Hide Wards' : 'Inspect Wards & Rooms'}</span>
                        </button>
                        <span className="hosp-transit-card__phone">
                          <Phone size={11} /> {hosp.phone}
                        </span>
                      </div>

                      <div className="hosp-transit-card__action-right">
                        {hosp.isAccepted ? (
                          <button
                            type="button"
                            className="hosp-transit-card__confirm-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleComplete(hosp.activeReq.id, hosp.name);
                            }}
                          >
                            <CheckCircle2 size={15} />
                            <span>Confirm Waste Pickup &amp; Manifest</span>
                          </button>
                        ) : hosp.isPending ? (
                          <button
                            type="button"
                            className="hosp-transit-card__accept-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAccept(hosp.activeReq.id, hosp.name);
                            }}
                          >
                            <Plus size={15} />
                            <span>Accept for Route Stop</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="hosp-transit-card__schedule-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleScheduleDirect(hosp.id, hosp.name);
                            }}
                          >
                            <Zap size={14} />
                            <span>Add to Route Sequence</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* FINAL HUB DESTINATION CARD */}
              <div className="hosp-transit-card hosp-transit-card--final">
                <div className="hosp-transit-card__top">
                  <span className="hosp-transit-card__stop-pill hosp-transit-card__stop-pill--hub">
                    FINAL TERMINAL DESTINATION
                  </span>
                  <span className="hosp-urgency-badge hosp-urgency-badge--normal">
                    TREATMENT FACILITY
                  </span>
                </div>

                <div className="hosp-transit-card__title-row">
                  <div>
                    <h4 className="hosp-transit-card__name">{CBWTF_FACILITY.name}</h4>
                    <p className="hosp-transit-card__address">
                      <MapPin size={11} /> {CBWTF_FACILITY.address} • Central Unloading Bay
                    </p>
                  </div>
                  <div className="hosp-transit-card__cargo-badge text-emerald">
                    <ShieldCheck size={14} />
                    <span>CPCB Certified Disposal</span>
                  </div>
                </div>

                <div className="hosp-hub-specs">
                  <div className="hosp-hub-spec-item">
                    <Flame size={13} className="text-amber" />
                    <span>Primary Chamber Incineration: <strong>1100°C</strong></span>
                  </div>
                  <div className="hosp-hub-spec-item">
                    <Activity size={13} className="text-sky" />
                    <span>Autoclave Sterilization: <strong>121°C @ 15 psi</strong></span>
                  </div>
                  <div className="hosp-hub-spec-item">
                    <CheckCircle2 size={13} className="text-emerald" />
                    <span>Bio-Hazard Shredding: <strong>CPCB Schedule II Validated</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Incoming Hospital Requests Queue */}
      {viewMode === 'incoming' && (
        <div className="incoming-view">
          <div className="incoming-toolbar">
            <span className="incoming-toolbar__info">
              Showing verified disposal requests dispatched by Infection Control Admins across the regional municipal grid.
            </span>
          </div>

          {incomingRequests.length === 0 ? (
            <div className="tasks__empty-card">
              <div className="tasks__empty-icon-wrap">
                <CheckCircle2 size={36} className="text-emerald" />
              </div>
              <h3 className="tasks__empty-title">All Hospital Requests Handled</h3>
              <p className="tasks__empty-desc">
                There are no unassigned hospital requests waiting in the regional CBWTF queue. All regional facilities are active in the Smart Route.
              </p>
              <button 
                type="button" 
                className="tasks__mock-btn"
                onClick={() => setViewMode('routing')}
              >
                <Navigation size={14} />
                <span>View Regional Transit Grid ({totalHospitalsCount} Hospitals)</span>
              </button>
            </div>
          ) : (
            <div className="incoming-requests-list">
              {incomingRequests.map((req) => {
                const isCrit = req.urgency === 'CRITICAL';

                return (
                  <div 
                    key={req.id} 
                    className={`hosp-request-card ${isCrit ? 'hosp-request-card--critical' : ''}`}
                  >
                    <div className="hosp-request-card__header">
                      <div className="hosp-request-card__identity">
                        <div className="hosp-request-card__icon">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <div className="hosp-request-card__title-row">
                            <h3 className="hosp-request-card__hospital-name">{req.hospitalName}</h3>
                            <span className={`hosp-urgency-badge hosp-urgency-badge--${req.urgency.toLowerCase()}`}>
                              {req.urgency}
                            </span>
                          </div>
                          <p className="hosp-request-card__address">
                            <MapPin size={11} />
                            {req.hospitalAddress}
                          </p>
                        </div>
                      </div>

                      <div className="hosp-request-card__cargo-preview">
                        <span className="hosp-request-card__cargo-val">{req.estimatedWeightKg} kg</span>
                        <span className="hosp-request-card__cargo-bags">{req.estimatedBags} bags</span>
                      </div>
                    </div>

                    <div className="hosp-request-card__body">
                      <div className="hosp-request-card__location-chip">
                        <strong>Target Ward / Origin:</strong> {req.wardName} {req.room ? `• ${req.room}` : ''}
                      </div>

                      <p className="hosp-request-card__reason">{req.reason}</p>

                      {req.criticalBins && req.criticalBins.length > 0 && (
                        <div className="hosp-request-card__bins-strip">
                          <span className="hosp-request-card__bins-label">High-Fill Bins:</span>
                          <div className="hosp-request-card__bins-pills">
                            {req.criticalBins.map((bin, bIdx) => {
                              const cInfo = CATEGORY_INFO[bin.category] || CATEGORY_INFO.unknown;
                              return (
                                <div 
                                  key={bIdx} 
                                  className="hosp-bin-pill"
                                  style={{ borderColor: `${cInfo.color}50`, background: `${cInfo.color}15` }}
                                >
                                  <span className="hosp-bin-dot" style={{ background: cInfo.color }} />
                                  <span className="hosp-bin-label" style={{ color: cInfo.color }}>
                                    {bin.label || cInfo.label.split(' ')[0]}
                                  </span>
                                  <span className="hosp-bin-pct">{bin.fillPercent}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="hosp-request-card__footer">
                      <span className="hosp-request-card__requested-by">
                        Requested by: {req.requestedBy}
                      </span>
                      <button
                        type="button"
                        className="hosp-accept-btn"
                        onClick={() => handleAccept(req.id, req.hospitalName)}
                      >
                        <Check size={15} strokeWidth={2.5} />
                        <span>Accept for Delivery Route</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
