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
        apertado:  '-0.02em',
        comprimido: '-0.035em',
        forte:      '-0.05em',
      },
      fontWeight: {
        extrabold: '800',
      },
      colors: {
        // ZipPay green — vibrante, usado com parcimônia como único acento
        brand: {
          50:  '#eafff5',
          100: '#c6fde4',
          200: '#8df9cb',
          300: '#47eeaa',
          400: '#18e28d',
          500: '#00DC82',  // cor exata ZipPay
          600: '#00b368',
          700: '#008c52',
          800: '#006e40',
          900: '#005535',
          950: '#002b1c',
        },
        // Cinzas neutros puros — zero tom de cor, exatamente como ZipPay
        neutro: {
          50:  '#f7f7f7',
          100: '#f0f0f0',
          200: '#e4e4e4',
          300: '#d0d0d0',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
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
        /* Palavra que chega desfocada e assenta. É a entrada do título da
           vitrine, aplicada palavra a palavra com `animation-delay`. */
        surgir: {
          from: { opacity: '0', transform: 'translateY(14px)', filter: 'blur(10px)' },
          to: { opacity: '1', transform: 'none', filter: 'blur(0)' },
        },
        /* Esteira infinita. Anda metade da faixa porque o conteúdo é
           duplicado: ao chegar em -50% o segundo bloco está exatamente onde
           o primeiro começou, e o corte não aparece. */
        esteira: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        brilho: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        entrar: 'entrar .4s cubic-bezier(.16,1,.3,1) both',
        brilho: 'brilho 1.6s infinite',
        surgir: 'surgir .8s cubic-bezier(.16,1,.3,1) both',
        esteira: 'esteira 42s linear infinite',
        'esteira-rapida': 'esteira 28s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
