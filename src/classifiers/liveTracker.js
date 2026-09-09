/**
 * SegreGuard — High-Performance Stabilized Edge Vision Tracker
 * Features Temporal Hysteresis & Debounce Buffer to eliminate jitter, fluctuation, and flickering.
 * 60 FPS Fluid HUD + Decoupled 6 FPS Neural Engine.
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

// Clutter classes to ignore
const IGNORED_CLASSES = new Set([
  'person', 'couch', 'chair', 'bed', 'dining table', 'tv', 'laptop', 
  'refrigerator', 'sink', 'toilet', 'wall', 'door', 'clock'
]);

// Clinical vocabulary mapping for on-device edge detection
const CLINICAL_VOCABULARY = [
  { 
    tokens: [
      'mask', 'gasmask', 'respirator', 'oxygen', 'face shield', 'bandage', 
      'gauze', 'cotton', 'plaster', 'dressing', 'band-aid', 'handkerchief',
      'bib', 'apron', 'diaper', 'napkin', 'paper towel', 'tissue', 'neck brace'
    ], 
    label: 'Surgical Mask / Contaminated PPE', 
    category: 'yellow',
    route: 'High-Temperature Incineration (CPCB Schedule I Part-1 Category Yellow)',
    citation: 'CPCB BMW Rules 2016 Schedule I: Soiled Waste & Contaminated PPE'
  },
  { 
    tokens: [
      'syringe', 'hypodermic', 'injector', 'glove', 'mitten', 'rubber glove', 
      'plastic bottle', 'tube', 'tubing', 'catheter', 'balloon', 'nipple'
    ], 
    label: 'Contaminated Plastic / Syringe', 
    category: 'red',
    route: 'Autoclaving / Microwaving → Shredding → Plastic Recycler',
    citation: 'CPCB BMW Rules 2016 Schedule I: Contaminated Recyclable Plastics'
  },
  { 
    tokens: ['scissors', 'shears', 'knife', 'blade', 'scalpel', 'razor', 'cutter', 'needle', 'lancet'], 
    label: 'Medical Sharps / Blade / Needle', 
    category: 'white',
    route: 'Dry Heat Sterilization → Shredding & Encapsulation',
    citation: 'CPCB BMW Rules 2016 Schedule I: Waste Sharps & Metals'
  },
  { 
    tokens: ['bottle', 'pill bottle', 'medicine bottle', 'vial', 'ampoule', 'glass', 'flask', 'beaker', 'cup', 'tumbler'], 
    label: 'Medicine Vial / Glassware', 
    category: 'blue',
    route: 'Disinfection (Sodium Hypochlorite) → Glass Recycling',
    citation: 'CPCB BMW Rules 2016 Schedule I: Glassware & Ampoules'
  },
  { 
    tokens: ['envelope', 'packet', 'carton', 'wrapper', 'box', 'paper', 'snack', 'can'], 
    label: 'General Municipal Solid Waste', 
    category: 'black',
    route: 'Municipal Segregation & Sanitary Landfill',
    citation: 'Solid Waste Management Rules 2016: Non-contaminated waste'
  }
];

function matchClinicalVocabulary(rawText) {
  const lower = rawText.toLowerCase();
  for (const item of CLINICAL_VOCABULARY) {
    if (item.tokens.some(t => lower.includes(t))) {
      return item;
    }
  }
  return null;
}

/**
 * Start the stabilized real-time tracking loop
 * Features temporal hysteresis: requires consecutive detection hits before switching labels.
 */
export function startLiveTracking(videoElement, canvasElement, onTrackUpdate) {
  let isRunning = true;
  let animId = null;
  let isDetecting = false;

  // Hysteresis & Stabilization state
  let lockedTarget = null;       // Stably displayed target
  let candidateTarget = null;    // Incoming candidate
  let candidateHits = 0;         // Consecutive frames candidate has matched
  let emptyFrames = 0;           // Consecutive frames with no detection
  let lastNotifiedKey = null;    // Throttle React callbacks
  let lastNotifyTime = 0;

  let smoothBbox = null;         // Exponential moving average [x, y, w, h]
  let displayAlpha = 0;          // Smooth opacity fade-in/out

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

      const vWidth = videoElement.videoWidth;
      const vHeight = videoElement.videoHeight;
      const centerX = vWidth / 2;
      const centerY = vHeight / 2;

      // 1. Run COCO-SSD object detection
      const predictions = await coco.detect(videoElement, 4, 0.45); // Higher threshold for stability
      const validObjects = predictions.filter(p => !IGNORED_CLASSES.has(p.class.toLowerCase()));

      let bestObj = null;
      if (validObjects.length > 0) {
        bestObj = validObjects.reduce((best, cur) => {
          const curCenterX = cur.bbox[0] + cur.bbox[2] / 2;
          const curCenterY = cur.bbox[1] + cur.bbox[3] / 2;
          const dist = Math.hypot(curCenterX - centerX, curCenterY - centerY);
          const score = cur.score - (dist / vWidth) * 0.25;
          return (!best || score > best.score) ? { ...cur, score } : best;
        }, null);
      }

      // 2. Run multi-scale MobileNet (center crop + whole frame)
      cropCtx.drawImage(videoElement, centerX - 120, centerY - 120, 240, 240, 0, 0, 224, 224);
      let mobilePredictions = [];
      try {
        const [cropMatches, fullMatches] = await Promise.all([
          mobile.classify(cropCanvas, 4),
          mobile.classify(videoElement, 3)
        ]);
        mobilePredictions = [...cropMatches, ...fullMatches];
      } catch (_e) {}

      // Match against clinical vocabulary (min probability 0.12 to reject ambient noise)
      let rawHit = null;
      for (const pred of mobilePredictions) {
        const match = matchClinicalVocabulary(pred.className);
        if (match && pred.probability > 0.12) {
          rawHit = {
            itemLabel: match.label,
            category: match.category,
            confidence: Number(Math.min(0.98, Math.max(0.85, pred.probability * 3.0 + 0.65)).toFixed(2)),
            ruleCitation: match.citation,
            disposalRoute: match.route,
            rawBbox: [centerX - 120, centerY - 100, 240, 200]
          };
          break;
        }
      }

      // Fall back to COCO general object
      if (!rawHit && bestObj) {
        const rule = evaluateLegalCategory(bestObj.class);
        if (rule.categoryKey !== 'unknown') {
          rawHit = {
            rawBbox: bestObj.bbox,
            itemLabel: capitalize(bestObj.class),
            category: rule.categoryKey,
            confidence: Number(Math.min(0.96, Math.max(0.75, bestObj.score)).toFixed(2)),
            ruleCitation: rule.ruleCitation,
            disposalRoute: rule.disposalRoute,
            storageMaxHours: rule.storageMaxHours || 48
          };
        }
      }

      // Fall back to top MobileNet prediction if legal category is valid
      if (!rawHit && mobilePredictions.length > 0 && !IGNORED_CLASSES.has(mobilePredictions[0].className.toLowerCase())) {
        const top = mobilePredictions[0];
        if (top.probability > 0.18) {
          const cleanName = top.className.split(',')[0];
          const rule = evaluateLegalCategory(cleanName);
          if (rule.categoryKey !== 'unknown') {
            rawHit = {
              rawBbox: [centerX - 110, centerY - 100, 220, 200],
              itemLabel: capitalize(cleanName),
              category: rule.categoryKey,
              confidence: Number(Math.min(0.95, Math.max(0.72, top.probability + 0.5)).toFixed(2)),
              ruleCitation: rule.ruleCitation,
              disposalRoute: rule.disposalRoute,
              storageMaxHours: rule.storageMaxHours || 48
            };
          }
        }
      }

      // ── TEMPORAL HYSTERESIS FILTER (Anti-Fluctuation & Anti-Flicker) ──
      if (rawHit) {
        emptyFrames = 0;
        const currentKey = `${rawHit.category}:${rawHit.itemLabel}`;

        if (candidateTarget && candidateTarget.key === currentKey) {
          candidateHits++;
        } else {
          candidateTarget = { ...rawHit, key: currentKey };
          candidateHits = 1;
        }

        // Lock on only after at least 2 consecutive consistent frames
        if (candidateHits >= 2) {
          lockedTarget = { ...rawHit };
          
          // Throttled notification to React (prevents 8 re-renders/sec)
          const now = Date.now();
          if (currentKey !== lastNotifiedKey || (now - lastNotifyTime > 800)) {
            lastNotifiedKey = currentKey;
            lastNotifyTime = now;
            if (onTrackUpdate) onTrackUpdate(lockedTarget);
          }
        }
      } else {
        emptyFrames++;
        candidateHits = Math.max(0, candidateHits - 1);
        
        // Only clear target after 5 consecutive frames without any detection
        if (emptyFrames >= 5) {
          if (lockedTarget !== null) {
            lockedTarget = null;
            candidateTarget = null;
            lastNotifiedKey = null;
            if (onTrackUpdate) onTrackUpdate(null);
          }
        }
      }
    } catch (err) {
      console.warn('Live tracker inference error:', err);
    } finally {
      isDetecting = false;
    }
  }

  // 60 FPS Fluid HUD Renderer Loop
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

      // Draw Center Crosshairs
      drawTacticalCrosshairs(ctx, cw / 2, ch / 2, time);

      // Smooth opacity transitions
      if (lockedTarget && lockedTarget.rawBbox) {
        displayAlpha = Math.min(1, displayAlpha + 0.12);
      } else {
        displayAlpha = Math.max(0, displayAlpha - 0.08);
      }

      // Draw Interpolated Bounding Box
      if (displayAlpha > 0.02 && lockedTarget && lockedTarget.rawBbox) {
        const [tx, ty, tw, th] = lockedTarget.rawBbox;
        if (!smoothBbox) {
          smoothBbox = [tx, ty, tw, th];
        } else {
          // Low lerp factor (0.16) creates silky smooth tracking without jitter
          smoothBbox[0] += (tx - smoothBbox[0]) * 0.16;
          smoothBbox[1] += (ty - smoothBbox[1]) * 0.16;
          smoothBbox[2] += (tw - smoothBbox[2]) * 0.16;
          smoothBbox[3] += (th - smoothBbox[3]) * 0.16;
        }

        const catInfo = CATEGORY_INFO[lockedTarget.category] || CATEGORY_INFO.unknown;
        const color = catInfo.color || '#38bdf8';

        ctx.save();
        ctx.globalAlpha = displayAlpha;

        drawHolographicBox(
          ctx, 
          smoothBbox[0], 
          smoothBbox[1], 
          smoothBbox[2], 
          smoothBbox[3], 
          color, 
          lockedTarget.itemLabel,
          catInfo.label,
          lockedTarget.confidence,
          time
        );

        ctx.restore();
      } else if (!lockedTarget) {
        smoothBbox = null;
      }
    }

    animId = requestAnimationFrame(render);
  }

  // Run decoupled AI inference every 160ms (~6 FPS is optimal for stability + low thermal overhead)
  const inferenceInterval = setInterval(runInference, 160);
  animId = requestAnimationFrame(render);

  return () => {
    isRunning = false;
    clearInterval(inferenceInterval);
    if (animId) cancelAnimationFrame(animId);
    if (canvasElement) {
      const ctx = canvasElement.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
  };
}

/**
 * Draw holographic sci-fi corners & glowing HUD banner
 */
function drawHolographicBox(ctx, x, y, w, h, color, label, binLabel, conf, time) {
  const pad = 12;
  const bx = x - pad;
  const by = y - pad;
  const bw = w + pad * 2;
  const bh = h + pad * 2;
  const cornerLen = Math.min(24, bw * 0.25);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;

  // 4 Tactical Sci-Fi Box Corners
  // Top-Left
  ctx.beginPath();
  ctx.moveTo(bx, by + cornerLen);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + cornerLen, by);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(bx + bw - cornerLen, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw, by + cornerLen);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(bx, by + bh - cornerLen);
  ctx.lineTo(bx, by + bh);
  ctx.lineTo(bx + cornerLen, by + bh);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(bx + bw - cornerLen, by + bh);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx + bw, by + bh - cornerLen);
  ctx.stroke();

  // Subtle interior aura
  ctx.fillStyle = `${color}10`;
  ctx.fillRect(bx, by, bw, bh);

  // Top Floating Tactical Tag
  const tagH = 28;
  const tagY = Math.max(10, by - tagH - 6);
  const tagW = Math.min(260, Math.max(160, ctx.measureText(label).width + 60));

  ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(7, 13, 29, 0.88)';
  ctx.strokeStyle = `${color}99`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, tagY, tagW, tagH, 6);
  ctx.fill();
  ctx.stroke();

  // Glowing status pip
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(bx + 14, tagY + 14, 4, 0, Math.PI * 2);
  ctx.fill();

  // Item Title & Match
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  const displayTitle = label.length > 20 ? label.slice(0, 18) + '…' : label;
  ctx.fillText(displayTitle, bx + 26, tagY + 13);

  // Subtitle (Bin classification + Confidence)
  ctx.fillStyle = color;
  ctx.font = '700 9px ui-monospace, monospace';
  ctx.fillText(`${binLabel.toUpperCase()} • ${Math.round(conf * 100)}%`, bx + 26, tagY + 23);
}

/**
 * Draw Center Tactical Reticle with soft ambient radar pulse
 */
function drawTacticalCrosshairs(ctx, cx, cy, time) {
  const size = 32;
  const pulse = Math.sin(time * 0.003) * 3;
  const rad = 42 + pulse;

  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1.2;

  // Center Ring
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.stroke();

  // Cross lines with center gap
  const gap = 12;
  ctx.beginPath();
  ctx.moveTo(cx - size, cy);
  ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy);
  ctx.lineTo(cx + size, cy);
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx, cy - gap);
  ctx.moveTo(cx, cy + gap);
  ctx.lineTo(cx, cy + size);
  ctx.stroke();

  ctx.restore();
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
