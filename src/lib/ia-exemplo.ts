/**
 * Painel do Assistente IA com dados fictícios.
 *
 * Usado em dois lugares: a demonstração pública (`/demo/ia`) e a prévia
 * desfocada que Básico e Pro veem. Nenhum paciente aqui existe.
 */

import type { Painel } from './lotesServidor'

const hoje = new Date()
const horasAtras = (h: number) => new Date(hoje.getTime() - h * 3_600_000).toISOString()

export const PAINEL_IA_EXEMPLO: Painel = {
  liberado: true,
  whatsapp: { status: 'SEM_INSTANCIA', numero: null, posVendaLigada: false, enviadasHoje: 0, limite: 20 },
  aguardandoEquipe: [],
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
      total: 64,
      enviados: 12,
      agendaram: 3,
      hoje: [
        {
          id: 'ex-c1', pacienteId: 'ex-p1', pacienteNome: 'Helena Barros', telefone: '(92) 98111-2201',
          mensagem: 'Oi, Helena! Já faz mais de um ano do seu último exame de vista aqui na Ótica Visão Clara. Quer que eu reserve um horário para você esta semana?',
          prioridade: 'alta', status: 'LIBERADO', dias: -410,
        },
        {
          id: 'ex-c2', pacienteId: 'ex-p2', pacienteNome: 'Caio Nogueira', telefone: '(92) 98222-3312',
          mensagem: 'Oi, Caio! Seu exame de vista completou um ano. Que tal revisar o grau antes de trocar os óculos? Posso ver um horário para você?',
          prioridade: 'media', status: 'ENVIADO', dias: -395,
        },
        {
          id: 'ex-c3', pacienteId: 'ex-p3', pacienteNome: 'Marta Vilela', telefone: '(92) 98333-4423',
          mensagem: 'Oi, Marta! Já passou um ano do seu exame aqui na Ótica Visão Clara. Quer aproveitar para revisar a visão? Posso reservar um horário para você?',
          prioridade: 'media', status: 'LIBERADO', dias: -380,
        },
      ],
    },
  ],
}
