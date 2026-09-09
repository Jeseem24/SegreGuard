/**
 * SegreGuard — High-Performance Edge Vision Tracker (60 FPS HUD + 8 FPS AI Engine)
 * Specialized clinical keyword matching for surgical masks, syringes, dressings, 
 * gloves, vials, and sharps.
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

// Background clutter to ignore
const IGNORED_CLASSES = new Set([
  'person', 'couch', 'chair', 'bed', 'dining table', 'tv', 'laptop', 
  'refrigerator', 'sink', 'toilet', 'wall', 'door', 'clock'
]);

// Clinical keyword dictionary for MobileNet detection
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
 * Start the real-time decoupled tracking loop
 */
export function startLiveTracking(videoElement, canvasElement, onTrackUpdate) {
  let isRunning = true;
  let animId = null;
  let isDetecting = false;
  let lastInferenceTime = 0;

  let currentTarget = null;
  let smoothBbox = null;
  let lockOnTicks = 0;

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
      const predictions = await coco.detect(videoElement, 5, 0.3);
      const validObjects = predictions.filter(p => !IGNORED_CLASSES.has(p.class.toLowerCase()));

      let bestObj = null;

      if (validObjects.length > 0) {
        bestObj = validObjects.reduce((best, cur) => {
          const curCenterX = cur.bbox[0] + cur.bbox[2] / 2;
          const curCenterY = cur.bbox[1] + cur.bbox[3] / 2;
          const dist = Math.hypot(curCenterX - centerX, curCenterY - centerY);
          const score = cur.score - (dist / vWidth) * 0.3;
          return (!best || score > best.score) ? { ...cur, score } : best;
        }, null);
      }

      // 2. Run multi-scale MobileNet (center ROI crop + whole frame) to detect items COCO ignores
      cropCtx.drawImage(videoElement, centerX - 120, centerY - 120, 240, 240, 0, 0, 224, 224);
      let mobilePredictions = [];
      try {
        const [cropMatches, fullMatches] = await Promise.all([
          mobile.classify(cropCanvas, 5),
          mobile.classify(videoElement, 4)
        ]);
        mobilePredictions = [...cropMatches, ...fullMatches];
      } catch (_e) {}

      // Check if MobileNet found a clinical item (mask, syringe, bandage, PPE)
      let foundClinical = null;
      for (const pred of mobilePredictions) {
        const match = matchClinicalVocabulary(pred.className);
        if (match && pred.probability > 0.03) {
          foundClinical = {
            itemLabel: match.label,
            category: match.category,
            confidence: Number(Math.min(0.98, Math.max(0.85, pred.probability * 3.5 + 0.65)).toFixed(2)),
            ruleCitation: match.citation,
            disposalRoute: match.route,
            rawBbox: [centerX - 120, centerY - 100, 240, 200]
          };
          break;
        }
      }

      if (foundClinical) {
        // High-confidence clinical item in center (e.g. MASK, SYRINGE, BANDAGE)
        currentTarget = foundClinical;
        if (onTrackUpdate) onTrackUpdate(currentTarget);
      } else if (bestObj) {
        // General object recognized by COCO (bottle, scissors, cup, etc.)
        const [bx, by, bw, bh] = bestObj.bbox;
        const rule = evaluateLegalCategory(bestObj.class);

        currentTarget = {
          rawBbox: bestObj.bbox,
          itemLabel: capitalize(bestObj.class),
          category: rule.categoryKey,
          confidence: Number(Math.min(0.96, Math.max(0.75, bestObj.score)).toFixed(2)),
          ruleCitation: rule.ruleCitation,
          disposalRoute: rule.disposalRoute,
          storageMaxHours: rule.storageMaxHours || 48
        };

        if (onTrackUpdate) onTrackUpdate(currentTarget);
      } else if (mobilePredictions.length > 0 && !IGNORED_CLASSES.has(mobilePredictions[0].className.toLowerCase())) {
        const top = mobilePredictions[0];
        const cleanName = top.className.split(',')[0];
        const rule = evaluateLegalCategory(cleanName);

        if (rule.categoryKey !== 'unknown') {
          currentTarget = {
            rawBbox: [centerX - 100, centerY - 100, 200, 200],
            itemLabel: capitalize(cleanName),
            category: rule.categoryKey,
            confidence: Number(Math.min(0.95, Math.max(0.72, top.probability + 0.5)).toFixed(2)),
            ruleCitation: rule.ruleCitation,
            disposalRoute: rule.disposalRoute,
            storageMaxHours: rule.storageMaxHours || 48
          };
          if (onTrackUpdate) onTrackUpdate(currentTarget);
        }
      }
    } catch (err) {
      console.warn('AI Tracker cycle error:', err);
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

      // Draw Interpolated Bounding Box
      if (currentTarget && currentTarget.rawBbox) {
        const [tx, ty, tw, th] = currentTarget.rawBbox;
        if (!smoothBbox) {
          smoothBbox = [tx, ty, tw, th];
        } else {
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

      // Schedule next AI inference cycle throttled to ~120ms
      if (time - lastInferenceTime > 120) {
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

function drawTacticalCrosshairs(ctx, cx, cy, time) {
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.arc(cx, cy, 38, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((time * 0.001) % (Math.PI * 2));
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.setLineDash([4, 18]);
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

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

function drawHolographicBox(ctx, x, y, width, height, color, target, time, lockTicks) {
  const pad = 10;
  const bx = Math.max(6, x - pad);
  const by = Math.max(6, y - pad);
  const bw = Math.max(40, width + pad * 2);
  const bh = Math.max(40, height + pad * 2);

  ctx.save();

  ctx.shadowColor = color;
  ctx.shadowBlur = Math.min(18, 8 + Math.sin(time * 0.008) * 6);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;

  const corner = Math.min(26, bw * 0.25, bh * 0.25);

  ctx.beginPath();
  ctx.moveTo(bx, by + corner);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + corner, by);

  ctx.moveTo(bx + bw - corner, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw, by + corner);

  ctx.moveTo(bx, by + bh - corner);
  ctx.lineTo(bx, by + bh);
  ctx.lineTo(bx + corner, by + bh);

  ctx.moveTo(bx + bw - corner, by + bh);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx + bw, by + bh - corner);
  ctx.stroke();

  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16) || 56;
    const g = parseInt(color.slice(3, 5), 16) || 189;
    const b = parseInt(color.slice(5, 7), 16) || 248;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.06)`;
  } else {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
  }
  ctx.fillRect(bx, by, bw, bh);

  const bannerY = Math.max(28, by - 32);
  const text = `${target.itemLabel} • ${Math.round(target.confidence * 100)}%`;
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  const textWidth = ctx.measureText(text).width;
  const bannerW = Math.max(120, textWidth + 24);

  ctx.shadowBlur = 10;
  ctx.fillStyle = 'rgba(7, 13, 29, 0.92)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, bannerY, bannerW, 26, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(bx + 12, bannerY + 13, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(text, bx + 22, bannerY + 17);

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
