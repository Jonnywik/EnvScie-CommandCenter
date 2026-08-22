import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        command: {
          ink: "#071923",
          panel: "#102b38",
          mint: "#4ee4c1",
          coral: "#f46036",
          amber: "#f7bf45",
        },
      },
      boxShadow: {
        command: "0 20px 56px rgba(1, 14, 22, 0.38)",
      },
    },
  },
  plugins: [],
};

export default config;
