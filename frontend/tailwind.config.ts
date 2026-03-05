import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          50: '#faf7f5',
          100: '#f0ebe6',
          200: '#e5ddd6',
          300: '#ddcdc4',
          400: '#c69f87',
          500: '#966056',
          600: '#69494a',
          700: '#4a3233',
        },
        sidebar: {
          DEFAULT: '#ffffff',
          text: '#6b7280',
          hover: '#1a1a1a',
          active: '#1a1a1a',
          muted: '#9ca3af',
          border: '#f0f0f0',
          'hover-bg': 'rgba(0, 0, 0, 0.03)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      maxWidth: {
        '5xl': '64rem',
      },
    },
  },
  plugins: [],
};
export default config;
