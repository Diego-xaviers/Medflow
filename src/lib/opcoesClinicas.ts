/**
 * Listas de escolha rápida da anamnese.
 *
 * O ganho aqui é de tempo de digitação no meio do atendimento: com o paciente
 * na cadeira, tocar em "Diabetes" é mais rápido e mais consistente que digitar.
 * Consistência importa também depois — "diabetes", "DM2" e "diabético" escritos
 * à mão viram três coisas diferentes na hora de olhar o histórico.
 *
 * O valor continua sendo TEXTO no banco. Não virou tabela de códigos de
 * propósito: os prontuários que já existem continuam legíveis, nada precisa de
 * migração, e o campo "Outro" aceita o que nenhuma lista prevê — que em clínica
 * é sempre metade dos casos.
 */

/** Marcada, esvazia as demais: dizer "nenhum" e listar doenças é contraditório. */
export const OPCAO_NENHUM = 'Nenhum'

export interface GrupoDeOpcoes {
  campo: string
  rotulo: string
  opcoes: string[]
  /** Tem "Nenhum" como escolha exclusiva? */
  permiteNenhum?: boolean
}

export const QUEIXA_PRINCIPAL: string[] = [
  'Dificuldade para enxergar de longe',
  'Dificuldade para enxergar de perto',
  'Visão embaçada',
  'Visão dupla',
  'Dor de cabeça',
  'Vista cansada no fim do dia',
  'Ardência ou coceira',
  'Olho vermelho',
  'Lacrimejamento',
  'Sensibilidade à luz',
  'Revisão de rotina',
  'Troca de óculos',
  'Adaptação de lente de contato',
]

export const HISTORICO_OCULAR: string[] = [
  'Usa óculos',
  'Usa lente de contato',
  'Cirurgia refrativa',
  'Cirurgia de catarata',
  'Glaucoma',
  'Ceratocone',
  'Estrabismo',
  'Ambliopia (olho preguiçoso)',
  'Trauma ocular',
  'Terçol ou calázio de repetição',
  'Olho seco',
]

export const HISTORICO_SISTEMICO: string[] = [
  'Diabetes',
  'Hipertensão',
  'Doença da tireoide',
  'Colesterol alto',
  'Doença autoimune',
  'Enxaqueca',
  'Alergia respiratória',
  'Tabagismo',
]

export const MEDICAMENTOS: string[] = [
  'Colírio lubrificante',
  'Colírio para glaucoma',
  'Anti-hipertensivo',
  'Antidiabético',
  'Antialérgico',
  'Corticoide',
]

export const TEMPO_ULTIMO_EXAME: string[] = [
  'Primeira consulta',
  'Menos de 1 ano',
  'Há 1 ano',
  'Há 2 anos',
  'Há 3 anos ou mais',
  'Não lembra',
]

const PREFIXO_OUTRO = 'Outro: '

/** Como o texto guardado se decompõe de volta em seleções + campo livre. */
export interface SelecaoDecomposta {
  marcadas: string[]
  outro: string
}

/**
 * Lê o texto do banco e separa o que veio da lista do que foi digitado.
 *
 * Precisa aguentar prontuário antigo, escrito à mão antes das listas
 * existirem: o que não casar com nenhuma opção conhecida cai inteiro no campo
 * "Outro", em vez de sumir da tela.
 */
export function decompor(valor: string | null | undefined, opcoes: string[]): SelecaoDecomposta {
  if (!valor?.trim()) return { marcadas: [], outro: '' }

  const partes = valor.split(',').map((p) => p.trim()).filter(Boolean)
  const marcadas: string[] = []
  const sobras: string[] = []

  for (const parte of partes) {
    if (parte.startsWith(PREFIXO_OUTRO)) {
      sobras.push(parte.slice(PREFIXO_OUTRO.length))
    } else if (parte === OPCAO_NENHUM || opcoes.includes(parte)) {
      marcadas.push(parte)
    } else {
      sobras.push(parte)
    }
  }

  return { marcadas, outro: sobras.join(', ') }
}

/** Junta seleções e campo livre no texto que vai para o banco. */
export function compor({ marcadas, outro }: SelecaoDecomposta): string {
  const partes = [...marcadas]
  if (outro.trim()) partes.push(`${PREFIXO_OUTRO}${outro.trim()}`)
  return partes.join(', ')
}
