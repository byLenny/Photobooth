import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { adminChangePin, adminUpdateSettings, adminUploadOverlay, getSettings } from "../../api/client";
import type { Settings } from "../../api/types";

const RESOLUTION_PRESETS: { label: string; width: number | null; height: number | null }[] = [
  { label: "Auto (camera default)", width: null, height: null },
  { label: "640 × 480", width: 640, height: 480 },
  { label: "1280 × 720 (HD)", width: 1280, height: 720 },
  { label: "1920 × 1080 (Full HD)", width: 1920, height: 1080 },
  { label: "2560 × 1440 (2K)", width: 2560, height: 1440 },
  { label: "3840 × 2160 (4K)", width: 3840, height: 2160 },
];

const FRAME_RATE_PRESETS: { label: string; value: number | null }[] = [
  { label: "Auto", value: null },
  { label: "15 fps", value: 15 },
  { label: "24 fps", value: 24 },
  { label: "30 fps", value: 30 },
  { label: "60 fps", value: 60 },
];

function resolutionKey(width: number | null, height: number | null): string {
  return width && height ? `${width}x${height}` : "auto";
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [pinForm, setPinForm] = useState({ currentPin: "", newPin: "" });
  const [pinMsg, setPinMsg] = useState("");
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraError, setCameraError] = useState("");
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  if (!settings) return <p>Loading…</p>;

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    const updated = await adminUpdateSettings(settings);
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleOverlayUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await adminUploadOverlay(file);
    const updated = await getSettings();
    setSettings(updated);
  }

  async function handlePinChange(e: FormEvent) {
    e.preventDefault();
    setPinMsg("");
    try {
      await adminChangePin(pinForm.currentPin, pinForm.newPin);
      setPinMsg("PIN updated");
      setPinForm({ currentPin: "", newPin: "" });
    } catch {
      setPinMsg("Could not update PIN — check the current PIN");
    }
  }

  async function detectCameras() {
    setCameraError("");
    setDetecting(true);
    try {
      // Requesting a stream first is what makes device labels available.
      const probeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      probeStream.getTracks().forEach((t) => t.stop());
      const list = await navigator.mediaDevices.enumerateDevices();
      setCameraDevices(list.filter((d) => d.kind === "videoinput"));
    } catch {
      setCameraError(
        "Could not access a camera from this browser/device to detect cameras. Run this from the machine the booth's webcam is connected to.",
      );
    } finally {
      setDetecting(false);
    }
  }

  function handleResolutionChange(key: string) {
    const preset = RESOLUTION_PRESETS.find((p) => resolutionKey(p.width, p.height) === key);
    if (!preset) return;
    setSettings((prev) => (prev ? { ...prev, cameraWidth: preset.width, cameraHeight: preset.height } : prev));
  }

  return (
    <div>
      <h2>Settings</h2>
      <form onSubmit={save}>
        <div className="admin-field">
          <label>Countdown (seconds)</label>
          <input
            type="number"
            min={1}
            max={10}
            value={settings.countdownSeconds}
            onChange={(e) => update("countdownSeconds", Number(e.target.value))}
          />
        </div>

        <div className="admin-field">
          <label>Photos per session</label>
          <input
            type="number"
            min={1}
            max={5}
            value={settings.shotsPerSession}
            onChange={(e) =>
              update("shotsPerSession", Math.min(5, Math.max(1, Number(e.target.value))))
            }
          />
          <small>1 = a single photo. 2–5 are combined into a collage.</small>
        </div>

        {settings.shotsPerSession > 1 && (
          <div className="admin-field">
            <label>Collage layout</label>
            <select
              value={settings.collageLayout}
              onChange={(e) => update("collageLayout", e.target.value as Settings["collageLayout"])}
            >
              <option value="grid-2x2">Grid (2 columns)</option>
              <option value="strip-vertical">Vertical strip</option>
            </select>
          </div>
        )}

        <div className="admin-field">
          <label>Filter</label>
          <select
            value={settings.filter}
            onChange={(e) => update("filter", e.target.value as Settings["filter"])}
          >
            <option value="none">None</option>
            <option value="grayscale">Grayscale</option>
            <option value="sepia">Sepia</option>
            <option value="vintage">Vintage</option>
          </select>
        </div>

        <div className="admin-field">
          <label>
            <input
              type="checkbox"
              checked={settings.overlayEnabled}
              onChange={(e) => update("overlayEnabled", e.target.checked)}
            />{" "}
            Enable branding overlay
          </label>
          <input type="file" accept="image/png" onChange={handleOverlayUpload} />
          {settings.overlayFile && <small>Current: {settings.overlayFile}</small>}
        </div>

        <div className="admin-field">
          <label>
            <input
              type="checkbox"
              checked={settings.galleryEnabled}
              onChange={(e) => update("galleryEnabled", e.target.checked)}
            />{" "}
            Show on-screen gallery
          </label>
        </div>

        <div className="admin-field">
          <label>
            <input
              type="checkbox"
              checked={settings.qrEnabled}
              onChange={(e) => update("qrEnabled", e.target.checked)}
            />{" "}
            Show QR code after capture
          </label>
        </div>

        <div className="admin-field">
          <label>Retention (days, 0 = keep forever)</label>
          <input
            type="number"
            min={0}
            value={settings.retentionDays}
            onChange={(e) => update("retentionDays", Number(e.target.value))}
          />
        </div>

        <div className="admin-field">
          <label>Public base URL (used in QR codes, optional)</label>
          <input
            type="text"
            placeholder="http://photobooth.local:8080"
            value={settings.baseUrl}
            onChange={(e) => update("baseUrl", e.target.value)}
          />
        </div>

        <h3>Camera</h3>
        <p>
          <small>
            Run this section from the browser on the booth machine itself — the camera list below
            reflects whatever this browser can see right now.
          </small>
        </p>

        <div className="admin-field">
          <button type="button" className="secondary-button" onClick={detectCameras} disabled={detecting}>
            {detecting ? "Detecting…" : "Detect cameras"}
          </button>
          {cameraError && <p className="error-text">{cameraError}</p>}
        </div>

        <div className="admin-field">
          <label>Camera</label>
          <select
            value={settings.cameraDeviceId ?? ""}
            onChange={(e) => {
              const device = cameraDevices.find((d) => d.deviceId === e.target.value);
              setSettings((prev) =>
                prev
                  ? {
                      ...prev,
                      cameraDeviceId: e.target.value || null,
                      cameraLabel: device?.label ?? prev.cameraLabel,
                    }
                  : prev,
              );
            }}
          >
            <option value="">Auto (first available camera)</option>
            {settings.cameraDeviceId &&
              !cameraDevices.some((d) => d.deviceId === settings.cameraDeviceId) && (
                <option value={settings.cameraDeviceId}>
                  {settings.cameraLabel ?? "Previously selected camera"} (not detected right now)
                </option>
              )}
            {cameraDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || "Camera"}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label>Resolution</label>
          <select
            value={resolutionKey(settings.cameraWidth, settings.cameraHeight)}
            onChange={(e) => handleResolutionChange(e.target.value)}
          >
            {RESOLUTION_PRESETS.map((p) => (
              <option key={resolutionKey(p.width, p.height)} value={resolutionKey(p.width, p.height)}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label>Frame rate</label>
          <select
            value={settings.cameraFrameRate ?? ""}
            onChange={(e) => update("cameraFrameRate", e.target.value ? Number(e.target.value) : null)}
          >
            {FRAME_RATE_PRESETS.map((p) => (
              <option key={p.label} value={p.value ?? ""}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label>
            <input
              type="checkbox"
              checked={settings.mirror}
              onChange={(e) => update("mirror", e.target.checked)}
            />{" "}
            Mirror preview &amp; photo (recommended for selfie-style booths)
          </label>
        </div>

        <button className="big-button" type="submit">
          Save settings
        </button>
        {saved && <p>Saved!</p>}
      </form>

      <h2>Admin PIN</h2>
      <form onSubmit={handlePinChange}>
        <div className="admin-field">
          <label>Current PIN</label>
          <input
            type="password"
            value={pinForm.currentPin}
            onChange={(e) => setPinForm({ ...pinForm, currentPin: e.target.value })}
          />
        </div>
        <div className="admin-field">
          <label>New PIN</label>
          <input
            type="password"
            value={pinForm.newPin}
            onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value })}
          />
        </div>
        {pinMsg && <p>{pinMsg}</p>}
        <button className="secondary-button" type="submit">
          Change PIN
        </button>
      </form>
    </div>
  );
}
