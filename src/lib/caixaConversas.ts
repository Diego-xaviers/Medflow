import type { AutorMensagemIA, StatusConversa, TipoConversa } from '@prisma/client'

export const GRUPOS: Record<'ia' | 'equipe' | 'resolvidas', StatusConversa[]> = {
  ia: ['ABERTA', 'AGUARDANDO_ENVIO'],
  equipe: ['COM_EQUIPE'],
  resolvidas: ['RESOLVIDA', 'SEM_RESPOSTA', 'ENCERRADA'],
}

export type Aba = 'todas' | keyof typeof GRUPOS
export const ACOES = ['assumir', 'devolver', 'resolver'] as const
export type Acao = typeof ACOES[number]
export const TRANSICOES: Record<Acao, { de: StatusConversa[]; para: StatusConversa }> = {
  assumir: { de: ['ABERTA'], para: 'COM_EQUIPE' },
  devolver: { de: ['COM_EQUIPE'], para: 'ABERTA' },
  resolver: { de: ['ABERTA', 'COM_EQUIPE'], para: 'RESOLVIDA' },
}

export function mascararTelefone(telefone: string | null) {
  if (!telefone) return ''
  const digitos = telefone.replace(/\D/g, '')
  const br = digitos.match(/^(?:55)?(\d{2})(9?)\d{4}(\d{4})$/)
  if (br) return `(${br[1]}) ${br[2]}****-${br[3]}`
  return digitos.length > 4 ? `****-${digitos.slice(-4)}` : '****'
}

export type Mensagem = { id: string; autor: AutorMensagemIA; texto: string; em: string; autorNome?: string }
export type ResumoConversa = {
  id: string; primeiroNome: string; telefoneMascarado: string; tipo: TipoConversa; status: StatusConversa
  ultimaMensagem: Mensagem | null; aguardandoEquipe: boolean; prioridade: string | null
}
export type Lista = { liberado: boolean; itens: ResumoConversa[]; contadores: Record<Aba, number> }
export type Detalhe = Pick<ResumoConversa, 'id' | 'primeiroNome' | 'tipo' | 'status'> & {
  telefone: string | null; aceitaContato: boolean; conectado: boolean; motivoEquipe: string | null; mensagens: Mensagem[]
}

export const exemploConversa: Detalhe = {
  id: 'exemplo', primeiroNome: 'Ana', tipo: 'RECUPERACAO', status: 'COM_EQUIPE', telefone: '(11) 90000-0000',
  aceitaContato: true, conectado: false, motivoEquipe: 'Quer marcar',
  mensagens: [
    { id: '1', autor: 'IA', texto: 'Ana, gostaria que a equipe entrasse em contato para agendar seu retorno?', em: '2026-11-20T13:00:00Z' },
    { id: '2', autor: 'PACIENTE', texto: 'Sim, podem me chamar.', em: '2026-11-20T13:05:00Z' },
  ],
}

export function listaExemplo(aba: Aba, busca: string): Lista {
  const c = exemploConversa
  const digitos = busca.replace(/\D/g, '')
  const corresponde = c.primeiroNome.toLowerCase().includes(busca.toLowerCase()) ||
    (digitos.length > 0 && (c.telefone ?? '').replace(/\D/g, '').includes(digitos))
  return { liberado: false, contadores: { todas: corresponde ? 1 : 0, ia: 0, equipe: corresponde ? 1 : 0, resolvidas: 0 },
    itens: corresponde && (aba === 'todas' || aba === 'equipe') ? [{
      id: c.id, primeiroNome: c.primeiroNome, tipo: c.tipo, status: c.status, telefoneMascarado: mascararTelefone(c.telefone),
      ultimaMensagem: c.mensagens[1], aguardandoEquipe: true, prioridade: 'normal',
    }] : [],
  }
}
