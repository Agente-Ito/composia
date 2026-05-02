import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 🔥 Brand base
        background: "#0A0A0F",
        surface: "#11121A",
        line: "#1A1C23",
        text: "#EDEFF6",

        primary: "#7B61FF",
        secondary: "#A78BFA",

        muted: "#6B7280",

        // 🧠 Design system (opcional pero útil)
        ds: {
          bg: "#0A0A0F",
          surface: "#11121A",
          elev: "#161720",
          line: "#1A1C23",
          text: "#EDEFF6",
          muted: "#4A4E62",
          primary: "#7B61FF",
          secondary: "#A78BFA",
        },

        // 🚀 Composia extended (puedes usar luego)
        composia: {
          cyan: "#00D4FF",
          electric: "#0099CC",
          green: "#00FF88",
          amber: "#FFC033",
          red: "#FF4060",
          dark: "#000000",
          void: "#050508",
          surface: "#080b12",
          border: "#0d1a24",
          dim: "#0a1520",
          text: "#c8e6ea",
          muted: "#4a6670",
          purple: "#605CFF",
          violet: "#9676FF",
          lavender: "#EDE7FF",
          card: "#080b12",
          gold: "#FFC033",
        },
      },

      borderRadius: {
        xl: "14px",
      },

      fontFamily: {
        grotesk: ["Space Grotesk", "sans-serif"],
        body: ["Sora", "sans-serif"],
      },

      animation: {
        "moth-pulse": "moth-pulse 3s ease-in-out infinite",
        "node-glow": "node-glow 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
      },

      keyframes: {
        "moth-pulse": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        "node-glow": {
          "0%, 100%": { filter: "drop-shadow(0 0 2px #7B85E6)" },
          "50%": { filter: "drop-shadow(0 0 7px #7B85E6)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;