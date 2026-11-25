import { rota } from '@/lib/api'
import { listarConhecimento, salvarItemConhecimento } from '@/lib/agentesServidor'
import { exigirAssistente } from '../acesso'

export async function GET() {
  return rota(async () => {
    const { consultorioId } = await exigirAssistente()
    return listarConhecimento(consultorioId)
  })
}

export async function POST(req: Request) {
  return rota(async () => {
    const { consultorioId, usuarioId } = await exigirAssistente()
    return salvarItemConhecimento(consultorioId, await req.json(), usuarioId)
  })
}
