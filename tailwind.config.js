/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        fg: "var(--fg)",
        card: "var(--card)",
        muted: "var(--muted)",
        border: "var(--border)",
        accent: "var(--accent)",
        accentFg: "var(--accent-fg)",
      },
    },
  },
  plugins: [],
};
