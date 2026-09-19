/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6ff',
          200: '#bdd2ff',
          300: '#8fb2ff',
          400: '#5a88fb',
          500: '#3563f6',
          600: '#2247e8',
          700: '#1c37cf',
          800: '#1d30a8',
          900: '#1d2d84',
          950: '#161f50'
        },
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5d9e2',
          300: '#b1b9c9',
          400: '#8691a9',
          500: '#66718c',
          600: '#515a74',
          700: '#434a5e',
          800: '#3a4051',
          900: '#262a36',
          950: '#15171f'
        }
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)',
        pop: '0 12px 32px -8px rgba(16,24,40,.22)',
        glow: '0 0 0 1px rgba(53,99,246,.25), 0 8px 24px -6px rgba(53,99,246,.45)'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif']
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        'sheet-up': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'none' } },
        'pop-in': { '0%': { opacity: 0, transform: 'scale(.96)' }, '100%': { opacity: 1, transform: 'none' } },
        'scan': { '0%': { transform: 'translateY(-60%)' }, '100%': { transform: 'translateY(260%)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'ping-slow': { '0%': { transform: 'scale(1)', opacity: '.55' }, '100%': { transform: 'scale(2.2)', opacity: 0 } }
      },
      animation: {
        'fade-up': 'fade-up .28s ease-out both',
        'sheet-up': 'sheet-up .3s cubic-bezier(.22,1,.36,1) both',
        'pop-in': 'pop-in .18s ease-out both',
        scan: 'scan 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        'ping-slow': 'ping-slow 2s cubic-bezier(0,0,.2,1) infinite'
      }
    }
  },
  plugins: []
};
