/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        sans: ['IBM Plex Mono', 'monospace'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        chassis: '#1C2B2A',
        panel: '#233635',
        surface: '#2A3F3E',
        groove: '#344A49',
        'groove-strong': '#3F5857',
        accent: '#7ECEB3',
        'accent-hover': '#6BBD9F',
        'hw-text': '#E8E4D9',
        'hw-muted': '#8A9E97',
        'hw-dim': '#5A6E67',
        success: '#5CB893',
        danger: '#E06C6C',
      },
      boxShadow: {
        'inset-panel': 'inset 0 2px 4px rgba(0,0,0,0.3)',
        'led-mint': '0 0 6px rgba(126,206,179,0.5), 0 0 2px rgba(126,206,179,0.8)',
        'led-green': '0 0 6px rgba(92,184,147,0.5), 0 0 2px rgba(92,184,147,0.8)',
        'led-red': '0 0 6px rgba(224,108,108,0.5), 0 0 2px rgba(224,108,108,0.8)',
      },
      borderRadius: {
        hw: '4px',
      },
      animation: {
        'pulse-fast': 'pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
