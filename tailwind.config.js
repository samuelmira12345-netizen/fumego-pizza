/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './lib/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#F2A800',
        dark: {
          bg:      '#080600',
          card:    '#1C1500',
          surface: '#111827',
        },
      },
    },
  },
  plugins: [],
};
