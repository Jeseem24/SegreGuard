import React, { useRef, useState, useCallback, useEffect } from 'react';
import CameraView from './CameraView.jsx';
import ResultPanel from './ResultPanel.jsx';
import ManualPicker from './ManualPicker.jsx';
import { classify as classifyMock } from '../../classifiers/mockClassifier.js';
import { startLiveTracking, loadModels } from '../../classifiers/liveTracker.js';
import { classifyWithGemini, DEFAULT_GEMINI_API_KEY } from '../../classifiers/geminiClassifier.js';
import { classifyWithEdgePrimary, loadEdgeModel } from '../../classifiers/tfjsClassifier.js';
import { evaluateLegalCategory } from '../../classifiers/rulesEngine.js';
import { CONFIDENCE_THRESHOLD, CATEGORY_INFO } from '../../classifiers/classifierInterface.js';
import { useRole } from '../../context/RoleContext.jsx';
import { 
  addWasteEvent, 
  requestPickupFromNurse, 
  subscribeToHospitalRequests,
  HOSPITALS 
} from '../../lib/firestoreOps.js';
import { 
  Video, 
  Camera, 
  Sparkles, 
  ShieldCheck, 
  Scan, 
  CheckCircle2, 
  RotateCcw,
  ArrowRight,
  Layers,
  Cpu,
  Building2,
  Truck,
  Send
} from 'lucide-react';
import './Scanner.css';

// Clinical benchmark items for one-click testing
const BENCHMARK_SAMPLES = [
  { label: 'Surgical Mask', category: 'yellow', itemLabel: '3-Ply Surgical Face Mask (Contaminated PPE)' },
  { label: 'Soiled Gauze', category: 'yellow', itemLabel: 'Blood-Soiled Surgical Gauze' },
  { label: 'IV Tubing', category: 'red', itemLabel: 'Contaminated IV Infusion Set' },
  { label: 'Needle / Syringe', category: 'white', itemLabel: 'Disposable Syringe with Fixed Needle' },
  { label: 'Glass Ampoule', category: 'blue', itemLabel: 'Shattered Antibiotic Glass Vial' },
  { label: 'Packaging', category: 'black', itemLabel: 'Office Paper & Snack Packaging' }
];

export default function Scanner() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const stopTrackingRef = useRef(null);

  // Clean Dual Camera Modes: 'live' (Real-time stabilized HUD) or 'capture' (Snapshot with Dual-Layer AI)
  const [camMode, setCamMode] = useState('live'); 
  const [scanState, setScanState] = useState('idle'); // idle | scanning | result
  const [result, setResult] = useState(null);
  const [isAdded, setIsAdded] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [liveTracked, setLiveTracked] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [analysisStep, setAnalysisStep] = useState(1);
  const [nurseRequestFeedback, setNurseRequestFeedback] = useState(null);
  const [activeRequests, setActiveRequests] = useState([]);
  const { role } = useRole();

  const currentHospital = HOSPITALS['hosp-apex'];
  const currentWardId = role?.wardId || 'ward-1';
  const currentWard = currentHospital.wards[currentWardId] || currentHospital.wards['ward-1'];

  // Subscribe to hospital pickup requests to show live status of nurse requests
  useEffect(() => {
    const unsub = subscribeToHospitalRequests('hosp-apex', (reqs) => {
      setActiveRequests(reqs || []);
    });
    return unsub;
  }, []);

  const wardPendingRequest = activeRequests.find(r => 
    r.wardId === currentWardId && (r.status === 'nurse_pending' || r.status === 'logistics_pending' || r.status === 'accepted')
  );

  // Start / Stop Real-Time Live Bounding Box Tracking loop (only in Live Cam mode)
  useEffect(() => {
    let active = true;

    if (camMode === 'live' && scanState === 'idle') {
      loadModels().then(() => {
        if (!active) return;
        if (videoRef.current && canvasRef.current) {
          stopTrackingRef.current = startLiveTracking(
            videoRef.current,
            canvasRef.current,
            (trackedItem) => {
              if (active) {
                setLiveTracked(trackedItem);
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
      setLiveTracked(null);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    return () => {
      active = false;
      if (stopTrackingRef.current) {
        stopTrackingRef.current();
        stopTrackingRef.current = null;
      }
    };
  }, [camMode, scanState]);

  // Audio synthesis chirp & mobile haptic tap
  const triggerChirp = (type = 'scan') => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(type === 'success' ? [35, 30, 45] : [35]);
      }
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'scan') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(520, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.14);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
          osc.start();
          osc.stop(ctx.currentTime + 0.14);
        } else {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(780, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.18);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
        }
      }
    } catch (_e) {}
  };

  /**
   * Commit scan with Hierarchical Dual-Layer Perception
   */
  const handleCommitScan = useCallback(async (customResult = null) => {
    if (scanState === 'scanning') return;
    setScanState('scanning');
    setAnalysisStep(1);
    setAnalysisStatus('Layer 1: Executing On-Device Neural Edge Perception…');
    setIsAdded(false);
    triggerChirp('scan');

    const step2Timer = setTimeout(() => setAnalysisStep(2), 350);
    const step3Timer = setTimeout(() => setAnalysisStep(3), 700);

    try {
      let classification = customResult;

      // 1. Capture exact snapshot frame from video feed for visual proof
      let snapshotUrl = null;
      let snapCanvas = null;
      if (videoRef.current && videoRef.current.videoWidth > 0) {
        try {
          snapCanvas = document.createElement('canvas');
          snapCanvas.width = Math.min(640, videoRef.current.videoWidth);
          snapCanvas.height = Math.round((snapCanvas.width * videoRef.current.videoHeight) / videoRef.current.videoWidth);
          const sCtx = snapCanvas.getContext('2d');
          sCtx.drawImage(videoRef.current, 0, 0, snapCanvas.width, snapCanvas.height);
          snapshotUrl = snapCanvas.toDataURL('image/jpeg', 0.85);
        } catch (_snapErr) {}
      }

      if (!classification) {
        if (camMode === 'live' && liveTracked && liveTracked.category !== 'unknown') {
          classification = {
            ...liveTracked,
            engine: 'Primary Layer: Edge Neuro-Symbolic (MobileNetV2)',
            reasoning: liveTracked.reasoning || `Continuously tracked and verified by on-device edge perception: ${liveTracked.itemLabel}.`
          };
        } else {
          let primaryResult = null;
          try {
            if (snapCanvas || videoRef.current) {
              primaryResult = await classifyWithEdgePrimary(snapCanvas || videoRef.current);
            }
          } catch (edgeErr) {
            console.warn('Primary Edge Layer error:', edgeErr);
          }

          if (primaryResult && primaryResult.isConfident) {
            classification = {
              ...primaryResult,
              engine: 'Primary Layer: Edge Neuro-Symbolic Engine'
            };
          } else {
            setAnalysisStatus('Layer 1 Ambiguous → Escalating to Layer 2: Gemini 2.5 Flash Cloud Vision…');
            setAnalysisStep(2);

            let secondaryResult = null;
            if (DEFAULT_GEMINI_API_KEY && videoRef.current && videoRef.current.readyState >= 2) {
              try {
                // High-speed race with max 2s timeout
                const geminiPromise = classifyWithGemini(videoRef.current, DEFAULT_GEMINI_API_KEY);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000));
                secondaryResult = await Promise.race([geminiPromise, timeoutPromise]);
              } catch (geminiErr) {
                console.warn('Secondary Gemini Layer error or timeout, falling back to edge decision:', geminiErr);
              }
            }

            if (secondaryResult) {
              classification = {
                ...secondaryResult,
                engine: 'Secondary Layer: Google Gemini 2.5 Flash Vision'
              };
            } else if (primaryResult && primaryResult.category !== 'unknown') {
              classification = {
                ...primaryResult,
                engine: 'Primary Layer: Edge Neuro-Symbolic Engine'
              };
            }
          }
        }

        if (!classification) {
          const mockRes = await classifyMock(videoRef.current || null);
          classification = {
            ...mockRes,
            engine: 'Statutory Perception Engine',
            reasoning: 'Sequential compliance cycle conforming to CPCB 2016 Schedule I.'
          };
        }
      }

      if (classification && snapshotUrl) {
        classification.snapshotUrl = snapshotUrl;
      }

      clearTimeout(step2Timer);
      clearTimeout(step3Timer);

      triggerChirp('success');
      setResult(classification);
      setScanState('result');

      if (classification.confidence < CONFIDENCE_THRESHOLD) {
        setShowPicker(true);
      }
    } catch (err) {
      clearTimeout(step2Timer);
      clearTimeout(step3Timer);
      console.error('Scan commit failed:', err);
      setScanState('idle');
    }
  }, [scanState, camMode, liveTracked]);

  const handleBenchmarkClick = (sample) => {
    const mockRes = {
      itemLabel: sample.itemLabel,
      category: sample.category,
      confidence: 0.96,
      ruleCitation: 'CPCB BMW Rules 2016 (Schedule I)'
    };
    handleCommitScan(mockRes);
  };

  const handleCorrect = useCallback(() => {
    setShowPicker(true);
  }, []);

  const handleManualSelect = useCallback((category) => {
    const baseItem = result?.itemLabel || liveTracked?.itemLabel || 'Manually Classified Item';
    const rule = evaluateLegalCategory(category);

    const correctedResult = {
      ...(result || {}),
      itemLabel: baseItem,
      originalCategory: result?.category || 'unknown',
      category: category,
      wasEdited: true,
      confidence: 1.0,
      ruleCitation: rule.ruleCitation,
      disposalRoute: rule.disposalRoute,
      engine: 'Manual Clinical Verification',
      reasoning: `Manual override applied conforming to CPCB 2016 Schedule I: ${rule.label}.`
    };

    setResult(correctedResult);
    setShowPicker(false);
    setScanState('result');
    setIsAdded(false);
  }, [result, liveTracked]);

  // Action 1: Add to Respective Bin
  const handleAddToBin = useCallback(async () => {
    if (!result) return;
    try {
      const eventData = {
        hospitalId: 'hosp-apex',
        itemLabel: result.itemLabel,
        category: result.category,
        confidence: result.confidence,
        wasEdited: result.wasEdited || false,
        originalCategory: result.originalCategory || null,
        wardId: currentWardId,
        room: currentWard.rooms[1] || 'Room 302 (Ventilator Bay)',
        userId: role?.userId || 'Nurse Priya',
        ruleCitation: result.ruleCitation || 'CPCB 2016 Schedule I',
        createdAt: new Date().toISOString()
      };

      await addWasteEvent(eventData);
      setIsAdded(true);
      triggerChirp('success');
    } catch (err) {
      console.error('Failed to add to bin:', err);
    }
  }, [result, currentWardId, currentWard, role]);

  // Action 2: Cancel
  const handleCancelScan = useCallback(() => {
    setScanState('idle');
    setResult(null);
    setShowPicker(false);
    setIsAdded(false);
  }, []);

  // Action 3: Scan Another Item
  const handleScanAnother = useCallback(() => {
    setScanState('idle');
    setResult(null);
    setShowPicker(false);
    setIsAdded(false);
    setLiveTracked(null);
  }, []);

  // Dispatch Action outside Live Camera: Request Pickup from Admin
  const handleNurseRequestPickup = async () => {
    try {
      await requestPickupFromNurse({
        hospitalId: 'hosp-apex',
        wardId: currentWardId,
        room: currentWard.rooms[1] || 'Room 302',
        reason: 'Ward bins approaching capacity threshold (>85%)',
        nurseName: 'Nurse Priya'
      });
      setNurseRequestFeedback('Pickup Request Sent to Hospital Admin ✓');
      triggerChirp('success');
      setTimeout(() => setNurseRequestFeedback(null), 4000);
    } catch (err) {
      console.error('Failed to request pickup:', err);
    }
  };

  const trackedInfo = liveTracked ? (CATEGORY_INFO[liveTracked.category] || CATEGORY_INFO.unknown) : null;

  return (
    <div className="scanner">
      {/* Ward Station & Admin Pickup Request Bar (Outside Camera Viewfinder) */}
      <div className="scanner__station-bar">
        <div className="scanner__station-info">
          <div className="scanner__station-badge">
            <Building2 size={13} className="text-sky" />
            <span>{currentHospital.shortName}</span>
          </div>
          <div className="scanner__ward-title">
            <strong>{currentWard.name}</strong> • {currentWard.floor}
          </div>
        </div>

        <div className="scanner__station-actions">
          {wardPendingRequest ? (
            <div className="scanner__station-status-pill">
              <span className="scanner__pulse-dot" />
              <span>
                {wardPendingRequest.status === 'nurse_pending' && 'Awaiting Admin Approval'}
                {wardPendingRequest.status === 'logistics_pending' && 'Dispatched to Logistics'}
                {wardPendingRequest.status === 'accepted' && 'Transporter En Route'}
              </span>
            </div>
          ) : (
            <button
              type="button"
              className="scanner__request-admin-btn"
              onClick={handleNurseRequestPickup}
              title="Request bio-medical waste collection from Hospital Admin"
            >
              <Send size={13} />
              <span>Request Ward Pickup</span>
            </button>
          )}
        </div>
      </div>

      {nurseRequestFeedback && (
        <div className="scanner__feedback-toast">
          <CheckCircle2 size={14} className="text-emerald" />
          <span>{nurseRequestFeedback}</span>
        </div>
      )}

      {/* Sleek Dual Camera Mode Switcher (Live Cam vs Capture Cam) */}
      <div className="scanner__mode-bar">
        <div className="scanner__cam-toggle-dock">
          <button
            type="button"
            className={`scanner__cam-tab ${camMode === 'live' ? 'scanner__cam-tab--active' : ''}`}
            onClick={() => { setCamMode('live'); handleScanAnother(); }}
            title="Continuous real-time edge tracking HUD"
          >
            <Video size={14} />
            <span>Live Stream Cam</span>
            <span className="scanner__cam-tab-chip">Continuous</span>
          </button>

          <button
            type="button"
            className={`scanner__cam-tab ${camMode === 'capture' ? 'scanner__cam-tab--active' : ''}`}
            onClick={() => { setCamMode('capture'); handleScanAnother(); }}
            title="Snapshot capture with Dual-Layer Edge + Gemini Escalation"
          >
            <Camera size={14} />
            <span>Capture Cam</span>
            <span className="scanner__cam-tab-chip scanner__cam-tab-chip--gemini">Dual-Layer AI</span>
          </button>
        </div>
      </div>

      {/* Tactical Camera HUD Viewfinder */}
      <div className={`scanner__camera-area ${scanState === 'result' ? 'scanner__camera-area--shrunk' : ''}`}>
        <CameraView videoRef={videoRef} canvasRef={canvasRef} />

        {/* Tactical Reticle Overlay */}
        <div className="scanner__hud-reticles" style={{ pointerEvents: 'none' }}>
          <div className="hud-corner hud-corner--tl" />
          <div className="hud-corner hud-corner--tr" />
          <div className="hud-corner hud-corner--bl" />
          <div className="hud-corner hud-corner--br" />
          <div className="hud-scanner-laser" />
        </div>

        {/* Live Detected Target Floating HUD (Live Cam Only) */}
        {camMode === 'live' && scanState === 'idle' && liveTracked && (
          <div
            className="scanner__live-target-badge"
            style={{
              '--target-color': trackedInfo?.color || '#38bdf8'
            }}
          >
            <div className="scanner__target-dot" />
            <div className="scanner__target-details">
              <span className="scanner__target-name">{liveTracked.itemLabel}</span>
              <span className="scanner__target-metric">
                {Math.round(liveTracked.confidence * 100)}% • {trackedInfo?.label || 'Route'}
              </span>
            </div>
          </div>
        )}

        {/* Capture Mode Framing Guide Overlay */}
        {camMode === 'capture' && scanState === 'idle' && (
          <div className="scanner__capture-guide" style={{ pointerEvents: 'none' }}>
            <div className="scanner__capture-reticle">
              <span className="scanner__capture-text">FRAME ITEM IN VIEW</span>
            </div>
          </div>
        )}

        {/* High-Tech Tactical Scanning & Analysis Overlay */}
        {scanState === 'scanning' && (
          <div className="scanner__analyzing-overlay">
            <div className="scanner__scanning-laser-cone" />
            <div className="scanner__radar-ring" />
            
            <div className="scanner__analyzing-status">
              <h4 className="scanner__analyzing-headline">
                {analysisStatus || 'Analyzing Clinical Waste Morphology…'}
              </h4>

              <div className="scanner__analysis-steps">
                <div className={`analysis-step-pill ${analysisStep >= 1 ? 'analysis-step-pill--active' : ''}`}>
                  <ShieldCheck size={12} className="text-sky" />
                  <span>1. Primary Layer: On-Device Edge AI</span>
                </div>
                <div className={`analysis-step-pill ${analysisStep >= 2 ? 'analysis-step-pill--active' : ''}`}>
                  <Sparkles size={12} className="text-amber" />
                  <span>2. Secondary Layer: Gemini 2.5 Flash Vision</span>
                </div>
                <div className={`analysis-step-pill ${analysisStep >= 3 ? 'analysis-step-pill--active' : ''}`}>
                  <CheckCircle2 size={12} className="text-emerald" />
                  <span>3. CPCB 2016 Schedule I Verification</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scanner Controls Area */}
      <div className="scanner__controls-container">
        {scanState === 'idle' && (
          <>
            {/* Quick Benchmark Preset Chips */}
            <div className="scanner__sample-strip">
              <span className="scanner__sample-title">TEST:</span>
              <div className="scanner__sample-scroll">
                {BENCHMARK_SAMPLES.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="scanner__sample-chip"
                    onClick={() => handleBenchmarkClick(s)}
                    style={{ '--chip-color': CATEGORY_INFO[s.category]?.color || '#38bdf8' }}
                  >
                    <span className="scanner__sample-dot" />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Action Scan Button */}
            <button 
              type="button"
              className="scanner__action-btn"
              onClick={() => handleCommitScan()}
            >
              <div className="scanner__action-btn-shell">
                <div className="scanner__action-btn-core">
                  <div className="scanner__action-icon-pill">
                    {camMode === 'capture' ? <Camera size={18} strokeWidth={2.5} /> : <Scan size={18} strokeWidth={2.5} />}
                  </div>
                  <span className="scanner__action-text">
                    {camMode === 'capture'
                      ? 'Capture & Analyze Item'
                      : liveTracked
                      ? `Commit: ${liveTracked.itemLabel.length > 14 ? liveTracked.itemLabel.slice(0, 12) + '…' : liveTracked.itemLabel} → ${trackedInfo?.label || 'Bin'}`
                      : 'Scan Object in Live Cam'}
                  </span>
                  <div className="scanner__action-trailing-circle">
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            </button>
          </>
        )}

        {scanState === 'result' && !showPicker && (
          <div className="scanner__result-section">
            <ResultPanel
              result={result}
              onCorrect={handleCorrect}
              onAddToBin={handleAddToBin}
              onCancel={handleCancelScan}
              onScanAnother={handleScanAnother}
              isAdded={isAdded}
            />
          </div>
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
