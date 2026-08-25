import { prisma } from './prisma'
import type { Papel } from '@prisma/client'

/**
 * Avisos da campainha do topo.
 *
 * Duas decisões que valem explicação:
 *
 * 1. Uma linha por destinatário. Parece desperdício, mas guardar "quem já leu"
 *    de um aviso coletivo exigiria outra tabela e um join em toda leitura —
 *    caro para equipes de 3 a 10 pessoas, que é o caso real aqui.
 *
 * 2. Notificar NUNCA derruba a ação principal. Se o agendamento foi criado e o
 *    aviso falhou, o agendamento continua valendo: o erro é registrado no
 *    servidor e a vida segue. O contrário — perder a consulta porque o sino
 *    falhou — seria inaceitável.
 */

export type TipoNotificacao =
  | 'AGENDAMENTO'
  | 'CANCELAMENTO'
  | 'STATUS'
  | 'EQUIPE'
  | 'SUPORTE'
  | 'CHAMADO'

interface Aviso {
  usuarioIds: string[]
  consultorioId: string | null
  tipo: TipoNotificacao
  titulo: string
  descricao?: string
  link?: string
}

export async function notificar(aviso: Aviso): Promise<void> {
  const destinatarios = Array.from(new Set(aviso.usuarioIds)).filter(Boolean)
  if (destinatarios.length === 0) return

  try {
    await prisma.notificacao.createMany({
      data: destinatarios.map((usuarioId) => ({
        usuarioId,
        consultorioId: aviso.consultorioId,
        tipo: aviso.tipo,
        titulo: aviso.titulo,
        descricao: aviso.descricao,
        link: aviso.link,
      })),
    })
  } catch (erro) {
    console.error('[medflow] falha ao gravar notificação:', erro)
  }
}

/**
 * Quem deve saber. Por padrão devolve toda a equipe ativa do consultório;
 * `exceto` tira quem provocou o evento — ninguém precisa ser avisado do
 * próprio clique.
 */
export async function equipeDoConsultorio(
  consultorioId: string,
  opcoes: { papeis?: Papel[]; exceto?: string } = {}
): Promise<string[]> {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: {
        consultorioId,
        ativo: true,
        ...(opcoes.papeis && { papel: { in: opcoes.papeis } }),
        ...(opcoes.exceto && { id: { not: opcoes.exceto } }),
      },
      select: { id: true },
    })
    return usuarios.map((u) => u.id)
  } catch (erro) {
    console.error('[medflow] falha ao listar destinatários:', erro)
    return []
  }
}

/** O super admin, destinatário dos chamados escalados. */
export async function superAdmins(): Promise<string[]> {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { papel: 'SUPER_ADMIN', ativo: true },
      select: { id: true },
    })
    return usuarios.map((u) => u.id)
  } catch (erro) {
    console.error('[medflow] falha ao listar super admins:', erro)
    return []
  }
}
