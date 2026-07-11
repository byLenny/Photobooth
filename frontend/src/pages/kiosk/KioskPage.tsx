import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createSession, getSettings, listSessions } from "../../api/client";
import type { Settings, SessionDetail, SessionSummary } from "../../api/types";
import { getCameraSettings, updateCameraSettings, type CameraSettings } from "../../cameraSettings";
import { RESULT_PHRASES } from "../../theme";
import Confetti from "./Confetti";

type Stage = "idle" | "setup" | "countdown" | "processing" | "result" | "error";

const RESULT_TIMEOUT_MS = 25_000;
const INTER_SHOT_PAUSE_MS = 1200;
const FLASH_MS = 140;
const DEFAULT_GALLERY_LIMIT = 12;
const ALL_GALLERY_LIMIT = 100;
const CONFETTI_DENSITY = 18;
const DEFAULT_HEADLINE = "Smile, it's party time! 🎉";
const DEFAULT_SUBHEAD = "Press Start to commemorate the occasion with a photo!";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function KioskPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [gallery, setGallery] = useState<SessionSummary[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [shotProgress, setShotProgress] = useState({ current: 0, total: 1 });
  const [shotPreviews, setShotPreviews] = useState<string[]>([]);
  const [flash, setFlash] = useState(false);
  const [result, setResult] = useState<SessionDetail | null>(null);
  const [resultHeadline, setResultHeadline] = useState(RESULT_PHRASES[0]);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [cameraPrefs, setCameraPrefs] = useState<CameraSettings>(() => getCameraSettings());
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const shotPreviewsRef = useRef<string[]>([]);

  const clearShotPreviews = useCallback(() => {
    shotPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    shotPreviewsRef.current = [];
    setShotPreviews([]);
  }, []);

  const refreshGallery = useCallback(() => {
    const limit = settings?.galleryImageSource === "all" ? ALL_GALLERY_LIMIT : DEFAULT_GALLERY_LIMIT;
    listSessions(limit).then(setGallery).catch(() => undefined);
  }, [settings?.galleryImageSource]);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (settings) refreshGallery();
  }, [settings, refreshGallery]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const openCamera = useCallback(
    async (deviceId?: string) => {
      stopStream();
      const targetDeviceId = deviceId ?? cameraPrefs.deviceId ?? undefined;
      const buildConstraints = (withDeviceId: boolean): MediaTrackConstraints => {
        const c: MediaTrackConstraints = withDeviceId && targetDeviceId
          ? { deviceId: { exact: targetDeviceId } }
          : { facingMode: "user" };
        if (cameraPrefs.width) c.width = { ideal: cameraPrefs.width };
        if (cameraPrefs.height) c.height = { ideal: cameraPrefs.height };
        if (cameraPrefs.frameRate) c.frameRate = { ideal: cameraPrefs.frameRate };
        return c;
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: buildConstraints(true),
          audio: false,
        });
      } catch (err) {
        if (!targetDeviceId) throw err;
        // The configured/preferred camera isn't available on this machine — fall back to any camera.
        stream = await navigator.mediaDevices.getUserMedia({
          video: buildConstraints(false),
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list.filter((d) => d.kind === "videoinput");
      setDevices(cams);
      const activeTrack = stream.getVideoTracks()[0];
      const activeId = activeTrack?.getSettings().deviceId;
      if (activeId) setSelectedDeviceId(activeId);
    },
    [stopStream, cameraPrefs],
  );

  const startSession = useCallback(async () => {
    setErrorMsg("");
    setStage("setup");
    try {
      await openCamera(selectedDeviceId || undefined);
    } catch (err) {
      setErrorMsg("Could not access a camera. Check permissions and connections.");
      setStage("error");
    }
  }, [openCamera, selectedDeviceId]);

  const switchCamera = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      try {
        await openCamera(deviceId);
        const device = devices.find((d) => d.deviceId === deviceId);
        setCameraPrefs(updateCameraSettings({ deviceId, label: device?.label ?? null }));
      } catch {
        setErrorMsg("Could not switch to that camera.");
      }
    },
    [openCamera, devices],
  );

  const openFullscreen = useCallback((url: string) => setFullscreenUrl(url), []);
  const closeFullscreen = useCallback(() => setFullscreenUrl(null), []);

  const returnToIdle = useCallback(() => {
    cancelledRef.current = true;
    stopStream();
    setStage("idle");
    setResult(null);
    setCountdownValue(null);
    setFullscreenUrl(null);
    clearShotPreviews();
    refreshGallery();
  }, [stopStream, clearShotPreviews, refreshGallery]);

  const captureFrame = useCallback((): Promise<Blob> => {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    if (cameraPrefs.mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("capture_failed"))),
        "image/jpeg",
        0.92,
      );
    });
  }, [cameraPrefs]);

  const runCountdown = useCallback(async (seconds: number) => {
    for (let s = seconds; s > 0; s--) {
      if (cancelledRef.current) return;
      setCountdownValue(s);
      await sleep(1000);
    }
    setCountdownValue(0);
    await sleep(200);
  }, []);

  const beginCapture = useCallback(async () => {
    if (!settings) return;
    cancelledRef.current = false;
    const total = settings.shotsPerSession;
    setShotProgress({ current: 0, total });
    setStage("countdown");
    clearShotPreviews();

    const shots: Blob[] = [];
    for (let i = 0; i < total; i++) {
      setShotProgress({ current: i + 1, total });
      await runCountdown(settings.countdownSeconds);
      if (cancelledRef.current) return;
      const blob = await captureFrame();
      shots.push(blob);
      setCountdownValue(null);
      setFlash(true);
      shotPreviewsRef.current = [...shotPreviewsRef.current, URL.createObjectURL(blob)];
      setShotPreviews(shotPreviewsRef.current);
      await sleep(FLASH_MS);
      setFlash(false);
      if (i < total - 1) await sleep(INTER_SHOT_PAUSE_MS - FLASH_MS);
    }

    setStage("processing");
    stopStream();
    try {
      const session = await createSession(shots);
      setResult(session);
      setResultHeadline(RESULT_PHRASES[Math.floor(Math.random() * RESULT_PHRASES.length)]);
      setStage("result");
    } catch {
      setErrorMsg("Something went wrong saving your photo. Please try again.");
      setStage("error");
    }
  }, [settings, runCountdown, captureFrame, stopStream, clearShotPreviews]);

  useEffect(() => {
    if (stage !== "result") return;
    const timer = setTimeout(returnToIdle, RESULT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [stage, returnToIdle]);

  useEffect(() => {
    return () => {
      stopStream();
      shotPreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [stopStream]);

  const themeClass = `theme-${settings?.theme ?? "party"}`;

  const fullscreenViewer = fullscreenUrl && (
    <div className="fullscreen-viewer" onClick={closeFullscreen}>
      <img className="fullscreen-photo" src={fullscreenUrl} alt="Full size" />
      <button className="btn btn-ghost">Tap anywhere to close</button>
    </div>
  );

  if (stage === "idle") {
    const galleryStripClass = [
      "gallery-strip",
      settings?.gallerySlidable === false ? "no-scroll" : "",
      settings?.galleryOpenable ? "openable" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={`kiosk ${themeClass}`}>
        <Confetti density={CONFETTI_DENSITY} />
        <Link className="admin-gear" to="/admin" aria-label="Admin settings">
          ⚙️
        </Link>
        <div className="screen">
          <h1 className="headline">{settings?.eventHeadline || DEFAULT_HEADLINE}</h1>
          <p className="subhead">{settings?.eventSubheading || DEFAULT_SUBHEAD}</p>
          <button className="btn btn-primary" onClick={startSession}>
            Start
          </button>
          {settings?.galleryEnabled && gallery.length > 0 && (
            <div className={galleryStripClass}>
              {gallery.map((s) => (
                <img
                  key={s.id}
                  src={s.brandedUrl}
                  alt="Past shot"
                  onClick={settings.galleryOpenable ? () => openFullscreen(s.brandedUrl) : undefined}
                />
              ))}
            </div>
          )}
        </div>
        {fullscreenViewer}
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className={`kiosk ${themeClass}`}>
        <div className="screen">
          <p className="error-text">{errorMsg}</p>
          <button className="btn btn-secondary" onClick={returnToIdle}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (stage === "result" && result) {
    return (
      <div className={`kiosk ${themeClass}`}>
        <Confetti density={CONFETTI_DENSITY} />
        <div className="screen">
          <h1 className="headline">{resultHeadline}</h1>
          <div className="result-grid">
            {result.originalUrls.map((url, i) => (
              <img
                key={url}
                className="result-thumb"
                src={url}
                alt={`Photo ${i + 1}`}
                onClick={() => openFullscreen(url)}
              />
            ))}
          </div>
          {settings?.qrEnabled && (
            <div className="qr-card">
              <img src={result.qrCodeUrl} alt="Scan to download" />
            </div>
          )}
          <p className="subhead">Scan the code to grab your photos, or tap one above to view it full-screen</p>
          <button className="btn btn-primary" onClick={returnToIdle}>
            Snap Another 📸
          </button>
        </div>
        {fullscreenViewer}
      </div>
    );
  }

  if (stage === "processing") {
    return (
      <div className={`kiosk ${themeClass}`}>
        <div className="screen">
          <div className="processing-ring" />
          <p className="subhead">Processing your photo…</p>
        </div>
      </div>
    );
  }

  // setup / countdown share the live camera view
  return (
    <div className={`kiosk ${themeClass}`}>
      <div className="screen">
        {stage === "setup" && devices.length > 1 && (
          <select
            className="cam-device-select"
            value={selectedDeviceId}
            onChange={(e) => switchCamera(e.target.value)}
            aria-label="Select camera"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "Camera"}
              </option>
            ))}
          </select>
        )}

        <div className="cam-wrap">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={cameraPrefs.mirror ? { transform: "scaleX(-1)" } : undefined}
          />
          <div className={`cam-flash ${flash ? "on" : ""}`} />
          <div className="cam-badge">
            <span className="rec-dot" />
            Live
          </div>
          {stage === "countdown" && countdownValue !== null && countdownValue > 0 && (
            <div className="countdown-num">{countdownValue}</div>
          )}
          {shotPreviews.length > 0 && (
            <div className="taken-strip">
              {shotPreviews.map((url, i) => (
                <img key={url} className="thumb" src={url} alt={`Shot ${i + 1}`} />
              ))}
            </div>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {stage === "setup" && (
          <button className="btn btn-primary" onClick={beginCapture}>
            Take Photo
          </button>
        )}
        {stage === "countdown" && shotProgress.total > 1 && (
          <p className="shot-progress">
            Shot {shotProgress.current} of {shotProgress.total}
          </p>
        )}

        <button className="btn btn-ghost" onClick={returnToIdle}>
          Cancel
        </button>
      </div>
    </div>
  );
}
