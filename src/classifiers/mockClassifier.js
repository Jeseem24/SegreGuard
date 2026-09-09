/* ── Mock Classifier ──
 * Evaluates simulated video frames through the decoupled CPCB Rules Engine.
 * Provides deterministic, repeatable results for live hackathon demos.
 */

import { evaluateLegalCategory } from './rulesEngine.js';

const MOCK_DETECTIONS = [
  {
    rawItemLabel: 'Disposable Syringe (Without Needle)',
    confidence: 0.94,
    detectedClass: 'syringe'
  },
  {
    rawItemLabel: '3-Ply Surgical Mask (Contaminated)',
    confidence: 0.89,
    detectedClass: 'mask'
  },
  {
    rawItemLabel: 'Hypodermic Syringe with Fixed Needle',
    confidence: 0.96,
    detectedClass: 'needle'
  },
  {
    rawItemLabel: 'Blood-Soaked Cotton Gauze',
    confidence: 0.92,
    detectedClass: 'cotton'
  },
  {
    rawItemLabel: 'Antibiotic Glass Vial',
    confidence: 0.91,
    detectedClass: 'vial'
  },
  {
    rawItemLabel: 'Ambiguous / Unidentified Residue',
    confidence: 0.38,
    detectedClass: 'unknown'
  },
  {
    rawItemLabel: 'Surgical Nitrile Glove (Used)',
    confidence: 0.95,
    detectedClass: 'glove'
  },
  {
    rawItemLabel: 'Paper Packaging & Food Wrapper',
    confidence: 0.93,
    detectedClass: 'wrapper'
  }
];

let currentIndex = 0;

/**
 * Classify a frame using the decoupled perception + rules engine pattern.
 * Closes Literature GAP 2: Decoupled Perception & Legal Classification.
 */
export async function classify(_imageFrame) {
  // Simulate rapid edge inference delay (250-450ms)
  await new Promise(resolve => setTimeout(resolve, 250 + Math.random() * 200));

  const detection = MOCK_DETECTIONS[currentIndex];
  currentIndex = (currentIndex + 1) % MOCK_DETECTIONS.length;

  // Evaluate through deterministic statutory rules engine
  const ruleDecision = evaluateLegalCategory(detection.detectedClass);

  return {
    itemLabel: detection.rawItemLabel,
    category: detection.confidence < 0.70 ? 'unknown' : ruleDecision.categoryKey,
    confidence: detection.confidence,
    disposalRoute: ruleDecision.disposalRoute,
    ruleCitation: ruleDecision.ruleCitation,
    colorHex: ruleDecision.colorHex,
    storageMaxHours: ruleDecision.storageMaxHours || 48
  };
}

export function resetMockClassifier() {
  currentIndex = 0;
}
