import { BASE, normalizar, type ItemConhecimento } from './baseConhecimento'

/**
 * O agente de primeira linha do suporte.
 *
 * É uma busca por palavras na base de conhecimento, não um modelo de
 * linguagem — e isso é deliberado. A pessoa que abre o suporte quer uma
 * resposta certa em dois segundos, não uma resposta plausível. Quando não
 * encontra, o agente **diz que não sabe** e oferece o caminho humano, em vez
 * de inventar. Suporte que chuta é pior que suporte que demora.
 */

/** Mínimo de sinal para considerar que entendeu a pergunta. */
const CORTE = 2

interface Resposta {
  texto: string
  /** Encontrou algo na base? Quando falso, a tela sugere abrir chamado. */
  resolveu: boolean
  itemId?: string
}

function pontuar(item: ItemConhecimento, pergunta: string): number {
  let pontos = 0

  for (const termo of item.termos) {
    if (pergunta.includes(termo)) {
      // Termo com mais de uma palavra ("mesmo horario") é sinal mais forte
      // do que uma palavra solta, que aparece em qualquer frase.
      pontos += termo.includes(' ') ? 3 : 2
    }
  }

  // Palavras do título da pergunta também contam, com peso menor.
  for (const palavra of normalizar(item.pergunta).split(/\W+/)) {
    if (palavra.length > 4 && pergunta.includes(palavra)) pontos += 1
  }

  return pontos
}

export function responder(perguntaBruta: string): Resposta {
  const pergunta = normalizar(perguntaBruta)

  if (pergunta.length < 3) {
    return {
      texto: 'Me conta com um pouco mais de detalhe o que você precisa — assim consigo te ajudar melhor.',
      resolveu: false,
    }
  }

  const ranking = BASE
    .map((item) => ({ item, pontos: pontuar(item, pergunta) }))
    .filter((r) => r.pontos >= CORTE)
    .sort((a, b) => b.pontos - a.pontos)

  if (ranking.length === 0) {
    return {
      texto:
        'Não encontrei isso na base de ajuda. Para não te dar uma resposta errada, o melhor caminho é abrir um chamado: você descreve o que está acontecendo e fala direto com o responsável pelo sistema, aqui mesmo na plataforma.',
      resolveu: false,
    }
  }

  const [melhor, segundo] = ranking
  let texto = melhor.item.resposta

  // Duas respostas quase empatadas costumam significar pergunta ambígua:
  // damos a mais provável e apontamos a outra em vez de escolher no escuro.
  if (segundo && segundo.pontos >= melhor.pontos - 1) {
    texto += `\n\nSe a sua dúvida era sobre "${segundo.item.pergunta}", me diga que eu explico essa parte também.`
  }

  return { texto, resolveu: true, itemId: melhor.item.id }
}

/** Primeira fala do agente ao abrir uma conversa. */
export const SAUDACAO =
  'Oi! Sou o assistente do Medflow. Descreva sua dúvida que eu procuro na base de ajuda. Se eu não souber, ou se você preferir falar com uma pessoa, é só pedir para abrir um chamado.'
