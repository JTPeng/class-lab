/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 暖橙主色（参考 motuai.cn），语义化别名，页面内直接用 brand-* 即可
        brand: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        // 奶油底色
        cream: '#FFF7ED',
      },
      boxShadow: {
        soft: '0 8px 24px -8px rgba(234, 88, 12, 0.18)',
        card: '0 2px 10px -2px rgba(120, 53, 15, 0.08)',
      },
    },
  },
  plugins: [],
}

