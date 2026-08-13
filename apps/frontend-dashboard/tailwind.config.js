/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'xrpl-cyan': '#00F0FF',
        'flare-coral': '#FF5A36',
      },
    },
  },
  plugins: [],
}
