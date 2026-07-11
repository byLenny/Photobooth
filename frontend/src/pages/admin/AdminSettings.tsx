import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { adminChangePin, adminUpdateSettings, adminUploadOverlay, getSettings } from "../../api/client";
import type { Settings } from "../../api/types";
import { getCameraSettings, updateCameraSettings, type CameraSettings } from "../../cameraSettings";
import { THEMES, THEME_KEYS, THEME_LABELS } from "../../theme";

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

const AUTOSAVE_DEBOUNCE_MS = 700;

function resolutionKey(width: number | null, height: number | null): string {
  return width && height ? `${width}x${height}` : "auto";
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`switch ${on ? "on" : ""}`} onClick={onToggle}>
      <span className="knob" />
    </button>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [pinForm, setPinForm] = useState({ currentPin: "", newPin: "" });
  const [pinMsg, setPinMsg] = useState("");
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraError, setCameraError] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>(() => getCameraSettings());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosave = useRef(true);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  // Auto-saves to the datastore shortly after any field changes, instead of
  // requiring an explicit save action.
  useEffect(() => {
    if (!settings) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("saving");
    debounceRef.current = setTimeout(async () => {
      try {
        await adminUpdateSettings(settings);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [settings]);

  if (!settings) return <p>Loading…</p>;

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleOverlayUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await adminUploadOverlay(file);
    const updated = await getSettings();
    skipNextAutosave.current = true;
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

  function updateCamera(partial: Partial<CameraSettings>) {
    setCameraSettings(updateCameraSettings(partial));
  }

  function handleResolutionChange(key: string) {
    const preset = RESOLUTION_PRESETS.find((p) => resolutionKey(p.width, p.height) === key);
    if (!preset) return;
    updateCamera({ width: preset.width, height: preset.height });
  }

  const saveStatusLabel: Record<SaveStatus, string> = {
    idle: "",
    saving: "Saving…",
    saved: "All changes saved to the datastore",
    error: "Couldn't save — check your connection and try again",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "1rem" }}>
        <h2>Settings</h2>
        <span className={saveStatus === "error" ? "error-text" : undefined}>
          {saveStatusLabel[saveStatus]}
        </span>
      </div>
      <div>
        <div className="admin-field">
          <label>Theme palette</label>
          <div className="theme-picker">
            {THEME_KEYS.map((key) => (
              <button
                type="button"
                key={key}
                className={`theme-swatch ${settings.theme === key ? "active" : ""}`}
                onClick={() => update("theme", key)}
              >
                <span
                  className="dot"
                  style={{
                    background: `linear-gradient(135deg, ${THEMES[key].pink}, ${THEMES[key].purple} 55%, ${THEMES[key].gold})`,
                  }}
                />
                <span>{THEME_LABELS[key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="admin-field">
          <label>Event headline</label>
          <input
            type="text"
            value={settings.eventHeadline}
            onChange={(e) => update("eventHeadline", e.target.value)}
          />
        </div>

        <div className="admin-field">
          <label>Event subheading</label>
          <input
            type="text"
            value={settings.eventSubheading}
            onChange={(e) => update("eventSubheading", e.target.value)}
          />
        </div>

        <div className="admin-field">
          <label>
            Countdown (seconds): <span className="admin-slider-val">{settings.countdownSeconds}s</span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={settings.countdownSeconds}
            onChange={(e) => update("countdownSeconds", Number(e.target.value))}
          />
        </div>

        <div className="admin-field">
          <label>
            Photos per session: <span className="admin-slider-val">{settings.shotsPerSession}</span>
          </label>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={settings.shotsPerSession}
            onChange={(e) => update("shotsPerSession", Number(e.target.value))}
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

        <div className="admin-row">
          <label>Show on-screen gallery</label>
          <Switch on={settings.galleryEnabled} onToggle={() => update("galleryEnabled", !settings.galleryEnabled)} />
        </div>

        <div className="admin-row">
          <label>Make gallery slidable</label>
          <Switch
            on={settings.gallerySlidable}
            onToggle={() => update("gallerySlidable", !settings.gallerySlidable)}
          />
        </div>

        <div className="admin-row">
          <label>Make photos openable</label>
          <Switch
            on={settings.galleryOpenable}
            onToggle={() => update("galleryOpenable", !settings.galleryOpenable)}
          />
        </div>

        <div className="admin-field">
          <label>Gallery shows</label>
          <select
            value={settings.galleryImageSource}
            onChange={(e) => update("galleryImageSource", e.target.value as Settings["galleryImageSource"])}
          >
            <option value="recent">Most recent photos</option>
            <option value="random">Random photos</option>
            <option value="all">Everyone's photos</option>
          </select>
        </div>

        <div className="admin-row">
          <label>Show QR code after capture</label>
          <Switch on={settings.qrEnabled} onToggle={() => update("qrEnabled", !settings.qrEnabled)} />
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
            These preferences are saved in <em>this browser's</em> local storage, not the server —
            they only make sense for the specific machine actually driving the webcam. Open this
            page on the booth machine itself; a different device will show its own cameras and its
            own saved preferences, not the booth's.
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
            value={cameraSettings.deviceId ?? ""}
            onChange={(e) => {
              const device = cameraDevices.find((d) => d.deviceId === e.target.value);
              updateCamera({ deviceId: e.target.value || null, label: device?.label ?? cameraSettings.label });
            }}
          >
            <option value="">Auto (first available camera)</option>
            {cameraSettings.deviceId &&
              !cameraDevices.some((d) => d.deviceId === cameraSettings.deviceId) && (
                <option value={cameraSettings.deviceId}>
                  {cameraSettings.label ?? "Previously selected camera"} (not detected right now)
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
            value={resolutionKey(cameraSettings.width, cameraSettings.height)}
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
            value={cameraSettings.frameRate ?? ""}
            onChange={(e) => updateCamera({ frameRate: e.target.value ? Number(e.target.value) : null })}
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
              checked={cameraSettings.mirror}
              onChange={(e) => updateCamera({ mirror: e.target.checked })}
            />{" "}
            Mirror preview &amp; photo (recommended for selfie-style booths)
          </label>
        </div>
      </div>

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
