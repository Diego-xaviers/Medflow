/**
 * A ponte entre o EXAME e a PRESCRIÇÃO.
 *
 * Prontuário e receita não repetem campo de propósito: um guarda o que foi
 * medido, o outro o que foi prescrito, e os dois números podem divergir — o
 * optometrista costuma suavizar o grau por conforto e adaptação.
 *
 * O que se repetia era o TRABALHO: digitar o mesmo -1,75 duas vezes. É isso
 * que este arquivo resolve. A refração encontrada entra na receita como ponto
 * de partida, marcada como herdada, e a partir dali é livre para ser ajustada
 * sem tocar no exame. Continuam sendo dois registros; deixa de ser digitação
 * dobrada.
 */

/** Campo da receita ← campo do prontuário. */
const DE_PARA: Record<string, string> = {
  longeEsfericoOD: 'refracaoEsfericoOD',
  longeCilindricoOD: 'refracaoCilindricoOD',
  longeEixoOD: 'refracaoEixoOD',
  longeEsfericoOE: 'refracaoEsfericoOE',
  longeCilindricoOE: 'refracaoCilindricoOE',
  longeEixoOE: 'refracaoEixoOE',
}

export const CAMPOS_HERDAVEIS = Object.keys(DE_PARA)

const vazio = (v: unknown) => v === null || v === undefined || String(v).trim() === ''

/**
 * Devolve os campos da receita que vieram do exame.
 *
 * Com `sobrescrever: false` (o padrão), só preenche o que estiver em branco —
 * ninguém perde o que já digitou por ter mexido no seletor de prontuário.
 */
export function herdarDoProntuario(
  prontuario: any,
  receitaAtual: Record<string, any>,
  opcoes: { sobrescrever?: boolean } = {}
): { valores: Record<string, string>; herdados: string[] } {
  const valores: Record<string, string> = {}
  const herdados: string[] = []

  if (!prontuario) return { valores, herdados }

  for (const [campoReceita, campoExame] of Object.entries(DE_PARA)) {
    const doExame = prontuario[campoExame]
    if (vazio(doExame)) continue
    if (!opcoes.sobrescrever && !vazio(receitaAtual[campoReceita])) continue

    valores[campoReceita] = String(doExame)
    herdados.push(campoReceita)
  }

  return { valores, herdados }
}

/** Resumo curto do grau encontrado, para identificar o exame numa lista. */
export function resumoRefracao(p: any): string {
  const olho = (esf: string, cil: string, eixo: string) => {
    if (vazio(esf) && vazio(cil)) return null
    const partes = [esf].filter((v) => !vazio(v))
    if (!vazio(cil)) partes.push(`${cil}${vazio(eixo) ? '' : ` x ${eixo}°`}`)
    return partes.join(' ')
  }

  const od = olho(p.refracaoEsfericoOD, p.refracaoCilindricoOD, p.refracaoEixoOD)
  const oe = olho(p.refracaoEsfericoOE, p.refracaoCilindricoOE, p.refracaoEixoOE)

  if (!od && !oe) return 'Sem refração registrada'
  return [od && `OD ${od}`, oe && `OE ${oe}`].filter(Boolean).join(' · ')
}
