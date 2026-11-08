import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Palette ripresa dall'icona dell'app: blu profondo e turchese.
        // (il nome "forest" resta per compatibilità con le classi già usate)
        forest: {
          DEFAULT: '#0a4d7a',
          soft: '#127c93',
          tint: '#e3f1f5',
        },
        // Verde riservato ai significati di stato "ok / completato"
        ok: {
          DEFAULT: '#2f7d4f',
          tint: '#e6f4ea',
        },
        bg: {
          DEFAULT: '#f4f8fa',
          soft: '#e9f1f5',
          card: '#ffffff',
        },
        ink: {
          DEFAULT: '#1c1c1c',
          soft: '#5a5a5a',
          mute: '#9a9a9a',
        },
        abx: {
          DEFAULT: '#c0392b',
          soft: '#fdf0ee',
        },
        line: '#d5e0e6',
        amber: {
          DEFAULT: '#b8842a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
