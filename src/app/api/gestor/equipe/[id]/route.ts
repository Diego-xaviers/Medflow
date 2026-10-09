import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirGestor } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { TELAS_CONFIGURAVEIS } from '@/lib/permissoes'
import { registrarAuditoria } from '@/lib/auditoria'

type Params = { params: { id: string } }

const ajusteSchema = z.object({
  ativo: z.boolean().optional(),
  atendePacientes: z.boolean().optional(),
  telas: z.array(z.string().refine((t) => TELAS_CONFIGURAVEIS.some((c) => c.href === t), 'Tela inválida')).optional(),
})

/**
 * Gestor desativa, reativa e ajusta funcionários das unidades da rede. O
 * dono de cada clínica fica de fora: dono não é funcionário do gestor.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  return rota(async () => {
    const ctx = await exigirGestor()
    const dados = ajusteSchema.parse(await req.json())

    const alvo = await prisma.usuario.findFirst({
      where: { id: params.id, consultorioId: { in: ctx.todas } },
      select: { id: true, nome: true, papel: true, consultorioId: true },
    })
    if (!alvo) throw new ErroDeNegocio('Usuário não encontrado na sua rede')
    if (alvo.papel === 'DONO') throw new ErroDeNegocio('O dono da clínica não é gerido pelo gestor')

    const atualizado = await prisma.usuario.update({
      where: { id: alvo.id },
      data: dados,
      select: { id: true, nome: true, ativo: true, atendePacientes: true, telas: true },
    })

    registrarAuditoria({
      acao: 'EDITAR',
      entidade: 'Usuario',
      entidadeId: alvo.id,
      detalhes: `Gestor (${ctx.nome}) alterou ${alvo.nome}: ${JSON.stringify(dados)}`,
      usuarioId: ctx.usuarioId,
      consultorioId: alvo.consultorioId,
    })
    return atualizado
  })
}
