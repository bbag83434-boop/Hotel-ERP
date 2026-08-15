/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f6ff',
          100: '#e0edff',
          200: '#bae0ff',
          300: '#7cc8ff',
          400: '#36a9ff',
          500: '#0088ff',
          600: '#0066d6',
          700: '#0050b0',
          800: '#034491',
          900: '#093a77',
          950: '#06254f'
        },
        sidebar: {
          bg: '#0f172a',
          hover: '#1e293b',
          active: '#2563eb',
          text: '#94a3b8',
          textActive: '#ffffff'
        },
        surface: {
          light: '#ffffff',
          dark: '#0f172a',
          cardLight: '#ffffff',
          cardDark: '#1e293b',
          mutedLight: '#f8fafc',
          mutedDark: '#334155'
        },
        apex: {
          bg: '#0c0c0e',
          gold: '#d4a437',
          card: '#17171b',
          text: '#ffffff',
          border: 'rgba(255,255,255,0.08)',
          danger: '#e5544d',
          warning: '#e5a33d',
          success: '#3fbf6f',
          info: '#4d9de5'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      borderRadius: {
        '4xl': '2rem'
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.08)',
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
        floating: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
      }
    }
  },
  plugins: []
};
