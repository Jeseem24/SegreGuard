import React, { useState, useEffect } from 'react';
import {
  subscribeToCollectionTasks,
  markTaskCollected,
  calculateSlaStatus,
  requestPickup,
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
  X
} from 'lucide-react';
import './Tasks.css';

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'route'
  const [selectedPin, setSelectedPin] = useState(null);

  useEffect(() => {
    const unsub = subscribeToCollectionTasks((data) => {
      setTasks(data || []);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleCollect = async (taskId) => {
    setCollecting(taskId);
    try {
      await markTaskCollected(taskId);
    } catch (err) {
      console.error('Failed to mark collected:', err);
    }
    setCollecting(null);
  };

  const handleCreateMockPickup = async () => {
    const wardKeys = Object.keys(HOSPITAL_WARDS);
    const randomWard = wardKeys[Math.floor(Math.random() * wardKeys.length)];
    const categories = ['yellow', 'red', 'white', 'blue'];
    const randomCat = categories[Math.floor(Math.random() * categories.length)];
    await requestPickup(randomCat, randomWard, 'Immediate Ward Collection Request (Capacity > 80%)');
  };

  if (loading) {
    return (
      <div className="tasks">
        <div className="tasks__loading">
          <div className="tasks__spinner" />
          <p className="tasks__loading-text">Connecting real-time logistics dispatch…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tasks">
      {/* Header */}
      <div className="tasks__header">
        <div>
          <div className="tasks__title-row">
            <Truck className="tasks__header-icon" size={20} />
            <h2 className="tasks__title">Logistics & SLA Dispatch</h2>
          </div>
          <p className="tasks__subtitle">Demand-driven transit routing & 48h statutory compliance</p>
        </div>
        <div className="tasks__live-badge">
          <span className="tasks__live-dot" />
          <span>REALTIME</span>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="tasks__view-toggle">
        <button
          type="button"
          className={`tasks__toggle-btn ${viewMode === 'list' ? 'tasks__toggle-btn--active' : ''}`}
          onClick={() => setViewMode('list')}
        >
          <Boxes size={15} />
          <span>Active Queue ({tasks.length})</span>
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

      {/* VIEW 1: Task List */}
      {viewMode === 'list' && (
        <>
          {tasks.length === 0 ? (
            <div className="tasks__empty-card">
              <div className="tasks__empty-icon-wrap">
                <CheckCircle2 size={36} className="text-emerald" />
              </div>
              <h3 className="tasks__empty-title">All Hospital Wards Clear</h3>
              <p className="tasks__empty-desc">
                No active bio-medical waste bags are awaiting transit or breaching the 48-hour statutory threshold.
              </p>
              <button 
                type="button"
                className="tasks__mock-btn"
                onClick={handleCreateMockPickup}
              >
                <PlusCircle size={15} />
                <span>Simulate Emergency Ward Alert</span>
              </button>
            </div>
          ) : (
            <div className="tasks__list">
              {tasks.map((task) => {
                const info = CATEGORY_INFO[task.category] || CATEGORY_INFO.unknown;
                const ward = HOSPITAL_WARDS[task.wardId] || { name: task.wardId, floor: 'Floor 2' };
                const sla = calculateSlaStatus(task.slaDeadline);

                const time = task.requestedAt
                  ? new Date(task.requestedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Just now';

                return (
                  <div
                    key={task.id}
                    className="task-card-outer"
                    style={{
                      '--task-color': info.color,
                      '--task-glow': `${info.color}22`
                    }}
                  >
                    <div className="task-card-inner">
                      {/* Top Meta */}
                      <div className="task-card__top">
                        <div className="task-card__bin-badge" style={{ background: `${info.color}20`, borderColor: `${info.color}50` }}>
                          <span className="task-card__dot" style={{ background: info.color, boxShadow: `0 0 8px ${info.color}` }} />
                          <span className="task-card__bin-label" style={{ color: info.color }}>{info.label}</span>
                        </div>
                        <span className="task-card__time">Logged {time}</span>
                      </div>

                      {/* Location details */}
                      <div className="task-card__location">
                        <div className="task-card__ward-icon">
                          <Building2 size={16} />
                        </div>
                        <div>
                          <h4 className="task-card__ward-name">{ward.name}</h4>
                          <span className="task-card__floor">{ward.floor}</span>
                        </div>
                      </div>

                      {/* Statutory 48-Hour SLA Countdown */}
                      <div className={`task-card__sla task-card__sla--${sla.status.toLowerCase()}`}>
                        <div className="task-card__sla-left">
                          <Clock size={13} className="task-card__sla-clock" />
                          <span className="task-card__sla-label">CPCB 48h Limit:</span>
                        </div>
                        <span className="task-card__sla-time">{sla.text}</span>
                      </div>

                      {task.reason && (
                        <div className="task-card__trigger-reason">
                          <span className="task-card__trigger-tag">Reason:</span> {task.reason}
                        </div>
                      )}

                      {/* Handover Action */}
                      <button
                        type="button"
                        className="task-card__collect-btn"
                        onClick={() => handleCollect(task.id)}
                        disabled={collecting === task.id}
                      >
                        {collecting === task.id ? (
                          <>
                            <span className="task-card__btn-spinner" />
                            <span>Verifying Barcode Custody…</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={15} />
                            <span>Confirm Pickup & Reset Bin</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* VIEW 2: Route Optimization Map */}
      {viewMode === 'route' && (
        <div className="route-view">
          <div className="route-view__metrics">
            <div className="route-metric">
              <span className="route-metric__label">Active Pickups</span>
              <span className="route-metric__value">{tasks.length} Stations</span>
            </div>
            <div className="route-metric">
              <span className="route-metric__label">Cycle Time</span>
              <span className="route-metric__value">{Math.max(6, tasks.length * 4)} Mins</span>
            </div>
            <div className="route-metric">
              <span className="route-metric__label">Transit Savings</span>
              <span className="route-metric__value route-metric__value--highlight">28% Less Exposure</span>
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

              {/* Hospital Corridor Boundary */}
              <rect x="20" y="20" width="360" height="280" rx="16" fill="rgba(15, 23, 42, 0.7)" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1.5" />
              <text x="35" y="45" fill="#64748b" fontSize="9" fontWeight="700" letterSpacing="1" fontFamily="JetBrains Mono">
                FACILITY FLOORPLAN • LEVEL 1-3 CORRIDOR MATRIX
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

              {/* Central Bio-Waste Bay Node */}
              <g transform="translate(55, 255)">
                <circle r="14" fill="#0b1329" stroke="#10b981" strokeWidth="2.5" filter="url(#glow)" />
                <circle r="5" fill="#10b981" />
                <text y="24" textAnchor="middle" fill="#34d399" fontSize="8.5" fontWeight="700" fontFamily="JetBrains Mono">
                  CBWTF Bay
                </text>
              </g>

              {/* Hospital Wards Nodes */}
              {Object.entries(HOSPITAL_WARDS).map(([wId, ward]) => {
                const hasTask = tasks.some(t => t.wardId === wId);
                const x = ward.coords.x * 3.6;
                const y = ward.coords.y * 2.8;
                const isSelected = selectedPin && selectedPin.id === wId;

                return (
                  <g
                    key={wId}
                    transform={`translate(${x}, ${y})`}
                    className="route-pin"
                    onClick={() => setSelectedPin(ward)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      r={hasTask ? 16 : 11}
                      fill={hasTask ? '#ef4444' : '#1e293b'}
                      stroke={isSelected ? '#38bdf8' : hasTask ? '#fee2e2' : '#475569'}
                      strokeWidth={isSelected ? 3 : hasTask ? 2 : 1}
                      filter={hasTask || isSelected ? 'url(#glow)' : undefined}
                      className={hasTask ? 'pin-pulse' : ''}
                    />
                    <text y="3.5" textAnchor="middle" fill={hasTask ? '#ffffff' : '#94a3b8'} fontSize="9" fontWeight="700" fontFamily="JetBrains Mono">
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
          {selectedPin && (
            <div className="route-station-card">
              <div className="route-station-card__header">
                <div>
                  <h4 className="route-station-card__title">{selectedPin.name}</h4>
                  <p className="route-station-card__sub">{selectedPin.floor} • Node {selectedPin.id.toUpperCase()}</p>
                </div>
                <button 
                  type="button"
                  className="route-station-card__close"
                  onClick={() => setSelectedPin(null)}
                  title="Close station details"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="route-station-card__body">
                {tasks.filter(t => t.wardId === selectedPin.id).length > 0 ? (
                  <div className="route-station-card__tasks">
                    {tasks.filter(t => t.wardId === selectedPin.id).map(t => {
                      const cInfo = CATEGORY_INFO[t.category] || CATEGORY_INFO.unknown;
                      return (
                        <div key={t.id} className="route-station-task-row">
                          <div className="route-station-task-meta">
                            <span className="route-station-task-dot" style={{ background: cInfo.color }} />
                            <div>
                              <span className="route-station-task-label" style={{ color: cInfo.color }}>{cInfo.label}</span>
                              <span className="route-station-task-reason">{t.reason || 'Pending porter transit'}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="route-station-collect-btn"
                            onClick={() => handleCollect(t.id)}
                            disabled={collecting === t.id}
                          >
                            <CheckCircle2 size={13} />
                            <span>Collect</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="route-station-card__clear">
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span>All bins in this ward are currently below 80% threshold.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="route-view__tip">
            <Sparkles size={16} className="text-sky" />
            <span>
              <strong>Demand-Driven Dispatch:</strong> Tap any station pin on the floorplan to inspect live ward logistics and immediately acknowledge collections.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
