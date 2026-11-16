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
  adicaoOD: 'adicaoOD',
  adicaoOE: 'adicaoOE',
  // A necessidade de uso anotada no exame vira a orientação de uso da receita.
  orientacoesUso: 'necessidadeUso',
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

const TIPO_LENTE: Record<string, string> = {
  MONOFOCAL: 'Monofocal', BIFOCAL: 'Bifocal', MULTIFOCAL: 'Multifocal',
  OCUPACIONAL: 'Ocupacional', CONTATO: 'Lente de contato',
}

const dataBR = (v: string | Date) => new Date(v).toLocaleDateString('pt-BR')

/** "OD -1.75 -0.50 x 180° · OE -1.50" — pula o olho que estiver em branco. */
function linhaOlhos(
  rotulo: string,
  od: { esf?: any; cil?: any; eixo?: any },
  oe: { esf?: any; cil?: any; eixo?: any }
): string | null {
  const montar = (o: typeof od) => {
    if (vazio(o.esf) && vazio(o.cil)) return null
    const partes = [] as string[]
    if (!vazio(o.esf)) partes.push(String(o.esf))
    if (!vazio(o.cil)) partes.push(`${o.cil}${vazio(o.eixo) ? '' : ` x ${o.eixo}°`}`)
    return partes.join(' ')
  }

  const a = montar(od)
  const b = montar(oe)
  if (!a && !b) return null
  return `${rotulo}: ${[a && `OD ${a}`, b && `OE ${b}`].filter(Boolean).join('  |  ')}`
}

/** Par simples de valores por olho, como adição ou acuidade. */
function parSimples(rotulo: string, od: any, oe: any): string | null {
  if (vazio(od) && vazio(oe)) return null
  return `${rotulo}: ${[!vazio(od) && `OD ${od}`, !vazio(oe) && `OE ${oe}`].filter(Boolean).join('  |  ')}`
}

/**
 * A receita em texto, para mandar ao paciente pelo WhatsApp.
 *
 * Escrita para ser lida no celular por quem não é da área: linhas curtas,
 * sem sigla que o paciente não conheça, e sem nada do exame clínico — o que
 * a ótica precisa para montar a lente, e só.
 */
export function textoDaReceita(r: any): string {
  const clinica = r.consultorio?.nome ?? 'Consultório'

  const linhas: (string | null)[] = [
    `*RECEITA OFTÁLMICA*`,
    clinica,
    '',
    `Paciente: ${r.paciente?.nome ?? '—'}`,
    `Emitida em: ${dataBR(r.dataEmissao)}`,
    `Válida até: ${dataBR(r.validadeAte)}`,
    '',
    '*Grau para longe*',
    linhaOlhos(
      'Longe',
      { esf: r.longeEsfericoOD, cil: r.longeCilindricoOD, eixo: r.longeEixoOD },
      { esf: r.longeEsfericoOE, cil: r.longeCilindricoOE, eixo: r.longeEixoOE }
    ) ?? 'Não prescrito',
    '',
    '*Grau para perto*',
    linhaOlhos(
      'Perto',
      { esf: r.pertoEsfericoOD, cil: r.pertoCilindricoOD, eixo: r.pertoEixoOD },
      { esf: r.pertoEsfericoOE, cil: r.pertoCilindricoOE, eixo: r.pertoEixoOE }
    ) ?? 'Não prescrito',
    parSimples('Adição', r.adicaoOD, r.adicaoOE),
    parSimples('Visão esperada para longe', r.avCorrigidaOD, r.avCorrigidaOE),
    parSimples('Visão esperada para perto', r.avPertoOD, r.avPertoOE),
    '',
    '*Medidas de montagem*',
    parSimples('DP para longe', r.dpLongeOD, r.dpLongeOE),
    vazio(r.dpPerto) ? null : `DP para perto: ${r.dpPerto}`,
    parSimples('Altura', r.alturaOD, r.alturaOE),
    parSimples('Prisma', r.prismaOD, r.prismaOE),
    parSimples('Base do prisma', r.baseprismaOD, r.baseprismaOE),
    '',
    '*Lente indicada*',
    `Tipo: ${TIPO_LENTE[r.tipoLente] ?? r.tipoLente}`,
    vazio(r.materialLente) ? null : `Material: ${r.materialLente}`,
    vazio(r.tratamentos) ? null : `Tratamentos: ${r.tratamentos}`,
    vazio(r.orientacoesUso) ? null : `Orientações: ${r.orientacoesUso}`,
    '',
    r.consultorio?.telefone ? `Dúvidas: ${r.consultorio.telefone}` : null,
    r.consultorio?.endereco ?? null,
  ]

  // Junta e some com as linhas em branco que sobraram de bloco vazio.
  return linhas
    .filter((l) => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Resumo curto do grau encontrado, para identificar o exame numa lista. */
/** O grau dos óculos que o paciente já usa, no mesmo formato. Nulo sem grau. */
export function resumoGrauAtual(p: any): string | null {
  if (!p?.usaCorrecaoAtual) return null
  const r = resumoRefracao({
    refracaoEsfericoOD: p.grauAtualEsfericoOD, refracaoCilindricoOD: p.grauAtualCilindricoOD, refracaoEixoOD: p.grauAtualEixoOD,
    refracaoEsfericoOE: p.grauAtualEsfericoOE, refracaoCilindricoOE: p.grauAtualCilindricoOE, refracaoEixoOE: p.grauAtualEixoOE,
  })
  const tipo = TIPO_LENTE[p.tipoLenteAtual]
  if (r === 'Sem refração registrada') return tipo ?? null
  return tipo ? `${r} (${tipo})` : r
}

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
