/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--bg) / <alpha-value>)',
        foreground: 'rgb(var(--fg) / <alpha-value>)',
        head: 'rgb(var(--head) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--mut) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        bd: 'rgb(var(--bd) / <alpha-value>)',
        navy: 'rgb(var(--navy) / <alpha-value>)',
        brand: 'rgb(var(--blue) / <alpha-value>)',
        teal: 'rgb(var(--teal) / <alpha-value>)',
        soft: 'rgb(var(--soft) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', '"Noto Sans Devanagari"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
