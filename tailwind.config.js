/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#8B5CF6', // Vibrant purple
        secondary: '#1E1B2E', // Dark purple-black
        background: '#121212',
        surface: '#2D2A3F', // Slightly purple-tinted dark surface
      },
    },
  },
  plugins: [],
}; 