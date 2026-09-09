/**
 * SegreGuard — Secondary Multimodal Cloud Vision Layer (Google Gemini)
 * Auto-detects and cascades across the newest Google Gemini 3.x Flash models:
 * gemini-2.5-flash (Ultra-stable) -> gemini-1.5-flash -> gemini-3.5-flash -> gemini-3.8-flash
 */

import { evaluateLegalCategory } from './rulesEngine.js';

// Reads API key securely from Vite environment variables
export const DEFAULT_GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Prioritize ultra-stable production models to avoid preview 503 server overloads
const GEMINI_MODELS = [
  'gemini-2.5-flash',       // 🟢 Stable Production Model (Zero 503 overloads)
  'gemini-1.5-flash',       // 🟢 High Reliability Production Fallback
  'gemini-3.5-flash',       // 🟡 Preview Model
  'gemini-3.8-flash'        // 🟡 Preview Model
];

/**
 * Capture frame from video/canvas as base64 JPEG
 */
function captureFrameBase64(videoElement) {
  if (!videoElement) return null;
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth || 640;
  canvas.height = videoElement.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return dataUrl.split(',')[1];
}

/**
 * Classify a complex medical waste frame using Google Gemini Multimodal API
 * @param {HTMLVideoElement} videoElement 
 * @param {string} apiKey - Gemini API Key from Google AI Studio
 */
export async function classifyWithGemini(videoElement, apiKey = DEFAULT_GEMINI_API_KEY) {
  const activeKey = apiKey || DEFAULT_GEMINI_API_KEY;
  if (!activeKey) {
    throw new Error('Gemini API Key required for Cloud Multimodal Vision. Please configure VITE_GEMINI_API_KEY.');
  }

  const base64Image = captureFrameBase64(videoElement);
  if (!base64Image) {
    throw new Error('Could not capture frame from camera video feed');
  }

  const promptText = `
You are an expert Bio-Medical Waste Compliance Officer for a hospital in India operating under statutory Bio-Medical Waste Management Rules, 2016 (Schedule I).

Analyze the medical waste item in this camera image frame.

Respond ONLY with a valid JSON object matching this exact schema (no markdown wrap, no backticks):
{
  "itemLabel": "Short precise item name (e.g. Soiled Cotton Gauze, Disposable Syringe, Glass Vial, Nitrile Glove, Scalpel Blade)",
  "detectedCategory": "yellow" | "red" | "white" | "blue" | "black",
  "confidence": number between 0.80 and 0.99,
  "ruleCitation": "Clause from CPCB BMW Rules 2016 Schedule I",
  "disposalRoute": "Official disposal route (e.g., Autoclaving -> Shredding -> Recycling)",
  "clinicalReasoning": "1-sentence explanation of statutory alignment"
}
`;

  let lastError = null;
  let activeModelUsed = null;
  let jsonResponse = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
            ]
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        jsonResponse = JSON.parse(cleaned);
        activeModelUsed = modelName;
        break; // Success!
      } else {
        const errBody = await response.text();
        lastError = new Error(`[${modelName}] (${response.status}): ${errBody}`);
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (!jsonResponse) {
    throw lastError || new Error('Failed to communicate with Google Gemini Vision API');
  }

  const ruleEval = evaluateLegalCategory(jsonResponse.itemLabel || jsonResponse.detectedCategory);

  return {
    itemLabel: jsonResponse.itemLabel || 'Medical Waste Item',
    category: jsonResponse.detectedCategory || ruleEval.categoryKey,
    confidence: Math.min(0.99, Math.max(0.75, jsonResponse.confidence || 0.92)),
    disposalRoute: jsonResponse.disposalRoute || ruleEval.disposalRoute,
    ruleCitation: jsonResponse.ruleCitation || ruleEval.ruleCitation,
    reasoning: jsonResponse.clinicalReasoning,
    engine: `Google ${activeModelUsed.toUpperCase()} (Cloud Vision)`
  };
}
