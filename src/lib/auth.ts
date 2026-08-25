import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import type { Papel } from '@prisma/client'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },

  providers: [
    CredentialsProvider({
      name: 'credenciais',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        senha: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.senha) return null

        const usuario = await prisma.usuario.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { consultorio: true },
        })

        // Mesma resposta para "não existe" e "senha errada": não entregamos
        // a um atacante a informação de quais e-mails estão cadastrados.
        if (!usuario || !usuario.ativo) return null
        if (usuario.consultorio && !usuario.consultorio.ativo) return null

        const senhaConfere = await bcrypt.compare(credentials.senha, usuario.senhaHash)
        if (!senhaConfere) return null

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          papel: usuario.papel,
          consultorioId: usuario.consultorioId,
          consultorioNome: usuario.consultorio?.nome ?? null,
          consultorioSlug: usuario.consultorio?.slug ?? null,
        } as any
      },
    }),
  ],

  callbacks: {
    // O consultorioId entra no token aqui e é a única fonte de verdade sobre
    // "de quem são estes dados". O cliente nunca consegue forjar isso mandando
    // um id no corpo da requisição.
    async jwt({ token, user, trigger }) {
      if (user) {
        token.papel = (user as any).papel
        token.consultorioId = (user as any).consultorioId
        token.consultorioNome = (user as any).consultorioNome
        token.consultorioSlug = (user as any).consultorioSlug
      }

      // Disparado por `useSession().update()` — usado quando a pessoa edita o
      // próprio perfil ou o nome do consultório. Sem isto, o cabeçalho e a
      // barra lateral seguiriam com o nome antigo até o próximo login.
      if (trigger === 'update' && token.sub) {
        const atual = await prisma.usuario.findUnique({
          where: { id: token.sub },
          select: {
            nome: true,
            email: true,
            papel: true,
            consultorioId: true,
            consultorio: { select: { nome: true, slug: true } },
          },
        })
        if (atual) {
          token.name = atual.nome
          token.email = atual.email
          token.papel = atual.papel
          token.consultorioId = atual.consultorioId
          token.consultorioNome = atual.consultorio?.nome ?? null
          token.consultorioSlug = atual.consultorio?.slug ?? null
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string
        session.user.papel = token.papel as Papel
        session.user.consultorioId = token.consultorioId as string | null
        session.user.consultorioNome = token.consultorioNome as string | null
        session.user.consultorioSlug = token.consultorioSlug as string | null
      }
      return session
    },
  },
}

export function getSessao() {
  return getServerSession(authOptions)
}
