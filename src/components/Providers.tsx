'use client'

import { SessionProvider } from 'next-auth/react'
import { TemaProvider } from './TemaProvider'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TemaProvider>{children}</TemaProvider>
    </SessionProvider>
  )
}
