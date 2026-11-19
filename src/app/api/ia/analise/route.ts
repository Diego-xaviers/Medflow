import { rota } from '@/lib/api'
import { comecarAssistente } from '@/lib/lotesServidor'
import { exigirAssistente } from '../acesso'

/** Uma chamada à IA (a análise) mais o trabalho no banco. */
export const maxDuration = 60

/**
 * "Começar" / "Atualizar análise": refaz os lotes e pede à IA a leitura dos
 * últimos 6 meses (no máximo uma vez por hora). Se a IA falhar, devolve o
 * painel com os lotes e `erroAnalise`.
 */
export async function POST() {
  return rota(async () => {
    const { consultorioId } = await exigirAssistente()
    const { painel, erroAnalise } = await comecarAssistente(consultorioId)
    return { ...painel, erroAnalise }
  })
}
