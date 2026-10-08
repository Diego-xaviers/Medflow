import { exigirUsuario } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { consultoriosDoUsuario } from '@/lib/rede'

/**
 * Unidades entre as quais a pessoa pode trocar. Não passa pela trava de
 * mensalidade: quem está numa unidade bloqueada precisa conseguir sair dela.
 */
export async function GET() {
  return rota(async () => {
    const { usuarioId, consultorioId } = await exigirUsuario()
    const lista = await consultoriosDoUsuario(usuarioId)
    return lista.map((c, i) => ({ id: c.id, nome: c.nome, origem: i === 0, atual: c.id === consultorioId }))
  })
}
