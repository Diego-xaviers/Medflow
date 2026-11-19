import { exigirTela, ErroPlanoInsuficiente, type Contexto } from '@/lib/tenant'
import { temRecurso } from '@/lib/planos'

export const MENSAGEM_ULTRA = 'O Assistente IA faz parte do plano Ultra. Veja em Cobrança como mudar de plano.'

/**
 * Toda rota do Assistente IA passa por aqui: tela liberada para o papel e
 * recurso do plano Ultra. A tela abre para todos (para mostrar que existe),
 * mas nada calcula nem chama a IA sem o recurso.
 */
export async function exigirAssistente(): Promise<Contexto> {
  const ctx = await exigirTela('/ia')
  if (!temRecurso(ctx.plano, 'iaPosVenda')) throw new ErroPlanoInsuficiente(MENSAGEM_ULTRA)
  return ctx
}
