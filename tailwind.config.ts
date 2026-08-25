import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--fonte-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        // Números grandes ficam melhores levemente apertados
        apertado: '-0.02em',
      },
      colors: {
        // Verde da marca, mais dessaturado que antes — menos "verde néon",
        // mais próximo do tom sóbrio das referências.
        brand: {
          50: '#f0faf6',
          100: '#daf2e7',
          200: '#b7e4d1',
          300: '#86cfb4',
          400: '#4fb392',
          500: '#2b9878',
          600: '#1d7a61',
          700: '#186250',
          800: '#164e41',
          900: '#134036',
        },
        // Cinzas com um leve toque quente, para não ficar "azulado de Bootstrap"
        neutro: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e8e8ea',
          300: '#d3d3d7',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#0e0e10',
        },
      },
      boxShadow: {
        // Sombras suaves e em camadas — o segredo do visual "caro"
        suave: '0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px 0 rgb(0 0 0 / 0.04)',
        media: '0 2px 4px -1px rgb(0 0 0 / 0.04), 0 4px 12px -2px rgb(0 0 0 / 0.06)',
        alta: '0 8px 16px -4px rgb(0 0 0 / 0.08), 0 16px 32px -8px rgb(0 0 0 / 0.10)',
      },
      keyframes: {
        entrar: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
        brilho: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        entrar: 'entrar .4s cubic-bezier(.16,1,.3,1) both',
        brilho: 'brilho 1.6s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
