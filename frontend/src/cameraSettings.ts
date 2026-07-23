const STORAGE_KEY = "photoboth.cameraSettings";

export interface CameraSettings {
  deviceId: string | null;
  label: string | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  mirror: boolean;
}

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  deviceId: null,
  label: null,
  width: null,
  height: null,
  frameRate: null,
  mirror: true,
};

// Camera/resolution/mirror preferences live in this browser's localStorage,
// not the server, because they're only meaningful for the physical machine
// and browser actually driving the webcam (deviceIds don't carry over
// between machines).
export function getCameraSettings(): CameraSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CAMERA_SETTINGS;
    return { ...DEFAULT_CAMERA_SETTINGS, ...(JSON.parse(raw) as Partial<CameraSettings>) };
  } catch (err) {
    console.warn("Failed to parse stored camera settings", err);
    return DEFAULT_CAMERA_SETTINGS;
  }
}

export function saveCameraSettings(settings: CameraSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function updateCameraSettings(partial: Partial<CameraSettings>): CameraSettings {
  const updated = { ...getCameraSettings(), ...partial };
  saveCameraSettings(updated);
  return updated;
}
