import React, { useRef, useEffect, useState } from 'react';

/**
 * Camera view component using getUserMedia with interactive Canvas HUD layer
 */
export default function CameraView({ videoRef, canvasRef, onReady }) {
  const [cameraState, setCameraState] = useState('loading');
  const streamRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('unavailable');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // prefer rear camera on mobile
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setCameraState('granted');
            onReady && onReady();
          };
        }
      } catch (err) {
        if (!cancelled) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setCameraState('denied');
          } else {
            setCameraState('unavailable');
          }
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div className="camera-view">
      {cameraState === 'loading' && (
        <div className="camera-view__overlay">
          <div className="camera-view__spinner"></div>
          <p>Starting camera…</p>
        </div>
      )}

      {cameraState === 'denied' && (
        <div className="camera-view__overlay camera-view__overlay--error">
          <span className="camera-view__error-icon">🚫</span>
          <p className="camera-view__error-title">Camera Access Denied</p>
          <p className="camera-view__error-text">
            Please allow camera access in your browser settings to use the scanner.
          </p>
        </div>
      )}

      {cameraState === 'unavailable' && (
        <div className="camera-view__overlay camera-view__overlay--error">
          <span className="camera-view__error-icon">📷</span>
          <p className="camera-view__error-title">Camera Unavailable</p>
          <p className="camera-view__error-text">
            Your device doesn't support camera access. You can still use the manual category picker.
          </p>
        </div>
      )}

      <video
        ref={videoRef}
        className="camera-view__video"
        playsInline
        muted
        autoPlay
        style={{ display: cameraState === 'granted' ? 'block' : 'none' }}
      />

      {/* Real-time Bounding Box Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="camera-view__canvas"
        style={{ display: cameraState === 'granted' ? 'block' : 'none' }}
      />
    </div>
  );
}
