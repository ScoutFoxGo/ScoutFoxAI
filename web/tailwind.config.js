/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        fox: {
          DEFAULT: "#E8662A", // ScoutFox terracotta/amber
          dark: "#C24E1A",
          light: "#FBE7DA",
        },
      },
    },
  },
  plugins: [],
};
