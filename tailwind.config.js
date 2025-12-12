/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      theme: {
        screens: {
          xs: '475px',
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1280px',
          '2xl': '1536px',
        },
      },
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