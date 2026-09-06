/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        deep: {
          blue: '#0A2540',
          cyan: '#00D4AA',
          dark: '#060E1A',
          card: '#0F2B46',
          border: '#1A3A5C',
        },
        // 科研信号系统：用于区分「信号 / 验证 / 数据」三类语义
        signal: {
          50: '#fff8eb',
          100: '#fdeccb',
          200: '#fbd894',
          300: '#f7bd57',
          400: '#f2a029',
          500: '#ea8a12',
          600: '#c96d0c',
          700: '#a45110',
          800: '#843f14',
          900: '#6d3514',
        },
        validate: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        // 蓝图网格与刻度线
        lab: {
          grid: '#0d2236',
          line: '#1e3a56',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 24px rgba(0, 212, 170, 0.18), 0 0 72px rgba(0, 212, 170, 0.06)',
        'glow-blue': '0 0 24px rgba(14, 165, 233, 0.18), 0 0 72px rgba(14, 165, 233, 0.06)',
        'glow-signal': '0 0 24px rgba(234, 138, 18, 0.18), 0 0 72px rgba(234, 138, 18, 0.06)',
        'card': '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 18px 40px -24px rgba(0,0,0,0.8)',
        'card-lab': '0 0 0 1px rgba(30,58,86,0.9), 0 18px 48px -28px rgba(0,0,0,0.85), 0 0 28px -16px rgba(56,189,248,0.25)',
      },
      backgroundImage: {
        // 蓝图：细网格 + 双色径向辉光，营造实验室/仪表盘底纹
        'blueprint':
          'linear-gradient(rgba(56,189,248,0.05) 1px, transparent 1px),' +
          'linear-gradient(90deg, rgba(56,189,248,0.05) 1px, transparent 1px),' +
          'radial-gradient(ellipse at 12% -10%, rgba(0,212,170,0.10), transparent 45%),' +
          'radial-gradient(ellipse at 112% 112%, rgba(14,165,233,0.10), transparent 45%)',
        'signal-line':
          'linear-gradient(90deg, transparent, rgba(56,189,248,0.55), transparent)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'scan': 'scan 4.5s linear infinite',
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s ease-out both',
        'shimmer': 'shimmer 2.4s linear infinite',
        'float-slow': 'float 9s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.8)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
