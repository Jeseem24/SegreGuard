import React from 'react';
import { CATEGORY_INFO } from '../../classifiers/classifierInterface.js';

/**
 * Manual category picker — 4 large, color-coded buttons (Yellow / Red / White / Blue).
 * Shown automatically for low-confidence results, available on demand via "Correct it".
 */
export default function ManualPicker({ onSelect, onCancel }) {
  const categories = ['yellow', 'red', 'white', 'blue'];

  return (
    <div className="manual-picker">
      <div className="manual-picker__header">
        <h3>Select the correct bin</h3>
        <button className="manual-picker__close" onClick={onCancel}>✕</button>
      </div>
      <div className="manual-picker__grid">
        {categories.map((cat) => {
          const info = CATEGORY_INFO[cat];
          return (
            <button
              key={cat}
              className="manual-picker__btn"
              style={{
                '--pick-color': info.color,
                '--pick-bg': info.bgColor,
                '--pick-text': info.textColor
              }}
              onClick={() => onSelect(cat)}
            >
              <span className="manual-picker__dot" />
              <span className="manual-picker__label">{info.label}</span>
              <span className="manual-picker__desc">{info.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
