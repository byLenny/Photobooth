export type ShotMode = "single" | "collage";
export type CollageLayout = "grid-2x2" | "strip-vertical";
export type FilterName = "none" | "grayscale" | "sepia" | "vintage";

export interface Settings {
  countdownSeconds: number;
  shotMode: ShotMode;
  collageShotCount: number;
  collageLayout: CollageLayout;
  filter: FilterName;
  overlayEnabled: boolean;
  overlayFile: string | null;
  galleryEnabled: boolean;
  qrEnabled: boolean;
  retentionDays: number;
  baseUrl: string;
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
