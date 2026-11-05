/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
        },
        primary: {
          DEFAULT: '#059669',
          hover: '#047857',
          light: '#E6F7ED',
          subtle: '#ECFDF5',
        },
        dark: {
          bg: '#0F172A',
          card: '#111827',
          surface: '#1F2937',
          border: '#374151',
        },
        light: {
          bg: '#F8FAF9',
          card: '#FFFFFF',
          border: '#E5E7EB',
          subtle: '#F3F4F6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: "0 2px 10px -2px rgba(0, 0, 0, 0.05), 0 1px 3px -1px rgba(0, 0, 0, 0.03)",
        glow: "0 0 25px -5px rgba(5, 150, 105, 0.3)",
        "glow-lg": "0 0 35px -5px rgba(5, 150, 105, 0.4)",
      }
    },
  },
  plugins: [],
}

