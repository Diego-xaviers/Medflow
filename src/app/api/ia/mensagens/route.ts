import { rota } from '@/lib/api'
import { escreverPendentes, montarPainel } from '@/lib/lotesServidor'
import { exigirAssistente } from '../acesso'

/** Uma chamada à IA por vez, de até 15 mensagens. */
export const maxDuration = 60

/**
 * Escreve as mensagens dos contatos liberados que ainda não têm, em partes.
 * A tela chama de novo enquanto `pendentes > 0` e a última parte avançou.
 */
export async function POST() {
  return rota(async () => {
    const { consultorioId } = await exigirAssistente()
    const progresso = await escreverPendentes(consultorioId)
    return { ...(await montarPainel(consultorioId)), ...progresso }
  })
}
