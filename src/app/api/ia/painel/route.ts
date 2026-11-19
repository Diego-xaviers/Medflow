import { rota } from '@/lib/api'
import { exigirTela } from '@/lib/tenant'
import { temRecurso } from '@/lib/planos'
import { liberarHoje, montarPainel, proporLotes } from '@/lib/lotesServidor'

/**
 * O painel do Assistente IA. Quem não é Ultra recebe `{ liberado: false }`
 * (e não 402): a tela abre mesmo assim, com a prévia e o convite.
 *
 * Toda abertura refaz os lotes propostos e libera os contatos do dia —
 * as duas coisas são idempotentes no mesmo dia.
 */
export async function GET() {
  return rota(async () => {
    const { consultorioId, plano } = await exigirTela('/ia')
    if (!temRecurso(plano, 'iaPosVenda')) return { liberado: false as const }

    await proporLotes(consultorioId)
    await liberarHoje(consultorioId)
    return montarPainel(consultorioId)
  })
}
