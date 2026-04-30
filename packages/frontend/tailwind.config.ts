import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Canonical tokens — mirrors lib/tokens.ts. Brand Guideline v1.0.
        ds: {
          bg:        "#0A0A0F",   // Background   — brand §3
          surface:   "#11121A",   // Surface      — brand §3
          elev:      "#161720",   // elevated / nested (one step above surface)
          line:      "#1A1C23",   // Line         — brand §3
          text:      "#EDEFF6",   // Text/Note    — brand §3
          muted:     "#4A4E62",   // secondary labels
          primary:   "#7B61FF",   // Primary      — brand §3 (purple = state/activity)
          secondary: "#A78BFA",   // Secondary    — brand §3
        },
        composia: {
          cyan:     "#00D4FF",   // glow principal
          electric: "#0099CC",   // secondary / links
          green:    "#00FF88",   // score alto (≥ 90)
          amber:    "#FFC033",   // score medio / umbral
          red:      "#FF4060",   // score bajo / error
          dark:     "#000000",   // fondo negro absoluto
          void:     "#050508",   // fondo cards
          surface:  "#080b12",   // superficies elevadas
          border:   "#0d1a24",   // bordes
          dim:      "#0a1520",   // hover states
          text:     "#c8e6ea",   // texto principal
          muted:    "#4a6670",   // texto secundario
          // legacy aliases (used in demo/agent pages – keep so they compile)
          purple:   "#605CFF",
          violet:   "#9676FF",
          lavender: "#EDE7FF",
          card:     "#080b12",
          gold:     "#FFC033",
        },
      },
      fontFamily: {
        sora:    ["Space Grotesk", "sans-serif"],
        grotesk: ["Space Grotesk", "sans-serif"],
        body:    ["Sora", "sans-serif"],
      },
      animation: {
        "moth-pulse":  "moth-pulse 3s ease-in-out infinite",
        "node-glow":   "node-glow 2s ease-in-out infinite",
        "float":       "float 6s ease-in-out infinite",
        "float-slow":  "float 9s ease-in-out infinite",
        "live-pulse":  "live-pulse 1.5s ease-in-out infinite",
        "fade-in-up":  "fade-in-up 0.4s ease forwards",
        "scan-line":   "scan-line 4s linear infinite",
      },
      keyframes: {
        "moth-pulse": {
          "0%, 100%": { opacity: "0.55" },
          "50%":       { opacity: "1" },
        },
        "node-glow": {
          "0%, 100%": { filter: "drop-shadow(0 0 2px #7B61FF)" },
          "50%":       { filter: "drop-shadow(0 0 6px #A78BFA)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":       { transform: "translateY(-8px)" },
        },
        "live-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.3" },
        },
        "fade-in-up": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scan-line": {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
