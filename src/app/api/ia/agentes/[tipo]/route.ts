import { z } from 'zod'
import { rota } from '@/lib/api'
import { salvarSecao, tipoAgente } from '@/lib/agentesServidor'
import { exigirAssistente } from '../../acesso'

export async function PATCH(req: Request, { params }: { params: { tipo: string } }) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirAssistente()
    const tipo = tipoAgente.parse(params.tipo)
    const { secao, dados } = z.object({ secao: z.string(), dados: z.unknown() }).parse(await req.json())
    return salvarSecao(consultorioId, tipo, secao, dados, usuarioId)
  })
}
