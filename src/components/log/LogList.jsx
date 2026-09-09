import React, { useState, useEffect } from 'react';
import { useRole } from '../../context/RoleContext.jsx';
import { subscribeToWasteEvents } from '../../lib/firestoreOps.js';
import { CATEGORY_INFO, CONFIDENCE_THRESHOLD } from '../../classifiers/classifierInterface.js';
import './Log.css';

export default function LogList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { role } = useRole();

  useEffect(() => {
    // Admin sees all wards, worker sees own ward
    const wardId = role.id === 'admin' ? null : role.wardId;
    const unsub = subscribeToWasteEvents(wardId, (data) => {
      setEvents(data);
      setLoading(false);
    });
    return unsub;
  }, [role]);

  if (loading) {
    return (
      <div className="log">
        <div className="log__header">
          <h2 className="log__title">Scan History</h2>
        </div>
        <div className="log__loading">
          <div className="log__spinner" />
          <p>Loading events…</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="log">
        <div className="log__header">
          <h2 className="log__title">Scan History</h2>
        </div>
        <div className="log__empty">
          <span className="log__empty-icon">📋</span>
          <h3>No scans yet</h3>
          <p>Use the Scanner tab to classify your first waste item. Every scan will appear here as a traceable event.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="log">
      <div className="log__header">
        <h2 className="log__title">Scan History</h2>
        <span className="log__count">{events.length} events</span>
      </div>
      <div className="log__list">
        {events.map((event) => {
          const info = CATEGORY_INFO[event.category] || CATEGORY_INFO.unknown;
          const isLow = event.confidence < CONFIDENCE_THRESHOLD;
          const time = event.createdAt?.toDate
            ? event.createdAt.toDate().toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit'
              })
            : '—';
          const date = event.createdAt?.toDate
            ? event.createdAt.toDate().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short'
              })
            : '';

          return (
            <div key={event.id} className="log-row">
              <div
                className="log-row__dot"
                style={{ background: info.color }}
              />
              <div className="log-row__content">
                <div className="log-row__top">
                  <span className="log-row__item">{event.itemLabel}</span>
                  {event.wasEdited && (
                    <span className="log-row__edited-badge">✏️ Corrected</span>
                  )}
                </div>
                <div className="log-row__bottom">
                  <span className="log-row__category">{info.label}</span>
                  <span className="log-row__separator">·</span>
                  <span className={`log-row__confidence ${isLow ? 'log-row__confidence--low' : ''}`}>
                    {Math.round(event.confidence * 100)}%
                  </span>
                  <span className="log-row__separator">·</span>
                  <span className="log-row__time">{time} {date}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
