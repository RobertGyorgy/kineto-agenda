/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      colors: {
        brand: {
          primary: 'rgb(var(--color-brand-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-brand-secondary) / <alpha-value>)',
          accent: 'rgb(var(--color-brand-accent) / <alpha-value>)',
        },
        surface: {
          base: 'rgb(var(--color-surface-base) / <alpha-value>)',
          card: 'rgb(var(--color-surface-card) / <alpha-value>)',
          panel: 'rgb(var(--color-surface-panel) / <alpha-value>)',
          dark: 'rgb(var(--color-surface-dark) / <alpha-value>)',
        },
        text: {
          main: 'rgb(var(--color-text-main) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
          inverse: 'rgb(var(--color-text-inverse) / <alpha-value>)',
        },
        border: {
          subtle: 'rgb(var(--color-border-subtle) / <alpha-value>)',
          strong: 'rgb(var(--color-border-strong) / <alpha-value>)',
        },
        state: {
          success: 'rgb(var(--color-state-success) / <alpha-value>)',
          warning: 'rgb(var(--color-state-warning) / <alpha-value>)',
          danger: 'rgb(var(--color-state-danger) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
