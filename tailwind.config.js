/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        fumego: {
          gold: '#D4A528',
          'gold-light': '#E8C547',
          'gold-dark': '#B8901E',
          amber: '#F5A623',
          black: '#1A1A1A',
          dark: '#2D2D2D',
          cream: '#FFF8E7',
        },
      },
    },
  },
  plugins: [],
};
