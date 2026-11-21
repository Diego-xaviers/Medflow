/**
 * Painel do Assistente IA com dados fictícios.
 *
 * Usado em dois lugares: a demonstração pública (`/demo/ia`) e a prévia
 * desfocada que Básico e Pro veem. Nenhum paciente aqui existe.
 */

import { PADRAO_AGENTE, completude } from './agentesIA'
import type { AtividadeContato } from './atividadeContato'
import type { Painel } from './lotesServidor'

const hoje = new Date()
const horasAtras = (h: number) => new Date(hoje.getTime() - h * 3_600_000).toISOString()

export const PAINEL_IA_EXEMPLO: Painel = {
  liberado: true,
  whatsapp: { status: 'CONECTADO', numero: '(92) 99999-0000', posVendaLigada: true, enviadasHoje: 12, limite: 20 },
  hoje: hoje.toISOString().slice(0, 10),
  aguardandoEquipe: 1,
  analise: {
    resumo:
      'A receita de novembro chegou a R$ 41.250,00, a maior dos últimos 6 meses, puxada por 225 consultas concluídas. ' +
      'O comparecimento está em 95%, mas 64 pacientes estão com o exame vencido há mais de um ano. ' +
      'A maior parte deles chegou por indicação, o que costuma responder bem a um contato pessoal.',
    atencao: [
      '64 pacientes com o exame vencido: é o maior potencial de retorno agora.',
      '11 faltas no mês: 9 ainda não remarcaram.',
      'Instagram trouxe 86 pacientes novos, mas o ticket médio deles é menor.',
    ],
    ordemLotes: [
      { tipo: 'FALTOU', porque: 'Faltaram há pouco e ainda lembram da clínica: maior chance de remarcar.' },
      { tipo: 'EXAME_VENCIDO', porque: 'O maior grupo, e o motivo do contato é claro: o exame anual venceu.' },
      { tipo: 'RECEITA_VENCIDA', porque: 'Receita vencida impede comprar lente nova: contato útil para o paciente.' },
      { tipo: 'SUMIDO', porque: 'Faz mais de dois anos: vale tentar depois dos outros lotes.' },
    ],
    criadoEm: horasAtras(2),
  },
  propostos: [
    { id: 'ex-faltou', tipo: 'FALTOU', titulo: 'Faltou e não remarcou', total: 9 },
    { id: 'ex-receita', tipo: 'RECEITA_VENCIDA', titulo: 'Receita vencida', total: 23 },
    { id: 'ex-sumido', tipo: 'SUMIDO', titulo: 'Sumidos há +2 anos', total: 41 },
  ],
  andamento: [
    {
      id: 'ex-exame',
      tipo: 'EXAME_VENCIDO',
      titulo: 'Exame vencido há +1 ano',
      status: 'APROVADO',
      ritmoDiario: 20,
      autorizado: true,
      total: 64,
      enviados: 12,
      agendaram: 3,
      hoje: [
        {
          id: 'ex-c1', pacienteId: 'ex-p1', pacienteNome: 'Helena Barros', telefone: '(92) 98111-2201',
          mensagem: 'Oi, Helena! Já faz mais de um ano do seu último exame de vista aqui na Ótica Visão Clara. Quer que eu reserve um horário para você esta semana?',
          prioridade: 'alta', status: 'LIBERADO', dias: -410, loteAutorizado: true,
        },
        {
          id: 'ex-c3', pacienteId: 'ex-p3', pacienteNome: 'Marta Vilela', telefone: '(92) 98333-4423',
          mensagem: 'Oi, Marta! Já passou um ano do seu exame aqui na Ótica Visão Clara. Quer aproveitar para revisar a visão? Posso reservar um horário para você?',
          prioridade: 'media', status: 'LIBERADO', dias: -380, loteAutorizado: true,
        },
      ],
    },
  ],
}

export const AGENTES_EXEMPLO = {
  liberado: true,
  fusoHorario: 'America/Manaus',
  equipe: [{ id: 'user-3', nome: 'Juliana (recepção)' }],
  whatsapp: PAINEL_IA_EXEMPLO.whatsapp,
  agentes: (['POS_VENDA', 'RECUPERACAO'] as const).map(tipo => {
    const config = PADRAO_AGENTE(tipo)
    return { config, completude: completude(config), estatisticas: tipo === 'POS_VENDA'
      ? { conversas: 54, hoje: 8, resposta30d: 72 } : { conversas: 38, hoje: 4, resposta30d: 61 } }
  }),
}

export const CONHECIMENTO_EXEMPLO = [
  { id: 'ex-endereco', titulo: 'Endereço e como chegar', texto: 'A entrada da clínica fica na Rua das Flores, 120, ao lado da praça. A recepção fica no térreo.', ordem: 0 },
  { id: 'ex-horario', titulo: 'Horário de atendimento', texto: 'Atendemos de segunda a sexta, das 8h às 18h, e no sábado, das 8h ao meio-dia.', ordem: 1 },
]

export const ATIVIDADE_EXEMPLO = {
  fuso: 'America/Manaus', mais: false,
  contatos: [
    { id: 'ex-c2', nome: 'Caio Nogueira', status: 'ENVIADO', lote: 'Exame vencido há +1 ano', aceitaContato: true,
      liberadoEm: horasAtras(3), enviadoEm: horasAtras(2), conversa: { status: 'COM_EQUIPE', motivo: 'Quer marcar um horário',
        respostaEm: horasAtras(1), lembreteEm: null, primeiraSaida: 'Oi, Caio! Gostaria de falar com a equipe para agendar o retorno?' } },
    { id: 'ex-c4', nome: 'Beatriz Lima', status: 'ENVIADO', lote: 'Receita vencida', aceitaContato: true,
      liberadoEm: horasAtras(26), enviadoEm: horasAtras(25), conversa: { status: 'ABERTA', motivo: null,
        respostaEm: null, lembreteEm: null, primeiraSaida: 'Olá, Beatriz. Podemos passar seu contato para a equipe de agendamento?' } },
    { id: 'ex-c5', nome: 'Luís Almeida', status: 'AGENDOU', lote: 'Exame vencido há +1 ano', aceitaContato: true,
      liberadoEm: horasAtras(99), enviadoEm: horasAtras(98), conversa: { status: 'RESOLVIDA', motivo: null,
        respostaEm: horasAtras(23), lembreteEm: horasAtras(25), primeiraSaida: 'Oi, Luís. Gostaria que a recepção entrasse em contato?' } },
  ] satisfies AtividadeContato[],
}
