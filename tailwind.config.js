/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1DB954', // Spotify green
        secondary: '#191414', // Spotify black
        background: '#121212',
        surface: '#282828',
      },
    },
  },
  plugins: [],
}; 