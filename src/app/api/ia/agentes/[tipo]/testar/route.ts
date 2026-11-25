import { z } from 'zod'
import { rota } from '@/lib/api'
import { SECOES } from '@/lib/agentesIA'
import { carregarAgente, reservarTesteAgente, textoDaBase, tipoAgente } from '@/lib/agentesServidor'
import { testarAgente } from '@/lib/iaConversa'
import { prisma } from '@/lib/prisma'
import { exigirAssistente } from '../../../acesso'

const corpo = z.object({
  turnos: z.array(z.object({
    autor: z.enum(['PACIENTE', 'IA', 'EQUIPE']),
    texto: z.string().trim().min(1).max(500),
  })).min(1).max(12).refine((turnos) => turnos.at(-1)?.autor === 'PACIENTE', 'O último turno precisa ser do paciente.'),
  config: SECOES.identidade.merge(SECOES.gatilhos).partial().optional(),
})

export async function POST(req: Request, { params }: { params: { tipo: string } }) {
  return rota(async () => {
    const { consultorioId } = await exigirAssistente()
    const tipo = tipoAgente.parse(params.tipo)
    const { turnos, config } = corpo.parse(await req.json())
    await reservarTesteAgente(consultorioId)
    const [salva, conhecimento, clinica] = await Promise.all([
      carregarAgente(consultorioId, tipo),
      textoDaBase(consultorioId),
      prisma.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { nome: true } }),
    ])
    return testarAgente({ clinica: clinica.nome, config: { ...salva, ...config }, conhecimento, turnos })
  })
}
