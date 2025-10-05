/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        'sidebar-border': 'var(--sidebar-border)',
        'sidebar-ring': 'var(--sidebar-ring)',
      },
      borderColor: {
        'sidebar-border': 'var(--sidebar-border)',
      },
      ringColor: {
        'sidebar-ring': 'var(--sidebar-ring)',
      },
    },
  },
  plugins: [],
};