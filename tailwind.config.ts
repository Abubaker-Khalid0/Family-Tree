import type { Config } from "tailwindcss";

/**
 * Tailwind CSS Configuration
 *
 * Design tokens for the monochrome Arabic family tree application.
 * In Tailwind v4 with the @tailwindcss/vite plugin, most configuration
 * is handled via @theme in globals.css. This file serves as a reference
 * and for any plugin-based extensions.
 */
const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        black: "#000000",
        white: "#ffffff",
        gray: {
          muted: "#6b6b6b",
          border: "#d8d8d8",
          light: "#f2f2f2",
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', "Tahoma", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
        pill: "999px",
      },
      spacing: {
        sibling: "16px",
        container: "12px",
      },
      fontSize: {
        body: "12px",
        heading: "18px",
      },
      borderWidth: {
        DEFAULT: "2px",
        highlight: "3px",
      },
    },
  },
  plugins: [],
};

export default config;
