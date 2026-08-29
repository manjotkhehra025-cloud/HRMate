import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Roboto", "Segoe UI", "Arial", "sans-serif"],
        mono: ["ui-monospace", "Segoe UI Mono", "monospace"],
      },
      colors: {
        brand: {
          50: "#E7F1FF",
          100: "#D7E9FF",
          200: "#B4D4FF",
          300: "#78B4FF",
          400: "#4B8FE8",
          500: "#1E6FE0",
          600: "#1556B8",
          700: "#124C9D",
          800: "#0A2037",
          900: "#081C33",
        },
        flow: {
          DEFAULT: "#16B878",
          deep: "#07945D",
          mid: "#258FD0",
        },
        ink: "#172334",
        muted: "#617083",
        page: "#F4F7FB",
        line: "#DDE6EF",
        navy: {
          DEFAULT: "#081C33",
          bar: "#0A2037",
          deep: "#071827",
        },
      },
      borderRadius: {
        card: "15px",
        btn: "10px",
        field: "11px",
        tile: "14px",
        chip: "9px",
        dialog: "18px",
      },
      boxShadow: {
        card: "0 1.2px 8px rgba(18, 58, 99, 0.10)",
        pop: "0 7px 24px rgba(11, 37, 69, 0.14)",
        nav: "0 -4px 16px rgba(11, 37, 69, 0.10)",
        glow: "0 10px 24px rgba(30, 111, 224, 0.28)",
        flow: "0 8px 18px rgba(22, 184, 120, 0.16)",
      },
      letterSpacing: {
        kpi: "-0.6px",
        kicker: "0.85px",
        table: "0.65px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
