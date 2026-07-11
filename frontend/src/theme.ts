import type { ThemeKey } from "./api/types";

export interface ThemePalette {
  pink: string;
  purple: string;
  gold: string;
  teal: string;
}

export const THEMES: Record<ThemeKey, ThemePalette> = {
  party: { pink: "#ff3b8d", purple: "#8b5cf6", gold: "#ffc233", teal: "#22d3c6" },
  citrus: { pink: "#ff6b3b", purple: "#a855f7", gold: "#ffd23f", teal: "#2dd4bf" },
  berry: { pink: "#e0308a", purple: "#6d28d9", gold: "#f5c518", teal: "#38bdf8" },
  ocean: { pink: "#ff6f91", purple: "#2563eb", gold: "#38bdf8", teal: "#14b8a6" },
  candy: { pink: "#ff5da2", purple: "#c026d3", gold: "#fbbf24", teal: "#f472b6" },
};

export const THEME_LABELS: Record<ThemeKey, string> = {
  party: "Party",
  citrus: "Citrus",
  berry: "Berry",
  ocean: "Ocean",
  candy: "Candy",
};

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];

export const RESULT_PHRASES: string[] = [
  "You look amazing! ✨",
  "Absolutely glowing! 🌟",
  "Party royalty right there! 👑",
  "That's a keeper! 📸",
  "Iconic. Truly iconic. ✨",
  "Main character energy! 🎬",
  "You nailed it! 🎉",
  "Say cheese, nailed it! 🧀",
  "Certified stunner! 💫",
  "Gorgeous, as always! 💐",
  "Those smiles though! 😄",
  "Picture perfect! 🖼️",
  "Absolute superstars! ⭐",
  "Legendary shot! 🏆",
  "You're on fire tonight! 🔥",
  "Sparkling like the confetti! ✨",
  "What a vibe! 🎊",
  "Framed and ready! 🖼️",
  "Chef's kiss! 👌",
  "Pure magic captured! 🪄",
  "Camera loves you! 📷",
];
