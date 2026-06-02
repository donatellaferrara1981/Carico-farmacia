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
        forest: {
          DEFAULT: '#1f3d2b',
          soft: '#2d5a3d',
          tint: '#e8f0eb',
        },
        bg: {
          DEFAULT: '#faf6ef',
          soft: '#f3ede3',
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
        line: '#ddd8cf',
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
