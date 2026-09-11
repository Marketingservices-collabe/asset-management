import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
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
