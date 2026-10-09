import { exigirGestor } from '@/lib/tenant'
import { rota } from '@/lib/api'

/** Rede da pessoa e suas unidades — alimenta o filtro do ambiente gestor. */
export async function GET() {
  return rota(async () => {
    const ctx = await exigirGestor()
    return { rede: ctx.redeNome, unidades: ctx.unidades }
  })
}
