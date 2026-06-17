import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        elekeza: {
          "deep-blue": "#1E3A8A",
          "indigo": "#4F46E5",
          "sky": "#EFF6FF",
          "sand": "#FFF7ED",
        },
      },
    },
  },
  plugins: [],
};
export default config;
