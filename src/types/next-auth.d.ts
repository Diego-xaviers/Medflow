import type { Papel } from '@prisma/client'
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
      telas: string[]
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
    telas?: string[]
    /// Consultório de cadastro; o `consultorioId` pode ser outra unidade do dono.
    consultorioOrigem?: string | null
    sincronizadoEm?: number
  }
}
