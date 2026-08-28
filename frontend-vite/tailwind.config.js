/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#101729',
          900: '#141f38',
          850: '#0d1730',
          800: '#3b4b75',
          700: '#1a2a52',
        },
        brand: {
          50: '#f4eeff',
          100: '#dbe6fe',
          200: '#dcbffe',
          300: '#93b4fd',
          400: '#5f8cf9',
          500: '#3b66f4',
          600: '#2549e9',
          700: '#555c8b',
          800: '#6c78cf',
          900: '#0e1542',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.04), 0 8px 40px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};