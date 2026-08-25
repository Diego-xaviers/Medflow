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
