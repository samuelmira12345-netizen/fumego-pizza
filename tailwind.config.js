/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        fumego: {
          gold: '#D4A528',
          'gold-light': '#E8C547',
          'gold-dark': '#B8901E',
          black: '#1A1A1A',
          dark: '#2D2D2D',
          cream: '#FFF8E7',
        },
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
        body: ['Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
