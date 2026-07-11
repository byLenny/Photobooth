import { useCallback, useEffect, useRef, useState } from "react";
import { createSession, getSettings, listSessions } from "../../api/client";
import type { Settings, SessionDetail, SessionSummary } from "../../api/types";

type Stage = "idle" | "setup" | "countdown" | "processing" | "result" | "error";

const RESULT_TIMEOUT_MS = 25_000;
const INTER_SHOT_PAUSE_MS = 1200;

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
  const [result, setResult] = useState<SessionDetail | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);

  const refreshGallery = useCallback(() => {
    listSessions(12).then(setGallery).catch(() => undefined);
  }, []);

  useEffect(() => {
    getSettings().then(setSettings).catch(() => undefined);
    refreshGallery();
  }, [refreshGallery]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const openCamera = useCallback(
    async (deviceId?: string) => {
      stopStream();
      const targetDeviceId = deviceId ?? settings?.cameraDeviceId ?? undefined;
      const buildConstraints = (withDeviceId: boolean): MediaTrackConstraints => {
        const c: MediaTrackConstraints = withDeviceId && targetDeviceId
          ? { deviceId: { exact: targetDeviceId } }
          : { facingMode: "user" };
        if (settings?.cameraWidth) c.width = { ideal: settings.cameraWidth };
        if (settings?.cameraHeight) c.height = { ideal: settings.cameraHeight };
        if (settings?.cameraFrameRate) c.frameRate = { ideal: settings.cameraFrameRate };
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
    [stopStream, settings],
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
      } catch {
        setErrorMsg("Could not switch to that camera.");
      }
    },
    [openCamera],
  );

  const returnToIdle = useCallback(() => {
    cancelledRef.current = true;
    stopStream();
    setStage("idle");
    setResult(null);
    setCountdownValue(null);
    refreshGallery();
  }, [stopStream, refreshGallery]);

  const captureFrame = useCallback((): Promise<Blob> => {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    if (settings?.mirror) {
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
  }, [settings]);

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

    const shots: Blob[] = [];
    for (let i = 0; i < total; i++) {
      setShotProgress({ current: i + 1, total });
      await runCountdown(settings.countdownSeconds);
      if (cancelledRef.current) return;
      const blob = await captureFrame();
      shots.push(blob);
      setCountdownValue(null);
      if (i < total - 1) await sleep(INTER_SHOT_PAUSE_MS);
    }

    setStage("processing");
    stopStream();
    try {
      const session = await createSession(shots);
      setResult(session);
      setStage("result");
    } catch {
      setErrorMsg("Something went wrong saving your photo. Please try again.");
      setStage("error");
    }
  }, [settings, runCountdown, captureFrame, stopStream]);

  useEffect(() => {
    if (stage !== "result") return;
    const timer = setTimeout(returnToIdle, RESULT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [stage, returnToIdle]);

  useEffect(() => stopStream, [stopStream]);

  if (stage === "idle") {
    return (
      <div className="screen">
        <h1>📸 Photoboth</h1>
        <p>Tap below to start your photo session</p>
        <button className="big-button" onClick={startSession}>
          Start
        </button>
        {settings?.galleryEnabled && gallery.length > 0 && (
          <div className="gallery-strip">
            {gallery.map((s) => (
              <img key={s.id} src={s.brandedUrl} alt="Past shot" />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="screen">
        <p className="error-text">{errorMsg}</p>
        <button className="secondary-button" onClick={returnToIdle}>
          Back
        </button>
      </div>
    );
  }

  if (stage === "result" && result) {
    return (
      <div className="screen">
        <h2>You look great! ✨</h2>
        <div className="preview-frame">
          <img src={result.brandedUrl} alt="Your photo" />
        </div>
        {settings?.qrEnabled && (
          <div className="qr-code">
            <img src={result.qrCodeUrl} alt="Scan to download" />
          </div>
        )}
        <p>Scan the code to get your photo</p>
        <button className="big-button" onClick={returnToIdle}>
          New Photo
        </button>
      </div>
    );
  }

  // setup / countdown / processing all share the live camera view
  return (
    <div className="screen">
      {stage === "setup" && devices.length > 1 && (
        <select
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

      <div style={{ position: "relative" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={settings?.mirror ? { transform: "scaleX(-1)" } : undefined}
        />
        {stage === "countdown" && countdownValue !== null && countdownValue > 0 && (
          <div
            className="countdown-number"
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {countdownValue}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {stage === "setup" && (
        <button className="big-button" onClick={beginCapture}>
          Take Photo
        </button>
      )}
      {stage === "countdown" && shotProgress.total > 1 && (
        <p>
          Shot {shotProgress.current} of {shotProgress.total}
        </p>
      )}
      {stage === "processing" && <p>Processing your photo…</p>}

      <button className="secondary-button" onClick={returnToIdle}>
        Cancel
      </button>
    </div>
  );
}
