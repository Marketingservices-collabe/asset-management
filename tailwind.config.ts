import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { "fade-up": "fade-up 220ms ease-out both" },
      colors: {
        brand: {
          DEFAULT: "#ee5566",
          dark: "#d63d4e",
          fg: "#ffffff",
          muted: "#fde5e8",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
