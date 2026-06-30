import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        ide: {
          main: '#1e1e1e',
          sidebar: '#252526',
          activity: '#333333',
          panel: '#181818',
          border: '#3c3c3c',
          text: '#cccccc',
          muted: '#858585',
          accent: '#007acc'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
} satisfies Config;
