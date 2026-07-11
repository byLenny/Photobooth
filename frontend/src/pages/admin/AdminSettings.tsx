import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { adminChangePin, adminUpdateSettings, adminUploadOverlay, getSettings } from "../../api/client";
import type { Settings } from "../../api/types";

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [pinForm, setPinForm] = useState({ currentPin: "", newPin: "" });
  const [pinMsg, setPinMsg] = useState("");

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
          <label>Shot mode</label>
          <select
            value={settings.shotMode}
            onChange={(e) => update("shotMode", e.target.value as Settings["shotMode"])}
          >
            <option value="single">Single photo</option>
            <option value="collage">Multi-shot collage</option>
          </select>
        </div>

        {settings.shotMode === "collage" && (
          <>
            <div className="admin-field">
              <label>Number of shots</label>
              <input
                type="number"
                min={2}
                max={8}
                value={settings.collageShotCount}
                onChange={(e) => update("collageShotCount", Number(e.target.value))}
              />
            </div>
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
          </>
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
