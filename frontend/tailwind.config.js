/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#F5F3EE',
        sidebar: {
          bg: '#FFFFFF',
          hover: '#FAF8F5',
          active: '#F1E4C5',
          text: '#707070',
          textActive: '#B8862D',
          border: 'rgba(45, 45, 45, 0.08)'
        },
        surface: {
          glass: 'rgba(255, 255, 255, 0.78)',
          card: '#FFFFFF',
          subtle: '#FAF8F5'
        },
        theme: {
          bg: '#F5F3EE',
          surface: 'rgba(255, 255, 255, 0.78)',
          sidebar: '#FFFFFF',
          primary: '#1C1C1C',
          secondary: '#707070',
          goldAccent: '#C79A3B',
          premiumGold: '#B8862D',
          activeMenu: '#F1E4C5',
          success: '#2E8B57',
          warning: '#D99625',
          danger: '#D9534F',
          info: '#3978B8',
          border: 'rgba(45, 45, 45, 0.08)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Outfit', 'Inter', 'sans-serif']
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem'
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(45, 45, 45, 0.05)',
        card: '0 4px 20px -2px rgba(45, 45, 45, 0.04), 0 2px 6px -1px rgba(45, 45, 45, 0.02)',
        cardHover: '0 10px 30px -4px rgba(199, 154, 59, 0.12), 0 4px 12px -2px rgba(45, 45, 45, 0.04)',
        subtle: '0 1px 3px 0 rgba(45, 45, 45, 0.05)',
        floating: '0 20px 25px -5px rgba(45, 45, 45, 0.08), 0 8px 10px -6px rgba(45, 45, 45, 0.04)'
      }
    }
  },
  plugins: []
};
