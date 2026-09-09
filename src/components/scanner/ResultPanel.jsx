import React from 'react';
import { CATEGORY_INFO, CONFIDENCE_THRESHOLD } from '../../classifiers/classifierInterface.js';

/**
 * ResultPanel:
 * - High confidence: color-matched statutory CPCB bin panel with rule citation & disposal method
 * - Low confidence: amber fail-closed "Manual Verification Required" panel
 */
export default function ResultPanel({ result, onCorrect, onRequestPickup }) {
  if (!result) return null;

  const isLowConfidence = result.confidence < CONFIDENCE_THRESHOLD;
  const category = isLowConfidence ? 'unknown' : result.category;
  const info = CATEGORY_INFO[category] || CATEGORY_INFO.unknown;

  return (
    <div
      className={`result-panel ${isLowConfidence ? 'result-panel--low' : 'result-panel--high'}`}
      style={{
        '--bin-color': info.color,
        '--bin-bg': info.bgColor,
        '--bin-text': info.textColor
      }}
    >
      <div className="result-panel__bin-indicator">
        <div className="result-panel__bin-dot" />
        <span className="result-panel__bin-label">{info.label}</span>
        {info.badge && <span className="result-panel__badge">{info.badge}</span>}
      </div>

      <div className="result-panel__content">
        <h3 className="result-panel__item">{result.itemLabel}</h3>
        <p className="result-panel__route"><strong>Disposal Route:</strong> {info.disposalRoute}</p>

        {/* Regulatory Citation (GAP 1 & GAP 2) */}
        <div className="result-panel__citation">
          <span className="result-panel__citation-icon">⚖️</span>
          <span className="result-panel__citation-text">
            {result.ruleCitation || info.ruleCitation || 'CPCB BMW Rules 2016 (Schedule I)'}
          </span>
        </div>

        <div className="result-panel__confidence">
          <div className="result-panel__confidence-bar">
            <div
              className="result-panel__confidence-fill"
              style={{ width: `${Math.round(result.confidence * 100)}%` }}
            />
          </div>
          <div className="result-panel__confidence-meta">
            <span className="result-panel__confidence-value">
              {Math.round(result.confidence * 100)}% Confidence
            </span>
            <span className="result-panel__sla-chip">
              ⏱️ 48h Statutory SLA
            </span>
          </div>
        </div>
      </div>

      <div className="result-panel__actions">
        <button className="result-panel__btn result-panel__btn--correct" onClick={onCorrect}>
          {isLowConfidence ? '🏷️ Select Category Manually' : '✏️ Not this? Correct it'}
        </button>
        {!isLowConfidence && (
          <button className="result-panel__btn result-panel__btn--pickup" onClick={onRequestPickup}>
            ⚡ Dispatch Collection Porter
          </button>
        )}
      </div>
    </div>
  );
}
