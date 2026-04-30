// Composia Design Tokens — Brand Guideline v1.0
// Source: brand-guideline.png, Section 3 Color Palette + Section 4 Typography
// These are the canonical values. Tailwind ds-* tokens must mirror this file.

// ── Colors ────────────────────────────────────────────────────────────────────

export const colors = {
  // Backgrounds — section 3
  bg:       "#0A0A0F",   // Background     — deepest layer
  surface:  "#11121A",   // Surface        — cards, panels
  line:     "#1A1C23",   // Line           — borders, dividers

  // Text — section 3
  text:     "#EDEFF6",   // Text / Note    — primary readable content
  muted:    "#4A4E62",   // implied        — labels, secondary info

  // Purple — section 3 + section 7
  primary:   "#7B61FF",  // Primary        — CTAs, active state, data activity
  secondary: "#A78BFA",  // Secondary      — hover, supporting elements
} as const;

export type ColorKey = keyof typeof colors;

// ── Typography ────────────────────────────────────────────────────────────────
// Section 4: Space Grotesk (headers + key UI), Sora (body + long content)

export const fonts = {
  heading: "'Space Grotesk', sans-serif",
  body:    "'Sora', sans-serif",
} as const;

export const fontWeight = {
  light:    300,
  regular:  400,
  medium:   500,  // brand emphasis weight — section 4 underline
  semibold: 600,
  bold:     700,
} as const;

// ── Spacing ───────────────────────────────────────────────────────────────────
// 4-pt base grid

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

// ── Border radius ─────────────────────────────────────────────────────────────
// Section 7 UI Components — cards and buttons show consistent rounding

export const radius = {
  sm:   8,
  md:  12,
  lg:  16,
  pill: 999,
} as const;

// ── Animation ─────────────────────────────────────────────────────────────────
// Section 6 Animation Principles: Pulse, Flow, Distribution
// Subtle. Purposeful. Never distracting.

export const animation = {
  pulse:    "3.2s ease-in-out infinite",   // active node breathes softly
  flow:     "2.4s linear infinite",        // data moves through connections
  float:    "8s ease-in-out infinite",     // moth hero drift
} as const;

// ── Semantic aliases ──────────────────────────────────────────────────────────
// Map brand intent → token (use these in components, not raw hex)

export const semantic = {
  bgPage:      colors.bg,
  bgCard:      colors.surface,
  border:      colors.line,
  textPrimary: colors.text,
  textMuted:   colors.muted,
  active:      colors.primary,    // purple = state / activity (brand rule: not decoration)
  supporting:  colors.secondary,
} as const;
