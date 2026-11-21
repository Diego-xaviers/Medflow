import { rota } from '@/lib/api'
import { apagarItemConhecimento, salvarItemConhecimento } from '@/lib/agentesServidor'
import { exigirAssistente } from '../../acesso'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirAssistente()
    return salvarItemConhecimento(consultorioId, await req.json(), usuarioId, params.id)
  })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirAssistente()
    return apagarItemConhecimento(consultorioId, params.id, usuarioId)
  })
}
