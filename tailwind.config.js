/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forge: {
          // Channels live in CSS variables (see index.css) so themes can swap
          // them at runtime while Tailwind opacity modifiers keep working.
          bg: 'rgb(var(--forge-bg) / <alpha-value>)',
          panel: 'rgb(var(--forge-panel) / <alpha-value>)',
          panel2: 'rgb(var(--forge-panel2) / <alpha-value>)',
          border: 'rgb(var(--forge-border) / <alpha-value>)',
          gold: 'rgb(var(--forge-gold) / <alpha-value>)',
          goldDim: 'rgb(var(--forge-gold-dim) / <alpha-value>)',
          blood: 'rgb(var(--forge-blood) / <alpha-value>)',
          parchment: 'rgb(var(--forge-parchment) / <alpha-value>)',
          ink: 'rgb(var(--forge-ink) / <alpha-value>)',
          onAccent: 'rgb(var(--forge-onaccent) / <alpha-value>)',
        },
      },
      fontFamily: {
        medieval: ['MedievalSharp', 'Cinzel', 'serif'],
        serif: ['Cinzel', 'Georgia', 'serif'],
        mono: ['Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        gold: '0 0 12px rgb(var(--forge-gold) / 0.35)',
      },
    },
  },
  plugins: [],
}
