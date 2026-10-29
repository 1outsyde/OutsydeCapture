// ── Outsyde curated brand-color system ────────────────────────────────────────
// Mirrors shared/colorOptions.ts on the backend.
// ID arrays are const-asserted so SolidColorId / GradientColorId union types
// are automatically derived from the literal values.
//
// Light/dark pairing follows the same pattern as constants/theme.ts:
//   dark  — full-brightness value used on dark backgrounds
//   light — darkened/saturated value for sufficient contrast on light surfaces
// ──────────────────────────────────────────────────────────────────────────────

export const SOLID_COLOR_IDS = [
  "sunset_gold",
  "rose_pink",
  "ocean_blue",
  "forest_green",
  "royal_purple",
  "sunset_orange",
  "teal",
  "slate_gray",
  "ruby_red",
  "sky_cyan",
  "amber",
  "indigo",
  "coral",
  "lime",
  "plum",
  "charcoal_emerald",
] as const;

export const GRADIENT_COLOR_IDS = [
  "dusk_fade",
  "sunset_blaze",
  "ocean_depth",
  "emerald_glow",
  "golden_hour",
  "midnight_rose",
] as const;

export type SolidColorId = (typeof SOLID_COLOR_IDS)[number];
export type GradientColorId = (typeof GRADIENT_COLOR_IDS)[number];
export type ColorId = SolidColorId | GradientColorId;

// ── Stored shape (sent to / received from API) ─────────────────────────────────
// "custom" = a color wheel pick (2026-10-28). Backend rules: outsyde-backend shared/profileColor.ts.
export type BrandColorSpec =
  | { type: "solid" | "gradient"; id: string }
  | { type: "custom"; hex: string };

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// ── Value map ──────────────────────────────────────────────────────────────────
type SolidEntry = { name: string; dark: string; light: string };
type GradientEntry = {
  name: string;
  dark: readonly [string, string];
  light: readonly [string, string];
};

type ColorValuesMap = Record<SolidColorId, SolidEntry> &
  Record<GradientColorId, GradientEntry>;

export const COLOR_VALUES: ColorValuesMap = {
  // Solids
  sunset_gold:      { name: "Sunset Gold",     dark: "#E8B930", light: "#B38600" },
  rose_pink:        { name: "Rose Pink",        dark: "#EC4899", light: "#C2338A" },
  ocean_blue:       { name: "Ocean Blue",       dark: "#3B82F6", light: "#1D4ED8" },
  forest_green:     { name: "Forest Green",     dark: "#22C55E", light: "#15803D" },
  royal_purple:     { name: "Royal Purple",     dark: "#8B5CF6", light: "#6D28D9" },
  sunset_orange:    { name: "Sunset Orange",    dark: "#F97316", light: "#C2410C" },
  teal:             { name: "Teal",             dark: "#14B8A6", light: "#0F766E" },
  slate_gray:       { name: "Slate Gray",       dark: "#64748B", light: "#475569" },
  ruby_red:         { name: "Ruby Red",         dark: "#EF4444", light: "#B91C1C" },
  sky_cyan:         { name: "Sky Cyan",         dark: "#22D3EE", light: "#0E7490" },
  amber:            { name: "Amber",            dark: "#F59E0B", light: "#B45309" },
  indigo:           { name: "Indigo",           dark: "#6366F1", light: "#4338CA" },
  coral:            { name: "Coral",            dark: "#FB7185", light: "#BE123C" },
  lime:             { name: "Lime",             dark: "#A3E635", light: "#4D7C0F" },
  plum:             { name: "Plum",             dark: "#C084FC", light: "#7E22CE" },
  charcoal_emerald: { name: "Charcoal Emerald", dark: "#1A3C34", light: "#0F241F" },
  // Gradients — dark/light each contain [start-stop, end-stop] hex strings
  dusk_fade:     { name: "Dusk Fade",     dark: ["#2C1A4D", "#7A3E9D"], light: ["#4B2E82", "#A66BC7"] },
  sunset_blaze:  { name: "Sunset Blaze",  dark: ["#F97316", "#EC4899"], light: ["#C2410C", "#C2338A"] },
  ocean_depth:   { name: "Ocean Depth",   dark: ["#1E3A8A", "#22D3EE"], light: ["#1E40AF", "#0E7490"] },
  emerald_glow:  { name: "Emerald Glow",  dark: ["#0F241F", "#22C55E"], light: ["#14532D", "#15803D"] },
  golden_hour:   { name: "Golden Hour",   dark: ["#E8B930", "#F97316"], light: ["#B38600", "#C2410C"] },
  midnight_rose: { name: "Midnight Rose", dark: ["#1A1A2E", "#EC4899"], light: ["#3F3F5F", "#C2338A"] },
};

// ── Fallback hex values matching theme.brandGold per mode ─────────────────────
const FALLBACK_DARK = "#E8B930";
const FALLBACK_LIGHT = "#B38600";

// ── Shared parser ──────────────────────────────────────────────────────────────
/**
 * Parse a raw API value (object, JSON string, or null/undefined) into a typed
 * BrandColorSpec. Returns null for any unrecognised or legacy shape.
 */
export function parseBrandColorSpec(raw: unknown): BrandColorSpec | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return parseBrandColorSpec(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (obj.type === "custom" && typeof obj.hex === "string" && HEX_RE.test(obj.hex)) {
      return { type: "custom", hex: obj.hex.toUpperCase() };
    }
    if (
      (obj.type === "solid" || obj.type === "gradient") &&
      typeof obj.id === "string" &&
      obj.id.length > 0
    ) {
      return { type: obj.type, id: obj.id };
    }
  }
  return null;
}

// ── Accent-color resolver ──────────────────────────────────────────────────────
/**
 * Resolve a BrandColorSpec to a single display hex string for the given theme
 * mode.
 *   - solid  → COLOR_VALUES[id][mode]
 *   - gradient → deferred (this pass handles solids only); falls back to gold
 *   - null   → falls back to gold (matching existing default behaviour)
 */
export function resolveBrandColor(
  brandColors: BrandColorSpec | null | undefined,
  mode: "dark" | "light",
): string {
  const fallback = mode === "dark" ? FALLBACK_DARK : FALLBACK_LIGHT;
  if (!brandColors) return fallback;
  // Color wheel pick: one hex, nudged lighter on dark screens / darker on light screens only when it
  // would be hard to see (contrast under 3:1). Presets keep their own hand-picked dark/light pair.
  if (brandColors.type === "custom") {
    if (!HEX_RE.test(brandColors.hex)) return fallback;
    return ensureContrast(brandColors.hex, mode === "dark" ? "#000000" : "#FFFFFF", 3);
  }
  // Gradient rendering deferred to a later task
  if (brandColors.type === "gradient") return fallback;

  const entry = COLOR_VALUES[brandColors.id as SolidColorId] as
    | SolidEntry
    | GradientEntry
    | undefined;
  if (!entry) return fallback;

  // Solid entries have a string for dark/light; guard against gradient tuples
  if (typeof entry.dark === "string") {
    return mode === "dark"
      ? (entry as SolidEntry).dark
      : (entry as SolidEntry).light;
  }
  return fallback;
}

// ── Contrast helpers (color wheel build, 2026-10-28) ───────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #RRGGBB colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mix `hex` toward white (on a dark background) or black (on a light one) until it reaches `min` contrast. */
export function ensureContrast(hex: string, background: string, min: number): string {
  if (!HEX_RE.test(hex)) return hex;
  const target: [number, number, number] = luminance(background) < 0.5 ? [255, 255, 255] : [0, 0, 0];
  const start = hexToRgb(hex);
  let out = hex.toUpperCase();
  for (let step = 0; step <= 20 && contrastRatio(out, background) < min; step++) {
    const t = step / 20;
    out = rgbToHex([0, 1, 2].map((i) => start[i] + (target[i] - start[i]) * t) as [number, number, number]);
  }
  return out;
}

/**
 * Black or white, whichever reads better on `background` (#RRGGBB, or #RRGGBBAA where the alpha is ignored).
 * Use for text and icons sitting ON the profile color (buttons, badges, pills).
 */
export function readableTextOn(background: string): "#000000" | "#FFFFFF" {
  const hex = background.slice(0, 7);
  if (!HEX_RE.test(hex)) return "#000000";
  return contrastRatio(hex, "#000000") >= contrastRatio(hex, "#FFFFFF") ? "#000000" : "#FFFFFF";
}

/** The shape to SEND when saving a color. `v: 2` tells the backend this app understands wheel colors. */
export function toColorPayload(spec: BrandColorSpec) {
  return spec.type === "custom" ? { type: "custom" as const, hex: spec.hex, v: 2 as const } : { type: spec.type, id: spec.id, v: 2 as const };
}
