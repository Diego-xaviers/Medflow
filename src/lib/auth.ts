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
        rememberMe: { label: 'Lembrar', type: 'text' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.senha) return null

        const email = credentials.email.toLowerCase().trim()
        // Vercel encaminha o IP real via x-forwarded-for.
        const ip =
          ((req as any)?.headers?.['x-forwarded-for'] as string)
            ?.split(',')[0]
            ?.trim() ??
          ((req as any)?.headers?.['x-real-ip'] as string) ??
          'unknown'

        const { tentativaPermitida, registrarTentativa } = await import('./rateLimit')
        if (!(await tentativaPermitida(email, ip))) {
          console.warn(`[auth] rate limit: ${email} / ${ip}`)
          return null
        }

        const usuario = await prisma.usuario.findUnique({
          where: { email },
          include: { consultorio: true },
        })

        // Mesma resposta para "não existe" e "senha errada": não entregamos
        // a um atacante a informação de quais e-mails estão cadastrados.
        if (!usuario || !usuario.ativo) {
          await registrarTentativa(email, ip)
          return null
        }
        if (usuario.consultorio && !usuario.consultorio.ativo) {
          await registrarTentativa(email, ip)
          return null
        }

        const senhaConfere = await bcrypt.compare(credentials.senha, usuario.senhaHash)
        if (!senhaConfere) {
          await registrarTentativa(email, ip)
          return null
        }

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          papel: usuario.papel,
          consultorioId: usuario.consultorioId,
          consultorioNome: usuario.consultorio?.nome ?? null,
          consultorioSlug: usuario.consultorio?.slug ?? null,
          telas: usuario.telas,
          rememberMe: credentials.rememberMe === 'true',
          loginAt: Math.floor(Date.now() / 1000),
        } as any
      },
    }),
  ],

  callbacks: {
    // O consultorioId entra no token aqui e é a única fonte de verdade sobre
    // "de quem são estes dados". O cliente nunca consegue forjar isso mandando
    // um id no corpo da requisição.
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.papel = (user as any).papel
        token.consultorioId = (user as any).consultorioId
        token.consultorioOrigem = (user as any).consultorioId
        token.telas = (user as any).telas ?? []
        token.sincronizadoEm = Date.now()
        token.consultorioNome = (user as any).consultorioNome
        token.consultorioSlug = (user as any).consultorioSlug
        token.rememberMe = (user as any).rememberMe
        token.loginAt = (user as any).loginAt
      }

      // Relê do banco quando:
      //  - `useSession().update()` é chamado (perfil editado, troca de
      //    consultório — nesse caso `session.consultorioId` traz o destino);
      //  - passou um minuto desde a última leitura. É o que faz permissões
      //    alteradas pelo dono e acessos revogados valerem sem novo login.
      const vencido = !token.sincronizadoEm || Date.now() - token.sincronizadoEm > 60_000
      if (token.sub && (trigger === 'update' || vencido)) {
        const atual = await prisma.usuario.findUnique({
          where: { id: token.sub },
          select: {
            nome: true,
            email: true,
            papel: true,
            ativo: true,
            telas: true,
            consultorioId: true,
            acessosExtras: { where: { consultorio: { ativo: true } }, select: { consultorioId: true } },
          },
        })

        if (!atual || !atual.ativo) {
          // Conta desativada: sem consultório, toda rota de dados recusa.
          token.consultorioId = null
          token.telas = []
        } else {
          const pedido = trigger === 'update' ? (session as any)?.consultorioId : undefined
          const desejado = pedido ?? token.consultorioId
          // Só vale consultório de origem ou um vinculado. Qualquer outro id
          // — forjado ou com acesso revogado — volta para a origem.
          const permitido = desejado === atual.consultorioId ||
            atual.acessosExtras.some((a) => a.consultorioId === desejado)
          const consultorioId = permitido ? desejado : atual.consultorioId

          const consultorio = consultorioId
            ? await prisma.consultorio.findUnique({ where: { id: consultorioId }, select: { nome: true, slug: true } })
            : null

          token.name = atual.nome
          token.email = atual.email
          token.papel = atual.papel
          token.telas = atual.telas
          token.consultorioOrigem = atual.consultorioId
          token.consultorioId = consultorioId
          token.consultorioNome = consultorio?.nome ?? null
          token.consultorioSlug = consultorio?.slug ?? null
        }
        token.sincronizadoEm = Date.now()
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
        session.user.rememberMe = token.rememberMe ?? false
        session.user.telas = token.telas ?? []
      }
      return session
    },
  },
}

export function getSessao() {
  return getServerSession(authOptions)
}
