import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { telasEfetivas } from './permissoes'
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
    async jwt({ token, user, trigger }) {
      if (user) {
        token.papel = (user as any).papel
        token.consultorioId = (user as any).consultorioId
        // Sem `sincronizadoEm`: o bloco abaixo roda já no login e calcula
        // telas efetivas (com o teto do gestor) e a rede.
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
            redeId: true,
            consultorioId: true,
            consultorio: {
              select: { nome: true, slug: true, plano: true, tetosAcesso: { select: { papel: true, telas: true } } },
            },
          },
        })

        if (!atual || !atual.ativo) {
          // Conta desativada: sem consultório nem rede, toda rota de dados recusa.
          token.consultorioId = null
          token.redeId = null
          token.plano = null
          token.telas = []
        } else {
          const teto = atual.consultorio?.tetosAcesso.find((t) => t.papel === atual.papel)?.telas ?? null
          token.name = atual.nome
          token.email = atual.email
          token.papel = atual.papel
          token.telas = telasEfetivas(atual.papel, atual.telas, teto)
          token.redeId = atual.redeId
          token.consultorioId = atual.consultorioId
          token.consultorioNome = atual.consultorio?.nome ?? null
          token.consultorioSlug = atual.consultorio?.slug ?? null
          token.plano = atual.consultorio?.plano ?? null
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
        session.user.telas = token.telas ?? null
        session.user.redeId = token.redeId ?? null
        session.user.plano = token.plano ?? null
      }
      return session
    },
  },
}

export function getSessao() {
  return getServerSession(authOptions)
}
