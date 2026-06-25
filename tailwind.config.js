/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#080D1F',
          light: '#111933',
          lighter: '#1A2548',
        },
        neon: {
          pink: '#F25D9C',
          purple: '#7C7EFF',
          blue: '#4FB3FF',
          green: '#5EEAD4',
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'monospace'],
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-pink': '0 0 20px rgba(224, 64, 160, 0.3)',
        'glow-blue': '0 0 20px rgba(64, 96, 255, 0.3)',
        'glow-purple': '0 0 20px rgba(128, 64, 208, 0.3)',
        'glow-green': '0 0 20px rgba(94, 234, 212, 0.25)',
      },
      keyframes: {
        flicker: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.75' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(79,179,255,0.6)' },
          '100%': { boxShadow: '0 0 0 14px rgba(79,179,255,0)' },
        },
      },
      animation: {
        flicker: 'flicker 2s infinite',
        scan: 'scan 6s linear infinite',
        pulseRing: 'pulseRing 2s cubic-bezier(0.22,1,0.36,1) infinite',
      },
    },
  },
  plugins: [],
};
