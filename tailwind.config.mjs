/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        analenn: {
          primary: "#7b4a5a",
          secondary: "#946870",
          accent: "#ae8686",
          white: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};
