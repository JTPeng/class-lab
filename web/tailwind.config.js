import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 主题化色板：色阶数值由 CSS 变量（RGB 通道三元组）提供，具体取值见 src/index.css。
        // 用 rgb(var(...) / <alpha-value>) 而不是裸的 var(...)，是为了保留 Tailwind
        // 的透明度修饰符（如 bg-cream/95、bg-stone-900/40）——裸十六进制字符串的
        // var() 值会让 Tailwind 无法为其生成透明度变体。
        brand: {
          50: 'rgb(var(--color-brand-50) / <alpha-value>)',
          100: 'rgb(var(--color-brand-100) / <alpha-value>)',
          200: 'rgb(var(--color-brand-200) / <alpha-value>)',
          300: 'rgb(var(--color-brand-300) / <alpha-value>)',
          400: 'rgb(var(--color-brand-400) / <alpha-value>)',
          500: 'rgb(var(--color-brand-500) / <alpha-value>)',
          600: 'rgb(var(--color-brand-600) / <alpha-value>)',
          700: 'rgb(var(--color-brand-700) / <alpha-value>)',
          800: 'rgb(var(--color-brand-800) / <alpha-value>)',
          900: 'rgb(var(--color-brand-900) / <alpha-value>)',
        },
        cream: 'rgb(var(--color-cream) / <alpha-value>)',
        // 只有 900（标题强调色）主题化，其余沿用 Tailwind 默认中性灰阶
        stone: {
          ...colors.stone,
          900: 'rgb(var(--color-text-strong) / <alpha-value>)',
        },
        // 功能色柔化覆盖：全站散落的 bg-rose-50 / text-emerald-700 等类名无需改名，
        // 颜色自动降饱和、偏暖，贴合治愈风格。未列出的默认色板（slate/purple 等）不受影响。
        amber: {
          50: '#fdf6e9',
          100: '#faebcf',
          200: '#f3d9a0',
          300: '#eac073',
          400: '#dfa84c',
          500: '#d2922f',
          600: '#b77820',
          700: '#93601c',
          800: '#714b1b',
          900: '#573d1b',
        },
        rose: {
          50: '#fbf1ef',
          100: '#f6e1dd',
          200: '#edc3bc',
          300: '#e1a197',
          400: '#d27f73',
          500: '#c16357',
          600: '#a54f45',
          700: '#834039',
          800: '#63332f',
          900: '#472925',
        },
        red: {
          50: '#fbefec',
          100: '#f6dcd5',
          200: '#ebb3a5',
          300: '#dd8874',
          400: '#cb5f49',
          500: '#b84a33',
          600: '#983a28',
          700: '#792f21',
          800: '#5c271e',
          900: '#431f19',
        },
        emerald: {
          50: '#f1f7f1',
          100: '#deebe0',
          200: '#b9d6be',
          300: '#92bf9b',
          400: '#6ea97b',
          500: '#4f9260',
          600: '#3e7a4e',
          700: '#33623f',
          800: '#2a4e34',
          900: '#223f2a',
        },
        green: {
          50: '#f3f7f0',
          100: '#e1ebd8',
          200: '#c2d8af',
          300: '#a2c388',
          400: '#85ad68',
          500: '#6c9650',
          600: '#567b40',
          700: '#466335',
          800: '#394f2c',
          900: '#2e4024',
        },
        blue: {
          50: '#f1f4fa',
          100: '#dce4f2',
          200: '#b5c6e4',
          300: '#8ca6d4',
          400: '#7089c2',
          500: '#5e7fbb',
          600: '#4c68a0',
          700: '#3f5583',
          800: '#354566',
          900: '#2c3a52',
        },
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
      },
      transitionTimingFunction: {
        'bounce-soft': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
