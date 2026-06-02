/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // Couleurs officielles SONABHY (extraites du logo)
        primary: {
          50: '#fee2e2',
          100: '#fecaca',
          200: '#fca5a5',
          300: '#f87171',
          400: '#f14d52',
          500: '#E31E24', // Rouge SONABHY principal
          600: '#b91c1c',
          700: '#991b1b',
          800: '#7f1d1d',
          900: '#5c1717',
        },
        secondary: {
          50: '#e6f7ed',
          100: '#b3e6cc',
          200: '#80d6aa',
          300: '#4dc589',
          400: '#26b567',
          500: '#00A651', // Vert SONABHY principal
          600: '#008542',
          700: '#006432',
          800: '#004323',
          900: '#002213',
        },
        success: {
          DEFAULT: '#10b981',
          dark: '#059669',
        },
        danger: {
          DEFAULT: '#E31E24',
          dark: '#b91c1c',
        },
        warning: {
          DEFAULT: '#f59e0b',
          dark: '#d97706',
        },
        info: {
          DEFAULT: '#3b82f6',
          dark: '#2563eb',
        },
        dark: {
          DEFAULT: '#1f2937',
          light: '#374151',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 20px -2px rgba(0, 0, 0, 0.1), 0 15px 30px -5px rgba(0, 0, 0, 0.08)',
        'hard': '0 10px 40px -5px rgba(0, 0, 0, 0.2), 0 20px 50px -10px rgba(0, 0, 0, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}