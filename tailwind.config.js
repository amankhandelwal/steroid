/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Space Grotesk'", 'ui-sans-serif', '-apple-system', "'Segoe UI'", 'sans-serif'],
        mono: ["'JetBrains Mono'", 'ui-monospace', "'SF Mono'", 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
