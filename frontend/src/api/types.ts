export type CollageLayout = "grid-2x2" | "strip-vertical";
export type FilterName = "none" | "grayscale" | "sepia" | "vintage";
export type ThemeKey = "party" | "citrus" | "berry" | "ocean" | "candy";
export type GalleryImageSource = "recent" | "random" | "all";

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
  theme: ThemeKey;
  gallerySlidable: boolean;
  galleryOpenable: boolean;
  galleryImageSource: GalleryImageSource;
  eventHeadline: string;
  eventSubheading: string;
}

export interface SessionSummary {
  id: string;
  createdAt: number;
  brandedUrl: string;
  originalUrls: string[];
  shareUrl: string;
}

export interface SessionDetail extends SessionSummary {
  qrCodeUrl: string;
}
