export type CollageLayout = "grid-2x2" | "strip-vertical";
export type FilterName = "none" | "grayscale" | "sepia" | "vintage";

export interface Settings {
  countdownSeconds: number;
  shotsPerSession: number;
  collageLayout: CollageLayout;
  filter: FilterName;
  overlayEnabled: boolean;
  overlayFile: string | null;
  galleryEnabled: boolean;
  qrEnabled: boolean;
  retentionDays: number;
  baseUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  countdownSeconds: 3,
  shotsPerSession: 1,
  collageLayout: "grid-2x2",
  filter: "none",
  overlayEnabled: false,
  overlayFile: null,
  galleryEnabled: true,
  qrEnabled: true,
  retentionDays: 0,
  baseUrl: "",
};

export interface SessionRecord {
  id: string;
  createdAt: number;
  filter: FilterName;
  originalFiles: string[];
  brandedFile: string;
}

export interface SessionSummary {
  id: string;
  createdAt: number;
  brandedUrl: string;
  shareUrl: string;
}

export interface SessionDetail extends SessionSummary {
  originalUrls: string[];
  qrCodeUrl: string;
}
