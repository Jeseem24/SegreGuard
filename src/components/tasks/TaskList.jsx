import React, { useState, useEffect, useMemo } from 'react';
import {
  subscribeToPickupRequests,
  acceptLogisticsRequest,
  completeLogisticsRequest,
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
  Boxes, 
  Building2, 
  ArrowRight, 
  Check, 
  ShieldCheck, 
  Sparkles,
  QrCode,
  Package,
  Layers,
  ChevronRight,
  Compass
} from 'lucide-react';
import './Tasks.css';

export default function TaskList() {
  const [requests, setRequests] = useState([]);
  const [viewMode, setViewMode] = useState('incoming'); // 'incoming' | 'routing'
  const [actionSuccess, setActionSuccess] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);

  useEffect(() => {
    const unsub = subscribeToPickupRequests((data) => {
      setRequests(data || []);
    });
    return unsub;
  }, []);

  const showFeedback = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const handleAccept = async (requestId, hospitalName) => {
    try {
      await acceptLogisticsRequest(requestId, 'CBWTF Fleet Unit #3');
      showFeedback(`Accepted delivery request for ${hospitalName}! Added to Smart Route.`);
      setViewMode('routing'); // Automatically take the logistics worker to their smart route
    } catch (err) {
      console.error('Failed to accept request:', err);
    }
  };

  const handleComplete = async (requestId, hospitalName) => {
    try {
      await completeLogisticsRequest(requestId);
      showFeedback(`Waste collected from ${hospitalName}. Bins reset & digital custody signed ✓`);
    } catch (err) {
      console.error('Failed to complete pickup:', err);
    }
  };

  // Filter requests
  const incomingRequests = requests.filter(r => r.status === 'logistics_pending');
  const acceptedRequests = requests.filter(r => r.status === 'accepted');
  const completedRequests = requests.filter(r => r.status === 'completed');

  // Smart Routing Priority Sequence:
  // Sort accepted requests by Urgency (CRITICAL > HIGH > NORMAL) then estimated load
  const sortedRoute = useMemo(() => {
    const urgencyWeight = { 'CRITICAL': 3, 'HIGH': 2, 'NORMAL': 1 };
    return [...acceptedRequests].sort((a, b) => {
      const weightA = urgencyWeight[a.urgency] || 1;
      const weightB = urgencyWeight[b.urgency] || 1;
      return weightB - weightA;
    });
  }, [acceptedRequests]);

  // Aggregate metrics
  const totalBags = sortedRoute.reduce((sum, r) => sum + (r.estimatedBags || 0), 0);
  const totalWeightKg = sortedRoute.reduce((sum, r) => sum + (r.estimatedWeightKg || 0), 0).toFixed(1);

  return (
    <div className="tasks">
      {/* Action Toast Feedback */}
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
            Central Bio-Medical Waste Treatment Facility (CBWTF) Fleet Logistics
          </p>
        </div>
        <div className="tasks__live-badge">
          <span className="tasks__live-dot" />
          <span>FLEET ACTIVE</span>
        </div>
      </div>

      {/* Fleet KPI Bar */}
      <div className="tasks__kpi-grid">
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">Incoming Requests</span>
          <span className={`tasks__kpi-val ${incomingRequests.length > 0 ? 'text-amber' : 'text-emerald'}`}>
            {incomingRequests.length} Hospitals
          </span>
        </div>
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">Active Route Stops</span>
          <span className="tasks__kpi-val text-sky">
            {sortedRoute.length} Assigned
          </span>
        </div>
        <div className="tasks__kpi-card">
          <span className="tasks__kpi-label">Total Assigned Cargo</span>
          <span className="tasks__kpi-val">
            {totalWeightKg} kg ({totalBags} Bags)
          </span>
        </div>
      </div>

      {/* View Toggle */}
      <div className="tasks__view-toggle">
        <button
          type="button"
          className={`tasks__toggle-btn ${viewMode === 'incoming' ? 'tasks__toggle-btn--active' : ''}`}
          onClick={() => setViewMode('incoming')}
        >
          <Building2 size={15} />
          <span>Incoming Hospital Requests ({incomingRequests.length})</span>
        </button>
        <button
          type="button"
          className={`tasks__toggle-btn ${viewMode === 'routing' ? 'tasks__toggle-btn--active' : ''}`}
          onClick={() => setViewMode('routing')}
        >
          <Compass size={15} />
          <span>Smart Routing ({sortedRoute.length})</span>
        </button>
      </div>

      {/* VIEW 1: Incoming Hospital Requests */}
      {viewMode === 'incoming' && (
        <div className="incoming-view">
          <div className="incoming-toolbar">
            <span className="incoming-toolbar__info">
              Showing verified disposal requests sent by Hospital Infection Control Admins across the regional health network.
            </span>
          </div>

          {incomingRequests.length === 0 ? (
            <div className="tasks__empty-card">
              <div className="tasks__empty-icon-wrap">
                <CheckCircle2 size={36} className="text-emerald" />
              </div>
              <h3 className="tasks__empty-title">All Hospital Requests Accepted</h3>
              <p className="tasks__empty-desc">
                There are no unassigned hospital requests waiting in the regional CBWTF queue. Switch to the Smart Routing tab to execute current stops.
              </p>
              <button 
                type="button" 
                className="tasks__mock-btn"
                onClick={() => setViewMode('routing')}
              >
                <Navigation size={14} />
                <span>View Active Smart Route ({sortedRoute.length} Stops)</span>
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
                    {/* Header Row */}
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

                    {/* Ward & Reason Details */}
                    <div className="hosp-request-card__body">
                      <div className="hosp-request-card__location-chip">
                        <strong>Target Ward / Origin:</strong> {req.wardName} {req.room ? `• ${req.room}` : ''}
                      </div>

                      <p className="hosp-request-card__reason">
                        {req.reason}
                      </p>

                      {/* Critical Bins Pill Breakdown */}
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

                    {/* Action Bar */}
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
                        <span>Accept Delivery Request</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Smart Routing & Transit Map */}
      {viewMode === 'routing' && (
        <div className="routing-view">
          {/* Smart Route Narrative Banner */}
          <div className="route-banner">
            <div className="route-banner__content">
              <div className="route-banner__title-row">
                <Sparkles size={16} className="text-amber" />
                <h3 className="route-banner__title">AI Smart Routing Optimization</h3>
              </div>
              <p className="route-banner__desc">
                Transporter itinerary prioritized by clinical urgency (CPCB 48h deadline compliance) and optimal metropolitan road corridors.
              </p>
            </div>
            <div className="route-banner__eta-badge">
              <span className="route-banner__eta-label">ESTIMATED CYCLE</span>
              <span className="route-banner__eta-val">{Math.max(15, sortedRoute.length * 18)} mins</span>
            </div>
          </div>

          {/* Regional City Transit Map (SVG Blueprint) */}
          <div className="route-map-container">
            <svg className="route-map" viewBox="0 0 400 300">
              <defs>
                <linearGradient id="multiHospGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="50%" stopColor="#A855F7" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
                <filter id="hospGlow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* City Blueprint Grid */}
              <pattern id="cityGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              </pattern>
              <rect width="400" height="300" fill="url(#cityGrid)" />

              {/* Metro Corridor Boundary */}
              <rect x="15" y="15" width="370" height="270" rx="16" fill="rgba(15, 23, 42, 0.7)" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1.5" />
              <text x="30" y="38" fill="#64748b" fontSize="8.5" fontWeight="700" letterSpacing="1" fontFamily="JetBrains Mono">
                METROPOLITAN REGIONAL HEALTHCARE GRID • CBWTF DISPATCH
              </text>

              {/* Animated Optimal Transit Path */}
              <path
                d="M 60 240 L 120 115 L 285 75 L 325 200 Z"
                fill="rgba(56, 189, 248, 0.03)"
                stroke="url(#multiHospGradient)"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                className="route-path-animated"
              />

              {/* Central CBWTF Disposal Facility Hub */}
              <g transform="translate(60, 240)">
                <circle r="16" fill="#070d1d" stroke="#10b981" strokeWidth="2.5" filter="url(#hospGlow)" />
                <circle r="6" fill="#10b981" />
                <text y="26" textAnchor="middle" fill="#34d399" fontSize="8.5" fontWeight="800" fontFamily="JetBrains Mono">
                  CBWTF Hub
                </text>
              </g>

              {/* Hospital Nodes on City Map */}
              {Object.values(HOSPITALS).map((h) => {
                const isAcceptedInRoute = sortedRoute.some(r => r.hospitalId === h.id);
                const isPending = incomingRequests.some(r => r.hospitalId === h.id);
                const x = h.coords.x * 3.8;
                const y = h.coords.y * 2.7;

                return (
                  <g
                    key={h.id}
                    transform={`translate(${x}, ${y})`}
                    className="hosp-map-pin"
                    onClick={() => setSelectedPin(h)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      r={isAcceptedInRoute ? 16 : isPending ? 14 : 11}
                      fill={isAcceptedInRoute ? '#0284c7' : isPending ? '#f59e0b' : '#1e293b'}
                      stroke={isAcceptedInRoute ? '#38bdf8' : isPending ? '#fde047' : '#475569'}
                      strokeWidth={isAcceptedInRoute ? 3 : 1.5}
                      filter={isAcceptedInRoute ? 'url(#hospGlow)' : undefined}
                      className={isAcceptedInRoute ? 'pin-pulse' : ''}
                    />
                    <text y="3.5" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="800" fontFamily="JetBrains Mono">
                      {h.shortName.slice(0, 3).toUpperCase()}
                    </text>
                    <text y="24" textAnchor="middle" fill={isAcceptedInRoute ? '#38bdf8' : '#cbd5e1'} fontSize="8" fontWeight="700">
                      {h.shortName}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Sequential Smart Itinerary List */}
          <div className="route-itinerary">
            <div className="route-itinerary__header">
              <h4 className="route-itinerary__title">Optimized Transit Sequence</h4>
              <span className="route-itinerary__sub">Execute collections in chronological order below</span>
            </div>

            {sortedRoute.length === 0 ? (
              <div className="route-itinerary__empty">
                <p>No active hospital stops currently assigned. Accept incoming requests from the first tab to build your transit route.</p>
              </div>
            ) : (
              <div className="route-stops-list">
                {sortedRoute.map((stop, idx) => {
                  const isFirst = idx === 0;

                  return (
                    <div key={stop.id} className={`route-stop-card ${isFirst ? 'route-stop-card--first' : ''}`}>
                      <div className="route-stop-card__badge-col">
                        <span className="route-stop-card__index-pill">
                          STOP #{idx + 1}
                        </span>
                        {isFirst && <span className="route-stop-card__next-tag">NEXT WAYPOINT</span>}
                      </div>

                      <div className="route-stop-card__details">
                        <div className="route-stop-card__title-row">
                          <h4 className="route-stop-card__hosp-name">{stop.hospitalName}</h4>
                          <span className={`hosp-urgency-badge hosp-urgency-badge--${stop.urgency.toLowerCase()}`}>
                            {stop.urgency}
                          </span>
                        </div>

                        <p className="route-stop-card__meta">
                          <MapPin size={11} />
                          {stop.hospitalAddress} • <strong>{stop.wardName}</strong>
                        </p>

                        <div className="route-stop-card__cargo-row">
                          <span className="route-stop-card__cargo-stat">
                            <Package size={12} /> {stop.estimatedBags} Bags (~{stop.estimatedWeightKg} kg)
                          </span>
                          <span className="route-stop-card__time">
                            Accepted {stop.acceptedByDriverAt ? new Date(stop.acceptedByDriverAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'recently'}
                          </span>
                        </div>

                        {/* Handover / Collection Button */}
                        <button
                          type="button"
                          className="route-stop-card__confirm-btn"
                          onClick={() => handleComplete(stop.id, stop.hospitalName)}
                        >
                          <CheckCircle2 size={15} />
                          <span>Confirm Waste Pickup & Manifest Handover</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Final Stop at CBWTF Hub */}
                <div className="route-stop-card route-stop-card--final">
                  <div className="route-stop-card__badge-col">
                    <span className="route-stop-card__index-pill route-stop-card__index-pill--hub">
                      FINAL STOP
                    </span>
                  </div>
                  <div className="route-stop-card__details">
                    <h4 className="route-stop-card__hosp-name">{CBWTF_FACILITY.name}</h4>
                    <p className="route-stop-card__meta">
                      <MapPin size={11} /> {CBWTF_FACILITY.address} • Bio-Hazard Unloading Bay
                    </p>
                    <span className="route-stop-card__hub-note">
                      High-temperature incineration (1100°C), shredding & autoclave sterilization.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
