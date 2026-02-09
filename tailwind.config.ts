import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#F5F1EB",
        parchment: "#EDE8DF",
        ink: {
          DEFAULT: "#1a1a1a",
          light: "#4a4a4a",
          faint: "#8a8a7a",
        },
        "warm-white": "#FAFAF5",
        accent: {
          DEFAULT: "#C4A87C",
          dark: "#A08050",
        },
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Georgia", "serif"],
        body: ["var(--font-eb-garamond)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains)", "Courier New", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
