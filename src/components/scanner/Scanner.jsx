import React, { useRef, useState, useCallback, useEffect } from 'react';
import CameraView from './CameraView.jsx';
import ResultPanel from './ResultPanel.jsx';
import ManualPicker from './ManualPicker.jsx';
import { classify as classifyMock } from '../../classifiers/mockClassifier.js';
import { startLiveTracking, loadModels } from '../../classifiers/liveTracker.js';
import { classifyWithGemini, DEFAULT_GEMINI_API_KEY } from '../../classifiers/geminiClassifier.js';
import { CONFIDENCE_THRESHOLD, CATEGORY_INFO } from '../../classifiers/classifierInterface.js';
import { useRole } from '../../context/RoleContext.jsx';
import { addWasteEvent, requestPickup } from '../../lib/firestoreOps.js';
import './Scanner.css';

export default function Scanner() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const stopTrackingRef = useRef(null);

  const [scanState, setScanState] = useState('idle'); // idle | scanning | result
  const [result, setResult] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [aiMode, setAiMode] = useState('live'); // 'live' (Real-Time Bounding Box Tracking) | 'gemini' | 'mock'
  const [liveTracked, setLiveTracked] = useState(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const { role } = useRole();

  // Start / Stop Real-Time Live Bounding Box Tracking loop
  useEffect(() => {
    let active = true;

    if (aiMode === 'live' && scanState === 'idle') {
      loadModels().then(() => {
        if (!active) return;
        if (videoRef.current && canvasRef.current) {
          stopTrackingRef.current = startLiveTracking(
            videoRef.current,
            canvasRef.current,
            (trackedItem) => {
              if (active) {
                setLiveTracked(trackedItem);
                setTrackingActive(true);
              }
            }
          );
        }
      }).catch(e => console.warn('Model load warning:', e));
    } else {
      if (stopTrackingRef.current) {
        stopTrackingRef.current();
        stopTrackingRef.current = null;
      }
      setTrackingActive(false);
    }

    return () => {
      active = false;
      if (stopTrackingRef.current) {
        stopTrackingRef.current();
        stopTrackingRef.current = null;
      }
    };
  }, [aiMode, scanState]);

  // Commit scan result (from live tracked item or manual click)
  const handleCommitScan = useCallback(async (customResult = null) => {
    if (scanState === 'scanning') return;
    setScanState('scanning');

    try {
      let classification = customResult;

      if (!classification) {
        if (aiMode === 'gemini') {
          classification = await classifyWithGemini(videoRef.current, DEFAULT_GEMINI_API_KEY);
        } else if (aiMode === 'live' && liveTracked) {
          classification = liveTracked;
        } else {
          classification = await classifyMock(videoRef.current || null);
        }
      }

      setResult(classification);
      setScanState('result');

      // Auto-show picker for low confidence
      if (classification.confidence < CONFIDENCE_THRESHOLD) {
        setShowPicker(true);
      }

      // Write to Local Sync & Cloud Firestore
      const eventData = {
        itemLabel: classification.itemLabel,
        category: classification.category,
        confidence: classification.confidence,
        wasEdited: false,
        originalCategory: null,
        wardId: role.wardId || 'ward-1',
        userId: role.userId,
        ruleCitation: classification.ruleCitation || 'CPCB 2016 Schedule I',
        createdAt: new Date().toISOString()
      };

      const docId = await addWasteEvent(eventData);
      setLastSaved(docId);
    } catch (err) {
      console.error('Scan commit failed:', err);
      setScanState('idle');
    }
  }, [scanState, role, aiMode, liveTracked]);

  const handleCorrect = useCallback(() => {
    setShowPicker(true);
  }, []);

  const handleManualSelect = useCallback(async (category) => {
    if (!result) return;

    const correctedResult = {
      ...result,
      originalCategory: result.category,
      category: category,
      wasEdited: true,
      confidence: 1.0
    };

    setResult(correctedResult);
    setShowPicker(false);

    const eventData = {
      itemLabel: result.itemLabel,
      category: category,
      confidence: result.confidence,
      wasEdited: true,
      originalCategory: result.category,
      wardId: role.wardId || 'ward-1',
      userId: role.userId,
      ruleCitation: result.ruleCitation,
      createdAt: new Date().toISOString()
    };

    await addWasteEvent(eventData);
  }, [result, role]);

  const handleRequestPickup = useCallback(async () => {
    if (!result) return;
    try {
      await requestPickup(result.category, role.wardId || 'ward-1', `Emergency porter request for ${result.itemLabel}`);
      alert(`Collection Porter Dispatched for ${result.itemLabel} (${result.category.toUpperCase()} Bin)!`);
    } catch (err) {
      console.error('Pickup request failed:', err);
    }
  }, [result, role]);

  const handleNewScan = useCallback(() => {
    setScanState('idle');
    setResult(null);
    setShowPicker(false);
    setLastSaved(null);
    setLiveTracked(null);
  }, []);

  const trackedInfo = liveTracked ? (CATEGORY_INFO[liveTracked.category] || CATEGORY_INFO.unknown) : null;

  return (
    <div className="scanner">
      {/* Mode Selector Header */}
      <div className="scanner__mode-bar">
        <div className="scanner__mode-title">
          <span className="scanner__mode-dot" />
          <span>Point-of-Generation AI Vision</span>
        </div>

        <div className="scanner__mode-toggle">
          <button
            className={`scanner__mode-btn ${aiMode === 'live' ? 'scanner__mode-btn--active' : ''}`}
            onClick={() => setAiMode('live')}
            title="Real-time Bounding Box Detection Loop at 30 FPS"
          >
            🎥 Live Bounding Box Tracking
          </button>
          <button
            className={`scanner__mode-btn ${aiMode === 'gemini' ? 'scanner__mode-btn--active' : ''}`}
            onClick={() => setAiMode('gemini')}
            title="Google Gemini 2.5 Flash Cloud Vision API"
          >
            ✨ Gemini 2.5 Flash
          </button>
          <button
            className={`scanner__mode-btn ${aiMode === 'mock' ? 'scanner__mode-btn--active' : ''}`}
            onClick={() => setAiMode('mock')}
            title="Pre-calibrated CPCB demo cycle"
          >
            🎯 Demo Sequence
          </button>
        </div>
      </div>

      <div className="scanner__camera-area">
        <CameraView videoRef={videoRef} canvasRef={canvasRef} />

        {/* Live HUD Pill tracking detected item in real-time */}
        {aiMode === 'live' && scanState === 'idle' && liveTracked && (
          <div
            className="scanner__live-hud"
            style={{
              '--hud-cat-bg': trackedInfo?.bgColor,
              '--hud-cat-color': trackedInfo?.color
            }}
          >
            <span className="scanner__live-hud-dot" />
            <span className="scanner__live-hud-text">
              Target: {liveTracked.itemLabel} ({Math.round(liveTracked.confidence * 100)}%)
            </span>
            <span className="scanner__live-hud-cat">
              {trackedInfo?.badge || trackedInfo?.label}
            </span>
          </div>
        )}

        {scanState === 'scanning' && (
          <div className="scanner__analyzing">
            <div className="scanner__analyzing-ring" />
            <p>
              {aiMode === 'gemini'
                ? 'Reasoning via Google Gemini 2.5 Flash Cloud Vision…'
                : 'Logging CPCB Schedule I Classification…'}
            </p>
          </div>
        )}
      </div>

      <div className="scanner__controls">
        {scanState === 'idle' && (
          <button className="scanner__scan-btn" onClick={() => handleCommitScan()}>
            <span className="scanner__scan-btn-inner">
              <span className="scanner__scan-icon">⊙</span>
              {aiMode === 'live' && liveTracked
                ? `Confirm ${liveTracked.itemLabel} → ${trackedInfo?.label || 'Bin'}`
                : aiMode === 'live'
                ? 'Detecting Live... (Hold Waste in Camera)'
                : aiMode === 'gemini'
                ? 'Analyze with Gemini 2.5 Flash'
                : 'Scan Item (Demo Sequence)'}
            </span>
          </button>
        )}

        {scanState === 'result' && !showPicker && (
          <>
            <ResultPanel
              result={result}
              onCorrect={handleCorrect}
              onRequestPickup={handleRequestPickup}
            />
            <button className="scanner__new-scan-btn" onClick={handleNewScan}>
              Scan Next Item
            </button>
          </>
        )}

        {showPicker && (
          <ManualPicker
            onSelect={handleManualSelect}
            onCancel={() => setShowPicker(false)}
          />
        )}
      </div>
    </div>
  );
}
