import React from 'react';
import { CATEGORY_INFO, CONFIDENCE_THRESHOLD } from '../../classifiers/classifierInterface.js';
import { 
  Scale, 
  Clock, 
  Edit3, 
  Truck, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  Volume2
} from 'lucide-react';

/**
 * ResultPanel:
 * Agency-grade Double-Bezel result card with statutory CPCB color aura,
 * high-contrast typography, and Lucide SVG icons.
 */
export default function ResultPanel({ result, onCorrect, onRequestPickup }) {
  if (!result) return null;

  const isLowConfidence = result.confidence < CONFIDENCE_THRESHOLD;
  const category = isLowConfidence ? 'unknown' : result.category;
  const info = CATEGORY_INFO[category] || CATEGORY_INFO.unknown;

  const playVoice = () => {
    if ('speechSynthesis' in window) {
      const text = `${result.itemLabel}. Dispose in ${info.label}. ${info.disposalRoute}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div 
      className={`result-card-bezel ${isLowConfidence ? 'result-card-bezel--low' : ''}`}
      style={{
        '--bin-color': info.color,
        '--bin-glow': `${info.color}33`
      }}
    >
      <div className="result-card-core">
        {/* Top Header Strip */}
        <div className="result-card__header">
          <div className="result-card__bin-tag" style={{ background: `${info.color}22`, borderColor: `${info.color}66` }}>
            <span className="result-card__bin-dot" style={{ background: info.color, boxShadow: `0 0 8px ${info.color}` }} />
            <span className="result-card__bin-name" style={{ color: info.color }}>{info.label}</span>
          </div>

          <div className="result-card__badges">
            <button 
              className="result-card__voice-btn" 
              onClick={playVoice}
              title="Play Statutory Audio Guidance"
            >
              <Volume2 size={14} />
            </button>
            <span className="result-card__sla-chip">
              <Clock size={12} className="result-card__sla-icon" />
              <span>48h CPCB SLA</span>
            </span>
          </div>
        </div>

        {/* Item Identification & Disposal Method */}
        <div className="result-card__main">
          <div className="result-card__title-row">
            <h3 className="result-card__item-title">{result.itemLabel}</h3>
            <span className="result-card__confidence-pill">
              {Math.round(result.confidence * 100)}% Match
            </span>
          </div>

          <p className="result-card__disposal">
            <span className="result-card__disposal-label">Treatment Protocol:</span> {info.disposalRoute}
          </p>

          {/* Statutory Citation Box */}
          <div className="result-card__citation">
            <Scale size={15} className="result-card__citation-icon" style={{ color: info.color }} />
            <div className="result-card__citation-content">
              <span className="result-card__citation-title">CPCB BMW Rules 2016 (Schedule I)</span>
              <span className="result-card__citation-text">
                {result.ruleCitation || info.ruleCitation || 'Statutory segregation protocol enforced at source.'}
              </span>
            </div>
          </div>

          {/* Confidence Track */}
          <div className="result-card__meter">
            <div className="result-card__meter-bar">
              <div 
                className="result-card__meter-fill" 
                style={{ 
                  width: `${Math.round(result.confidence * 100)}%`,
                  background: info.color,
                  boxShadow: `0 0 10px ${info.color}`
                }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="result-card__actions">
          <button 
            className="result-btn result-btn--edit" 
            onClick={onCorrect}
          >
            <Edit3 size={14} />
            <span>{isLowConfidence ? 'Manual Verify' : 'Reclassify'}</span>
          </button>

          {!isLowConfidence && (
            <button 
              className="result-btn result-btn--dispatch" 
              onClick={onRequestPickup}
              style={{ background: info.color, color: category === 'white' ? '#050811' : '#ffffff' }}
            >
              <Truck size={15} />
              <span>Dispatch Porter</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
