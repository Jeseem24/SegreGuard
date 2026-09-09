/**
 * SegreGuard — Live Object Detection & Real-Time Bounding Box Tracker
 * Uses TensorFlow.js COCO-SSD + MobileNet to continuously detect and track
 * objects with glowing CPCB statutory color-coded bounding boxes at 20-30 FPS.
 */

import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as mobilenet from '@tensorflow-models/mobilenet';
import { evaluateLegalCategory } from './rulesEngine.js';
import { CATEGORY_INFO } from './classifierInterface.js';

let cocoModelPromise = null;
let mobilenetPromise = null;

export async function loadModels() {
  if (!cocoModelPromise) {
    cocoModelPromise = cocoSsd.load({ base: 'mobilenet_v2' });
  }
  if (!mobilenetPromise) {
    mobilenetPromise = mobilenet.load({ version: 2, alpha: 1.0 }).catch(() => mobilenet.load({ version: 1, alpha: 0.75 }));
  }
  const [coco, mobile] = await Promise.all([cocoModelPromise, mobilenetPromise]);
  return { coco, mobile };
}

/**
 * Start the continuous real-time bounding box detection loop
 * @param {HTMLVideoElement} videoElement
 * @param {HTMLCanvasElement} canvasElement
 * @param {Function} onTrackUpdate - Callback with top tracked item metadata
 * @returns {Function} stopTracking function
 */
export function startLiveTracking(videoElement, canvasElement, onTrackUpdate) {
  let isRunning = true;
  let animId = null;

  async function loop() {
    if (!isRunning) return;

    if (
      videoElement &&
      videoElement.readyState >= 2 &&
      videoElement.videoWidth > 0 &&
      canvasElement
    ) {
      try {
        const { coco, mobile } = await loadModels();

        // Match canvas coordinate space to video
        if (canvasElement.width !== videoElement.videoWidth) {
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
        }

        const ctx = canvasElement.getContext('2d');
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Run real-time COCO-SSD object localization
        const predictions = await coco.detect(videoElement, 4, 0.4);

        let primaryTracked = null;

        // Filter out 'person' unless person is the only object
        const nonPerson = predictions.filter(p => p.class !== 'person');
        const objectsToDraw = nonPerson.length > 0 ? nonPerson : predictions;

        for (const pred of objectsToDraw) {
          const [x, y, width, height] = pred.bbox;

          // Check if object matches CPCB category
          let rawLabel = pred.class;
          let confidence = pred.score;

          // Query MobileNet on camera frame to detect specific medical items (syringe, mask, vial, glove)
          try {
            const fineClasses = await mobile.classify(videoElement, 4);
            if (fineClasses && fineClasses.length > 0) {
              // Check if any prediction matches a known medical waste item
              const medicalMatch = fineClasses.find(c => {
                const name = c.className.toLowerCase();
                return name.includes('syringe') || name.includes('needle') || name.includes('mask') ||
                       name.includes('bandage') || name.includes('gauze') || name.includes('glove') ||
                       name.includes('vial') || name.includes('bottle') || name.includes('scissors');
              });

              if (medicalMatch && medicalMatch.probability > 0.25) {
                rawLabel = medicalMatch.className.split(',')[0];
                confidence = Math.max(confidence, medicalMatch.probability);
              } else if (fineClasses[0].probability > 0.45) {
                rawLabel = fineClasses[0].className.split(',')[0];
                confidence = Math.max(confidence, fineClasses[0].probability);
              }
            }
          } catch (_e) {}

          const ruleDecision = evaluateLegalCategory(rawLabel);
          const catInfo = CATEGORY_INFO[ruleDecision.categoryKey] || CATEGORY_INFO.unknown;
          const color = catInfo.color || '#3B82F6';

          // Draw futuristic corner brackets around bounding box
          drawGlowBoundingBox(ctx, x, y, width, height, color, `${ruleDecision.label}: ${capitalize(rawLabel)} (${Math.round(confidence * 100)}%)`);

          if (!primaryTracked || confidence > primaryTracked.confidence) {
            primaryTracked = {
              itemLabel: capitalize(rawLabel),
              category: ruleDecision.categoryKey,
              confidence: Number(confidence.toFixed(2)),
              ruleCitation: ruleDecision.ruleCitation,
              disposalRoute: ruleDecision.disposalRoute,
              storageMaxHours: ruleDecision.storageMaxHours || 48,
              bbox: pred.bbox
            };
          }
        }

        if (onTrackUpdate && primaryTracked) {
          onTrackUpdate(primaryTracked);
        }
      } catch (err) {
        console.warn('Tracking loop cycle error:', err);
      }
    }

    // Schedule next frame (~30 FPS throttle)
    animId = requestAnimationFrame(loop);
  }

  loop();

  return () => {
    isRunning = false;
    if (animId) cancelAnimationFrame(animId);
    if (canvasElement) {
      const ctx = canvasElement.getContext('2d');
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
  };
}

/**
 * Draw a clean, modern HUD bounding box with corner brackets and glowing text tag
 */
function drawGlowBoundingBox(ctx, x, y, width, height, color, labelText) {
  const cornerLength = Math.min(24, width * 0.25, height * 0.25);
  const pad = 6;
  const bx = Math.max(4, x - pad);
  const by = Math.max(4, y - pad);
  const bw = width + pad * 2;
  const bh = height + pad * 2;

  ctx.save();

  // Subtle translucent fill
  ctx.fillStyle = hexToRgba(color, 0.08);
  ctx.fillRect(bx, by, bw, bh);

  // Outer border with glow
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  // Draw 4 corner brackets
  ctx.beginPath();
  // Top-left
  ctx.moveTo(bx, by + cornerLength);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + cornerLength, by);

  // Top-right
  ctx.moveTo(bx + bw - cornerLength, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw, by + cornerLength);

  // Bottom-right
  ctx.moveTo(bx + bw, by + bh - cornerLength);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx + bw - cornerLength, by + bh);

  // Bottom-left
  ctx.moveTo(bx + cornerLength, by + bh);
  ctx.lineTo(bx, by + bh);
  ctx.lineTo(bx, by + bh - cornerLength);
  ctx.stroke();

  // Draw HUD Pill Tag above bounding box
  ctx.shadowBlur = 0;
  ctx.font = 'bold 12px Inter, sans-serif';
  const textMetrics = ctx.measureText(labelText);
  const tagWidth = textMetrics.width + 16;
  const tagHeight = 22;
  const tagY = Math.max(4, by - tagHeight - 4);

  ctx.fillStyle = color;
  roundRect(ctx, bx, tagY, tagWidth, tagHeight, 4);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.fillText(labelText, bx + 8, tagY + 15);

  ctx.restore();
}

function hexToRgba(hex, alpha) {
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
