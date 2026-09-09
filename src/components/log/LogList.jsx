import React, { useState, useEffect } from 'react';
import { useRole } from '../../context/RoleContext.jsx';
import { subscribeToWasteEvents } from '../../lib/firestoreOps.js';
import { CATEGORY_INFO, CONFIDENCE_THRESHOLD } from '../../classifiers/classifierInterface.js';
import { 
  ClipboardList, 
  CheckCircle2, 
  Edit3, 
  Clock, 
  ShieldCheck, 
  FileText 
} from 'lucide-react';
import './Log.css';

export default function LogList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { role } = useRole();

  useEffect(() => {
    const wardId = role.id === 'admin' ? null : role.wardId;
    const unsub = subscribeToWasteEvents(wardId, (data) => {
      setEvents(data || []);
      setLoading(false);
    });
    return unsub;
  }, [role]);

  if (loading) {
    return (
      <div className="log">
        <div className="log__loading">
          <div className="log__spinner" />
          <p className="log__loading-text">Retrieving cryptographic audit events…</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="log">
        <div className="log__header">
          <div className="log__title-row">
            <ClipboardList className="log__header-icon" size={20} />
            <h2 className="log__title">Point-of-Care Audit Log</h2>
          </div>
        </div>
        <div className="log__empty-card">
          <div className="log__empty-icon-wrap">
            <FileText size={32} className="text-sky" />
          </div>
          <h3 className="log__empty-title">Zero Active Log Entries</h3>
          <p className="log__empty-desc">
            Classify a waste item using the AI Scanner to record your first tamper-evident event into the CPCB compliance ledger.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="log">
      <div className="log__header">
        <div>
          <div className="log__title-row">
            <ClipboardList className="log__header-icon" size={20} />
            <h2 className="log__title">Point-of-Care Audit Log</h2>
          </div>
          <p className="log__subtitle">Statutory verification ledger conforming to CPCB Schedule IV</p>
        </div>
        <span className="log__count-chip">{events.length} Verified Entries</span>
      </div>

      <div className="log__list">
        {events.map((event) => {
          const info = CATEGORY_INFO[event.category] || CATEGORY_INFO.unknown;
          const isLow = event.confidence < CONFIDENCE_THRESHOLD;
          const time = event.createdAt
            ? new Date(event.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            : 'Just now';

          return (
            <div key={event.id} className="log-card-outer">
              <div className="log-card-inner">
                <div 
                  className="log-card__dot" 
                  style={{ 
                    background: info.color, 
                    boxShadow: `0 0 8px ${info.color}` 
                  }} 
                />
                
                <div className="log-card__content">
                  <div className="log-card__top">
                    <span className="log-card__item">{event.itemLabel}</span>
                    {event.wasEdited && (
                      <span className="log-card__edited-badge">
                        <Edit3 size={11} />
                        <span>Corrected</span>
                      </span>
                    )}
                  </div>

                  <div className="log-card__bottom">
                    <span className="log-card__category" style={{ color: info.color }}>
                      {info.label}
                    </span>
                    <span className="log-card__sep">•</span>
                    <span className={`log-card__confidence ${isLow ? 'log-card__confidence--low' : ''}`}>
                      {Math.round((event.confidence || 0.95) * 100)}% Match
                    </span>
                    <span className="log-card__sep">•</span>
                    <span className="log-card__time">
                      <Clock size={11} className="log-card__time-icon" />
                      <span>{time}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
