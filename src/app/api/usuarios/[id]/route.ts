import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirPapel } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { notificar, equipeDoConsultorio } from '@/lib/notificacoes'

type Params = { params: { id: string } }

const ajusteSchema = z.object({
  ativo: z.boolean().optional(),
  atendePacientes: z.boolean().optional(),
})

/**
 * Ajustes na conta de um membro da equipe, feitos pelo DONO.
 *
 * O `updateMany` com o consultorioId no where é o que impede o dono de um
 * consultório mexer em usuário de outro chutando o id — o resultado seria
 * zero linhas afetadas em vez de alteração indevida.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId, usuarioId, nome } = await exigirPapel('DONO')
    const dados = ajusteSchema.parse(await req.json())

    if (params.id === usuarioId && dados.ativo === false) {
      throw new ErroDeNegocio('Você não pode desativar a própria conta')
    }

    const alvo = await prisma.usuario.findFirst({
      where: { id: params.id, consultorioId },
      select: { id: true, nome: true, papel: true },
    })
    if (!alvo) throw new ErroDeNegocio('Usuário não encontrado')

    const atualizado = await prisma.usuario.update({
      where: { id: alvo.id },
      data: dados,
      select: {
        id: true, nome: true, email: true, papel: true,
        ativo: true, atendePacientes: true, fotoUrl: true,
      },
    })

    if (dados.atendePacientes !== undefined) {
      await notificar({
        usuarioIds: await equipeDoConsultorio(consultorioId, { exceto: usuarioId }),
        consultorioId,
        tipo: 'EQUIPE',
        titulo: dados.atendePacientes
          ? `${alvo.nome} passou a atender pacientes`
          : `${alvo.nome} saiu da agenda de atendimento`,
        descricao: `Alterado por ${nome}`,
        link: '/equipe',
      })
    }

    return atualizado
  })
}

/**
 * Remove alguém da equipe.
 *
 * A conta é DESATIVADA, não apagada. Não é preguiça: quem já atendeu tem o
 * nome amarrado a consultas, prontuários e receitas, e apagar a linha levaria
 * junto o histórico clínico de pacientes reais — a relação de consulta é em
 * cascata. Desativar tira o acesso na hora e preserva o registro, que é o que
 * a LGPD e o bom senso pedem num sistema de saúde.
 *
 * Só quem nunca produziu nada pode sumir de vez, e aí `?definitivo=1` apaga.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const { consultorioId, usuarioId, nome } = await exigirPapel('DONO')
    const definitivo = req.nextUrl.searchParams.get('definitivo') === '1'

    if (params.id === usuarioId) {
      throw new ErroDeNegocio('Você não pode remover a própria conta')
    }

    const alvo = await prisma.usuario.findFirst({
      where: { id: params.id, consultorioId },
      select: {
        id: true, nome: true, papel: true, ativo: true,
        _count: { select: { consultasComoProfissional: true, receitasComoProfissional: true } },
      },
    })
    if (!alvo) throw new ErroDeNegocio('Usuário não encontrado')

    // Um consultório sem dono ativo fica inacessível: ninguém entraria para
    // reativar seja quem for.
    if (alvo.papel === 'DONO') {
      const outrosDonos = await prisma.usuario.count({
        where: { consultorioId, papel: 'DONO', ativo: true, id: { not: alvo.id } },
      })
      if (outrosDonos === 0) {
        throw new ErroDeNegocio('Este é o único dono ativo. Promova outra pessoa antes de removê-lo.')
      }
    }

    const temHistorico =
      alvo._count.consultasComoProfissional > 0 || alvo._count.receitasComoProfissional > 0

    if (definitivo && temHistorico) {
      throw new ErroDeNegocio(
        `${alvo.nome} tem atendimentos registrados. A conta pode ser desativada, mas não apagada — ` +
          'apagá-la levaria junto o histórico dos pacientes.'
      )
    }

    if (definitivo) {
      await prisma.usuario.delete({ where: { id: alvo.id } })
    } else {
      await prisma.usuario.update({
        where: { id: alvo.id },
        data: { ativo: false, atendePacientes: false },
      })
    }

    await notificar({
      usuarioIds: await equipeDoConsultorio(consultorioId, { exceto: usuarioId }),
      consultorioId,
      tipo: 'EQUIPE',
      titulo: definitivo
        ? `${alvo.nome} foi removido da equipe`
        : `${alvo.nome} teve o acesso desativado`,
      descricao: `Por ${nome}`,
      link: '/equipe',
    })

    return { ok: true, definitivo }
  })
}
