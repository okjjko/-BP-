/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'plant-green': '#4CAF50',
        'zombie-purple': '#9C27B0',
        'ban-red': '#f44336',
        'pick-blue': '#2196F3'
      }
    },
  },
  plugins: [],
}
