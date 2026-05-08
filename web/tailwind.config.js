/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B1422',
        surface: '#111D2E',
        surface2: '#162030',
        primary: '#2980B9',
        'primary-l': '#5DADE2',
        t1: '#C8D8EA',
        t2: '#6B82A0',
        t3: '#3F5268',
        normal: '#1E8449',
        moderate: '#B7950B',
        severe: '#A04000',
        extreme: '#7B241C',
      },
      fontFamily: {
        mono: ['"Fira Code"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
