/**
 * SegreGuard — Live Edge Computer Vision Classifier (TensorFlow.js + MobileNet)
 * Runs client-side directly on webcam video frames.
 * Closes literature GAPs 4 & 5 (Edge / on-device inference, zero video uploaded for DPDP privacy).
 */

import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { evaluateLegalCategory } from './rulesEngine.js';

let modelPromise = null;

// Pre-load the lightweight MobileNet model in memory
export async function loadModel() {
  if (!modelPromise) {
    modelPromise = mobilenet.load({
      version: 2,
      alpha: 1.0
    }).catch(err => {
      console.warn('Failed to load MobileNet v2, falling back to v1:', err);
      return mobilenet.load({ version: 1, alpha: 0.75 });
    });
  }
  return modelPromise;
}

/**
 * Classify a live HTMLVideoElement or image frame using TensorFlow.js
 * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement} videoElement
 * @returns {Promise<Object>}
 */
export async function classifyLiveFrame(videoElement) {
  if (!videoElement) {
    throw new Error('No video frame available for inference');
  }

  // Ensure model is loaded
  const model = await loadModel();

  // Run real-time inference on the video pixels
  const predictions = await model.classify(videoElement, 5);

  if (!predictions || predictions.length === 0) {
    return {
      itemLabel: 'Unidentified Object',
      category: 'unknown',
      confidence: 0.25,
      disposalRoute: 'Hold for manual verification',
      ruleCitation: 'CPCB Rule 8(2): Fail-Closed Protocol',
      storageMaxHours: 48,
      rawPredictions: []
    };
  }

  // Top prediction
  const top = predictions[0];
  const allLabels = predictions.map(p => p.className.toLowerCase()).join(' ');

  // Map to statutory CPCB category via rulesEngine
  let ruleDecision = evaluateLegalCategory(top.className);

  // If top isn't medical but subsequent prediction matches a known medical keyword:
  if (ruleDecision.categoryKey === 'unknown') {
    for (const p of predictions.slice(1)) {
      const alt = evaluateLegalCategory(p.className);
      if (alt.categoryKey !== 'unknown') {
        ruleDecision = alt;
        break;
      }
    }
  }

  // Format clean human-readable name
  let cleanName = top.className.split(',')[0];
  cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  // Confidence gating (CPCB safety principle: fail-closed below 70%)
  const confidence = Math.min(0.99, Math.max(0.35, top.probability));

  return {
    itemLabel: cleanName,
    category: confidence < 0.70 ? 'unknown' : ruleDecision.categoryKey,
    confidence: Number(confidence.toFixed(2)),
    disposalRoute: ruleDecision.disposalRoute,
    ruleCitation: ruleDecision.ruleCitation,
    colorHex: ruleDecision.colorHex,
    storageMaxHours: ruleDecision.storageMaxHours || 48,
    rawPredictions: predictions.map(p => `${p.className} (${Math.round(p.probability * 100)}%)`)
  };
}
