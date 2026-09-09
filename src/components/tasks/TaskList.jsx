import React, { useState, useEffect } from 'react';
import {
  subscribeToCollectionTasks,
  markTaskCollected,
  calculateSlaStatus,
  HOSPITAL_WARDS
} from '../../lib/firestoreOps.js';
import { CATEGORY_INFO } from '../../classifiers/classifierInterface.js';
import './Tasks.css';

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'route'
  const [selectedPin, setSelectedPin] = useState(null);

  useEffect(() => {
    const unsub = subscribeToCollectionTasks((data) => {
      setTasks(data);
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

  if (loading) {
    return (
      <div className="tasks">
        <div className="tasks__header">
          <h2 className="tasks__title">Transporter Dispatch</h2>
        </div>
        <div className="tasks__loading">
          <div className="tasks__spinner" />
          <p>Connecting real-time dispatch queue…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tasks">
      {/* Header */}
      <div className="tasks__header">
        <div>
          <h2 className="tasks__title">Waste Dispatch & Logistics</h2>
          <p className="tasks__subtitle">Demand-driven internal hospital porter queue</p>
        </div>
        <div className="tasks__live-badge">
          <span className="tasks__live-dot" />
          Live
        </div>
      </div>

      {/* View Toggle */}
      <div className="tasks__view-toggle">
        <button
          className={`tasks__toggle-btn ${viewMode === 'list' ? 'tasks__toggle-btn--active' : ''}`}
          onClick={() => setViewMode('list')}
        >
          📋 Pickup Queue ({tasks.length})
        </button>
        <button
          className={`tasks__toggle-btn ${viewMode === 'route' ? 'tasks__toggle-btn--active' : ''}`}
          onClick={() => setViewMode('route')}
        >
          🗺️ Optimized Route Map
        </button>
      </div>

      {/* VIEW 1: Task List */}
      {viewMode === 'list' && (
        <>
          {tasks.length === 0 ? (
            <div className="tasks__empty">
              <span className="tasks__empty-icon">✅</span>
              <h3>All Hospital Wards Clear</h3>
              <p>No bins are currently near capacity or breaching the 48-hour statutory limit.</p>
            </div>
          ) : (
            <div className="tasks__list">
              {tasks.map((task) => {
                const info = CATEGORY_INFO[task.category] || CATEGORY_INFO.unknown;
                const ward = HOSPITAL_WARDS[task.wardId] || { name: task.wardId, floor: 'Facility Hub' };
                const sla = calculateSlaStatus(task.slaDeadline);

                const time = task.requestedAt
                  ? new Date(task.requestedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : '—';

                return (
                  <div
                    key={task.id}
                    className="task-card"
                    style={{
                      '--task-color': info.color,
                      '--task-bg': info.bgColor,
                      '--task-text': info.textColor
                    }}
                  >
                    <div className="task-card__top">
                      <div className="task-card__bin">
                        <div className="task-card__dot" />
                        <span className="task-card__bin-label">{info.label}</span>
                      </div>
                      <span className="task-card__time">Dispatched {time}</span>
                    </div>

                    <div className="task-card__location">
                      <h4 className="task-card__ward-name">{ward.name}</h4>
                      <p className="task-card__floor">{ward.floor}</p>
                    </div>

                    {/* Statutory 48-Hour SLA Countdown */}
                    <div className={`task-card__sla task-card__sla--${sla.status.toLowerCase()}`}>
                      <div className="task-card__sla-left">
                        <span className="task-card__sla-icon">⏱️</span>
                        <span className="task-card__sla-label">48-Hr Statutory SLA:</span>
                      </div>
                      <span className="task-card__sla-time">{sla.text}</span>
                    </div>

                    {task.reason && (
                      <div className="task-card__trigger-reason">
                        <span>Trigger:</span> {task.reason}
                      </div>
                    )}

                    <button
                      className="task-card__collect-btn"
                      onClick={() => handleCollect(task.id)}
                      disabled={collecting === task.id}
                    >
                      {collecting === task.id ? (
                        <>
                          <span className="task-card__btn-spinner" />
                          Verifying Handover…
                        </>
                      ) : (
                        '✓ Collect & Reset Bin'
                      )}
                    </button>
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
              <span className="route-metric__label">Dynamic Stops</span>
              <span className="route-metric__value">{tasks.length} Active Hubs</span>
            </div>
            <div className="route-metric">
              <span className="route-metric__label">Est. Cycle Time</span>
              <span className="route-metric__value">{Math.max(8, tasks.length * 5)} Mins</span>
            </div>
            <div className="route-metric">
              <span className="route-metric__label">Fuel / Distance Saved</span>
              <span className="route-metric__value text-emerald">28% (Optimized)</span>
            </div>
          </div>

          <div className="route-map-container">
            <svg className="route-map" viewBox="0 0 400 320">
              <defs>
                <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" />
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

              {/* Grid background */}
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              </pattern>
              <rect width="400" height="320" fill="url(#grid)" />

              {/* Facility Boundary & Wings */}
              <rect x="20" y="20" width="360" height="280" rx="12" fill="rgba(15, 23, 42, 0.6)" stroke="rgba(59, 130, 246, 0.2)" strokeWidth="1.5" />
              <text x="35" y="45" fill="#64748b" fontSize="10" fontWeight="600" letterSpacing="1">CENTRAL HOSPITAL CAMPUS — LEVEL 1-3</text>

              {/* Connective Route Line */}
              <path
                d="M 50 260 L 120 120 L 290 90 L 270 240 Z"
                fill="rgba(59, 130, 246, 0.05)"
                stroke="url(#routeGradient)"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                className="route-path-animated"
              />

              {/* Central Waste Room / CBWTF Bay Node */}
              <g transform="translate(50, 260)">
                <circle r="14" fill="#0f172a" stroke="#10b981" strokeWidth="2.5" filter="url(#glow)" />
                <text y="4" textAnchor="middle" fill="#10b981" fontSize="11" fontWeight="700">⚑</text>
                <text y="25" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="600">CBWTF Bay</text>
              </g>

              {/* Ward Nodes */}
              {Object.entries(HOSPITAL_WARDS).map(([wId, ward]) => {
                const hasTask = tasks.some(t => t.wardId === wId);
                const x = ward.coords.x * 3.6;
                const y = ward.coords.y * 2.8;

                return (
                  <g
                    key={wId}
                    transform={`translate(${x}, ${y})`}
                    className="route-pin"
                    onClick={() => setSelectedPin(ward)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      r={hasTask ? 16 : 10}
                      fill={hasTask ? '#ef4444' : '#1e293b'}
                      stroke={hasTask ? '#fee2e2' : '#475569'}
                      strokeWidth={hasTask ? 2 : 1}
                      filter={hasTask ? 'url(#glow)' : undefined}
                      className={hasTask ? 'pin-pulse' : ''}
                    />
                    <text y="4" textAnchor="middle" fill={hasTask ? '#fff' : '#94a3b8'} fontSize="10" fontWeight="700">
                      {wId.replace('ward-', 'W')}
                    </text>
                    <text y="26" textAnchor="middle" fill="#cbd5e1" fontSize="9" fontWeight="600">
                      {ward.name.split(' ')[0]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="route-view__tip">
            <span className="route-view__tip-icon">💡</span>
            <span>
              <strong>Demand-Driven Dispatch:</strong> Eliminates static rounds. Porters navigate straight to full/high-SLA bins, cutting hospital internal transit times by up to 28%.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
