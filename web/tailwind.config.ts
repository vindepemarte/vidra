import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#05070f",
        panel: "#0d1221",
        neon: "#33f5ff",
        acid: "#9bff3f",
        ember: "#ff5b2e"
      },
      boxShadow: {
        glow: "0 0 30px rgba(51,245,255,0.28)"
      }
    }
  },
  plugins: []
};

export default config;
