import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

/**
 * Inter com os pesos que realmente usamos. O next/font baixa e serve a fonte
 * do nosso próprio domínio — sem requisição ao Google em runtime, sem aquele
 * "pisca" de fonte trocando ao carregar.
 *
 * A escala de pesos do projeto:
 *   300 light     → números grandes de KPI, títulos de destaque
 *   400 regular   → texto corrido
 *   500 medium    → labels, itens de navegação
 *   600 semibold  → títulos de seção e ênfase
 */
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--fonte-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Medflow — Gestão Clínica',
  description: 'Sistema de gestão para clínicas e óticas',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icone.svg', apple: '/icone.svg' },
}

/**
 * Sem o viewport, o celular renderiza a página com largura de desktop e
 * encolhe tudo — que é exatamente a aparência "pixelada e quebrada" de antes.
 */
export const viewport: Viewport = {
  themeColor: '#2b9878',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
