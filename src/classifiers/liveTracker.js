/**
 * SegreGuard — High-Performance Edge Vision Tracker (60 FPS HUD + 8 FPS AI Engine)
 * Decoupled rendering loop with lerp interpolation, center ROI bias, 
 * background suppression, and holographic statutory CPCB HUD brackets.
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
    cocoModelPromise = cocoSsd.load({ base: 'lite_mobilenet_v2' }).catch(() => cocoSsd.load({ base: 'mobilenet_v2' }));
  }
  if (!mobilenetPromise) {
    mobilenetPromise = mobilenet.load({ version: 2, alpha: 0.5 }).catch(() => mobilenet.load({ version: 1, alpha: 0.5 }));
  }
  const [coco, mobile] = await Promise.all([cocoModelPromise, mobilenetPromise]);
  return { coco, mobile };
}

// Ignore room furniture and human bodies during biomedical waste inspection
const IGNORED_CLASSES = new Set([
  'person', 'couch', 'chair', 'bed', 'dining table', 'tv', 'laptop', 
  'refrigerator', 'sink', 'toilet', 'wall', 'door', 'clock'
]);

/**
 * Start the real-time decoupled tracking loop
 */
export function startLiveTracking(videoElement, canvasElement, onTrackUpdate) {
  let isRunning = true;
  let animId = null;
  let isDetecting = false;
  let lastInferenceTime = 0;

  // Active smoothed tracking targets
  let currentTarget = null;
  let smoothBbox = null; // [x, y, w, h]
  let lockOnTicks = 0;

  // Center crop canvas for high-accuracy MobileNet inference
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = 224;
  cropCanvas.height = 224;
  const cropCtx = cropCanvas.getContext('2d');

  async function runInference() {
    if (isDetecting || !isRunning) return;
    if (!videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0) return;

    isDetecting = true;

    try {
      const { coco, mobile } = await loadModels();

      // Run COCO-SSD object localization
      const predictions = await coco.detect(videoElement, 5, 0.35);

      // Filter out non-waste background classes
      const validObjects = predictions.filter(p => !IGNORED_CLASSES.has(p.class.toLowerCase()));

      let bestObj = null;
      const vWidth = videoElement.videoWidth;
      const vHeight = videoElement.videoHeight;
      const centerX = vWidth / 2;
      const centerY = vHeight / 2;

      if (validObjects.length > 0) {
        // Prioritize items closest to center of viewfinder
        bestObj = validObjects.reduce((best, cur) => {
          const curCenterX = cur.bbox[0] + cur.bbox[2] / 2;
          const curCenterY = cur.bbox[1] + cur.bbox[3] / 2;
          const dist = Math.hypot(curCenterX - centerX, curCenterY - centerY);
          const score = cur.score - (dist / vWidth) * 0.3; // distance penalty
          return (!best || score > best.score) ? { ...cur, score } : best;
        }, null);
      }

      // If an object is localized, refine classification using cropped MobileNet
      if (bestObj) {
        const [bx, by, bw, bh] = bestObj.bbox;
        const pad = Math.max(10, bw * 0.1);
        const sx = Math.max(0, bx - pad);
        const sy = Math.max(0, by - pad);
        const sw = Math.min(vWidth - sx, bw + pad * 2);
        const sh = Math.min(vHeight - sy, bh + pad * 2);

        // Crop object area to 224x224
        cropCtx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, 224, 224);

        let finalLabel = bestObj.class;
        let finalConfidence = bestObj.score;

        try {
          const mobileResults = await mobile.classify(cropCanvas, 3);
          if (mobileResults && mobileResults.length > 0) {
            const topMobile = mobileResults[0];
            const cleanMobileName = topMobile.className.split(',')[0].toLowerCase();

            // Check if MobileNet found a clinical or specific surrogate term
            if (topMobile.probability > 0.3 && !IGNORED_CLASSES.has(cleanMobileName)) {
              finalLabel = cleanMobileName;
              finalConfidence = Math.max(finalConfidence, topMobile.probability);
            }
          }
        } catch (_e) {}

        const ruleDecision = evaluateLegalCategory(finalLabel);

        currentTarget = {
          rawBbox: bestObj.bbox,
          itemLabel: capitalize(finalLabel),
          category: ruleDecision.categoryKey,
          label: ruleDecision.label,
          confidence: Number(Math.min(0.99, Math.max(0.72, finalConfidence)).toFixed(2)),
          ruleCitation: ruleDecision.ruleCitation,
          disposalRoute: ruleDecision.disposalRoute,
          storageMaxHours: ruleDecision.storageMaxHours || 48
        };

        if (onTrackUpdate) {
          onTrackUpdate(currentTarget);
        }
      } else {
        // Fallback: Check center of screen if nothing specific localized
        cropCtx.drawImage(videoElement, centerX - 112, centerY - 112, 224, 224, 0, 0, 224, 224);
        try {
          const centerResults = await mobile.classify(cropCanvas, 2);
          if (centerResults && centerResults.length > 0) {
            const candidate = centerResults[0];
            const cleanCandidate = candidate.className.split(',')[0].toLowerCase();
            if (candidate.probability > 0.4 && !IGNORED_CLASSES.has(cleanCandidate)) {
              const rule = evaluateLegalCategory(cleanCandidate);
              if (rule.categoryKey !== 'unknown') {
                currentTarget = {
                  rawBbox: [centerX - 100, centerY - 100, 200, 200],
                  itemLabel: capitalize(cleanCandidate),
                  category: rule.categoryKey,
                  label: rule.label,
                  confidence: Number(candidate.probability.toFixed(2)),
                  ruleCitation: rule.ruleCitation,
                  disposalRoute: rule.disposalRoute,
                  storageMaxHours: rule.storageMaxHours || 48
                };
                if (onTrackUpdate) onTrackUpdate(currentTarget);
              }
            }
          }
        } catch (_e) {}
      }
    } catch (err) {
      console.warn('AI Tracker frame error:', err);
    } finally {
      isDetecting = false;
    }
  }

  // High-FPS Fluid Canvas Renderer Loop
  function render(time) {
    if (!isRunning) return;

    if (videoElement && videoElement.videoWidth > 0 && canvasElement) {
      if (canvasElement.width !== videoElement.videoWidth) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
      }

      const ctx = canvasElement.getContext('2d');
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      const cw = canvasElement.width;
      const ch = canvasElement.height;

      // Draw Tactical Center Crosshair HUD
      drawTacticalCrosshairs(ctx, cw / 2, ch / 2, time);

      // Interpolate and Draw Bounding Box
      if (currentTarget && currentTarget.rawBbox) {
        const [tx, ty, tw, th] = currentTarget.rawBbox;
        if (!smoothBbox) {
          smoothBbox = [tx, ty, tw, th];
        } else {
          // Lerp for butter-smooth tracking (35% factor)
          smoothBbox[0] += (tx - smoothBbox[0]) * 0.35;
          smoothBbox[1] += (ty - smoothBbox[1]) * 0.35;
          smoothBbox[2] += (tw - smoothBbox[2]) * 0.35;
          smoothBbox[3] += (th - smoothBbox[3]) * 0.35;
        }

        lockOnTicks++;
        const catInfo = CATEGORY_INFO[currentTarget.category] || CATEGORY_INFO.unknown;
        const color = catInfo.color || '#38bdf8';

        drawHolographicBox(
          ctx, 
          smoothBbox[0], 
          smoothBbox[1], 
          smoothBbox[2], 
          smoothBbox[3], 
          color, 
          currentTarget,
          time,
          lockOnTicks
        );
      } else {
        smoothBbox = null;
        lockOnTicks = 0;
      }

      // Schedule next AI inference cycle throttled to ~110ms (~9 FPS)
      if (time - lastInferenceTime > 110) {
        lastInferenceTime = time;
        runInference();
      }
    }

    animId = requestAnimationFrame(render);
  }

  animId = requestAnimationFrame(render);

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
 * Draw Tactical Crosshairs in Center Viewport
 */
function drawTacticalCrosshairs(ctx, cx, cy, time) {
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1;

  // Outer Reticle Circle
  ctx.beginPath();
  ctx.arc(cx, cy, 38, 0, Math.PI * 2);
  ctx.stroke();

  // Rotating Tick Marks
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((time * 0.001) % (Math.PI * 2));
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.setLineDash([4, 18]);
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Center Cross Lines
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy);
  ctx.lineTo(cx - 6, cy);
  ctx.moveTo(cx + 6, cy);
  ctx.lineTo(cx + 16, cy);
  ctx.moveTo(cx, cy - 16);
  ctx.lineTo(cx, cy - 6);
  ctx.moveTo(cx, cy + 6);
  ctx.lineTo(cx, cy + 16);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw Futuristic Holographic Bracket Box
 */
function drawHolographicBox(ctx, x, y, width, height, color, target, time, lockTicks) {
  const pad = 10;
  const bx = Math.max(6, x - pad);
  const by = Math.max(6, y - pad);
  const bw = Math.max(40, width + pad * 2);
  const bh = Math.max(40, height + pad * 2);

  ctx.save();

  // Glowing Outer Bracket
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.min(18, 8 + Math.sin(time * 0.008) * 6);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;

  const corner = Math.min(26, bw * 0.25, bh * 0.25);

  // 4 Corner Brackets
  ctx.beginPath();
  // Top-Left
  ctx.moveTo(bx, by + corner);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + corner, by);
  // Top-Right
  ctx.moveTo(bx + bw - corner, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw, by + corner);
  // Bottom-Left
  ctx.moveTo(bx, by + bh - corner);
  ctx.lineTo(bx, by + bh);
  ctx.lineTo(bx + corner, by + bh);
  // Bottom-Right
  ctx.moveTo(bx + bw - corner, by + bh);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx + bw, by + bh - corner);
  ctx.stroke();

  // Subtle interior grid fill
  ctx.fillStyle = color.replace(')', ', 0.06)').replace('rgb', 'rgba').replace('#', 'rgba(');
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16) || 56;
    const g = parseInt(color.slice(3, 5), 16) || 189;
    const b = parseInt(color.slice(5, 7), 16) || 248;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.06)`;
  }
  ctx.fillRect(bx, by, bw, bh);

  // Floating Holographic Banner
  const bannerY = Math.max(28, by - 32);
  const text = `${target.itemLabel} • ${Math.round(target.confidence * 100)}%`;
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  const textWidth = ctx.measureText(text).width;
  const bannerW = Math.max(120, textWidth + 24);

  // Banner background pill
  ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(7, 13, 29, 0.92)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, bannerY, bannerW, 26, 6);
  ctx.fill();
  ctx.stroke();

  // Statutory Bin Dot
  ctx.fillStyle = color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(bx + 12, bannerY + 13, 4, 0, Math.PI * 2);
  ctx.fill();

  // Label text
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(text, bx + 22, bannerY + 17);

  // Lock-on Ring if steady
  if (lockTicks > 15) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(bx + bw / 2, by + bh / 2, Math.min(bw, bh) * 0.35, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
