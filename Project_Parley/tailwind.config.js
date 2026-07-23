/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0a0a0a", soft: "#141414", mid: "#1a1a1a", line: "#222222" },
        surface: { DEFAULT: "#161616", 2: "#222222", 3: "#2a2a2a" },
        muted: { DEFAULT: "#8d8d8d", soft: "#b6b6b6" },
        line: { DEFAULT: "rgba(255,255,255,.1)", soft: "rgba(255,255,255,.06)" },
        accent: { DEFAULT: "#b15f2c", from: "#cf8047", to: "#97501f" },
      },
      fontFamily: { sans: ["Onest", "system-ui", "sans-serif"] },
      borderRadius: { card: "2rem", "card-sm": "1.25rem", control: "0.875rem" },
    },
  },
  plugins: [],
};
