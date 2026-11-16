import type { Papel, Plano } from '@prisma/client'
import 'next-auth'

// Estende os tipos do NextAuth para que session.user.consultorioId
// seja reconhecido pelo TypeScript em todo o projeto.
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      papel: Papel
      consultorioId: string | null
      consultorioNome: string | null
      consultorioSlug: string | null
      rememberMe: boolean
      /** Telas efetivas; null = padrão do papel. */
      telas: string[] | null
      redeId: string | null
      /** Plano do consultório da sessão; null para super admin e gestor. */
      plano: Plano | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    papel?: Papel
    consultorioId?: string | null
    consultorioNome?: string | null
    consultorioSlug?: string | null
    rememberMe?: boolean
    loginAt?: number
    telas?: string[] | null
    redeId?: string | null
    plano?: Plano | null
    sincronizadoEm?: number
  }
}
