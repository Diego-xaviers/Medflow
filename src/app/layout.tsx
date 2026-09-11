import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'
import CookieBanner from '@/components/CookieBanner'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
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
  themeColor: '#00DC82',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={jakarta.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  )
}
