import { NextRequest } from 'next/server'
import { exigirGestor, unidadesDoFiltro } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { metricasPorUnidade, periodoDoFiltro, produtividadeProfissionais } from '@/lib/gestor'

/** Painel unificado: todas as unidades do filtro, somadas e lado a lado. */
export async function GET(req: NextRequest) {
  return rota(async () => {
    const ctx = await exigirGestor()
    const q = req.nextUrl.searchParams
    const ids = unidadesDoFiltro(ctx, q.get('unidades'))
    const periodo = periodoDoFiltro(q.get('de'), q.get('ate'))
    const escolhidas = ctx.unidades.filter((u) => ids.includes(u.id))

    const [unidades, profissionais] = await Promise.all([
      metricasPorUnidade(escolhidas, periodo),
      produtividadeProfissionais(ids, periodo),
    ])
    return { rede: ctx.redeNome, periodo, unidades, profissionais }
  })
}
