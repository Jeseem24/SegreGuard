import React from 'react';
import { CATEGORY_INFO } from '../../classifiers/classifierInterface.js';
import { X, Check, ShieldCheck } from 'lucide-react';

/**
 * Manual category picker — Shadcn-inspired bottom sheet modal
 * Supports all 5 statutory CPCB 2016 categories (Yellow, Red, White, Blue, Black).
 */
export default function ManualPicker({ onSelect, onCancel }) {
  const categories = ['yellow', 'red', 'white', 'blue', 'black'];

  return (
    <div className="manual-picker-overlay" onClick={onCancel}>
      <div className="manual-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="manual-picker-handle" />
        
        <div className="manual-picker__header">
          <div className="manual-picker__header-text">
            <h3 className="manual-picker__title">Statutory Bin Classification</h3>
            <p className="manual-picker__subtitle">Select source-segregation category per CPCB BMW Rules 2016</p>
          </div>
          <button className="manual-picker__close" onClick={onCancel} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="manual-picker__grid">
          {categories.map((cat) => {
            const info = CATEGORY_INFO[cat] || CATEGORY_INFO.unknown;
            return (
              <button
                key={cat}
                className="manual-picker__btn"
                style={{
                  '--pick-color': info.color,
                  '--pick-glow': `${info.color}25`
                }}
                onClick={() => onSelect(cat)}
              >
                <div 
                  className="manual-picker__color-badge" 
                  style={{ background: info.color, boxShadow: `0 0 10px ${info.color}` }} 
                />
                <div className="manual-picker__info">
                  <div className="manual-picker__name-row">
                    <span className="manual-picker__name" style={{ color: info.color }}>{info.label}</span>
                    <span className="manual-picker__code">CPCB Sched. I</span>
                  </div>
                  <span className="manual-picker__desc">{info.description || info.disposalRoute}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
