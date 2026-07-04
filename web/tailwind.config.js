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
      },
      fontFamily: {
        sans: 'var(--font-sans)',
      },
    },
  },
  plugins: [],
}
