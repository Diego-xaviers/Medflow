import type { Metadata } from 'next'
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
