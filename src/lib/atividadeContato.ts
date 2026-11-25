import type { StatusContatoLote, StatusConversa } from '@prisma/client'

export interface AtividadeContato {
  id: string
  nome: string
  lote: string
  status: StatusContatoLote
  liberadoEm: string | null
  enviadoEm: string
  aceitaContato: boolean
  conversa: {
    status: StatusConversa
    respostaEm: string | null
    lembreteEm: string | null
    motivo: string | null
    primeiraSaida: string | null
  } | null
}

export function situacaoContato(c: AtividadeContato) {
  if (!c.aceitaContato || c.status === 'NAO_CONTATAR') return { grupo: 'resultado', titulo: 'Contato suspenso', descricao: 'Os próximos envios para este paciente estão bloqueados.' }
  if (c.status === 'AGENDOU') return { grupo: 'resultado', titulo: 'Agendou', descricao: 'O agendamento foi registrado para este contato.' }
  if (c.status === 'RECUSOU') return { grupo: 'resultado', titulo: 'Recusou', descricao: 'Foi registrada uma recusa ao convite.' }
  const conversa = c.conversa
  if (conversa?.status === 'COM_EQUIPE') return { grupo: 'equipe', titulo: 'Com a equipe', descricao: conversa.motivo || 'A recepção assumiu o atendimento.' }
  if (conversa?.status === 'SEM_RESPOSTA') return { grupo: 'resultado', titulo: 'Encerrado sem resposta', descricao: 'A sequência de acompanhamento terminou sem retorno registrado.' }
  if (conversa?.status === 'RESOLVIDA' || conversa?.status === 'ENCERRADA') return { grupo: 'resultado', titulo: 'Conversa encerrada', descricao: 'O atendimento foi encerrado no Medflow.' }
  if (conversa?.respostaEm) return { grupo: 'resposta', titulo: 'Respondeu', descricao: 'O paciente respondeu pelo WhatsApp da clínica.' }
  return { grupo: 'envio', titulo: conversa ? 'Aguardando resposta' : 'Envio manual registrado',
    descricao: conversa ? 'A conversa está aberta e ainda não há resposta registrada.' : 'A equipe abriu o WhatsApp para enviar a mensagem. O resultado pode ser registrado abaixo.' }
}
