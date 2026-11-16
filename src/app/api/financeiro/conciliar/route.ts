import { exigirTela } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { conciliarAgenda } from '@/lib/financeiro'

/**
 * Chamada pela tela do Financeiro ao abrir: leva para o caixa as consultas
 * com valor que ainda não estão lá (inclusive as antigas) e diz quantas.
 */
export async function POST() {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/financeiro')
    return conciliarAgenda(consultorioId)
  })
}
