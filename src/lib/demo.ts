/**
 * Os dados do modo demonstração.
 *
 * O `/demo` monta as TELAS DE VERDADE do sistema — os mesmos componentes que
 * um cliente pagante usa — e troca só a fonte dos dados: em vez de bater nas
 * rotas de API, o `fetch` é interceptado e devolve o que está aqui.
 *
 * Por que assim, e não uma cópia das telas: cópia envelhece. No dia em que a
 * agenda ganhar uma coluna, a vitrine continuaria mostrando a agenda velha e
 * ninguém perceberia por meses. Aqui, qualquer mudança na tela real aparece
 * no demo no mesmo deploy.
 *
 * Nada aqui é dado de paciente real: são nomes inventados. É a razão de o
 * demo não usar o banco — nenhuma clínica autorizaria mostrar a agenda dela
 * para visitante nenhum, e uma conta de verdade exposta é vazamento esperando
 * acontecer.
 */

import { PAINEL_IA_EXEMPLO } from './ia-exemplo'

/* ───────────────────────── Datas vivas ───────────────────────── */

/**
 * O demo tem que parecer o dia de hoje de quem está olhando — agenda de
 * ontem passa a impressão de produto abandonado. Então tudo é calculado a
 * partir de `new Date()` no momento da chamada.
 */
const hoje = () => new Date()

/** Hoje às HH:MM, no fuso de quem está olhando. */
function hojeAs(hora: number, minuto = 0): string {
  const d = hoje()
  d.setHours(hora, minuto, 0, 0)
  return d.toISOString()
}

function diasAtras(dias: number, hora = 10): string {
  const d = hoje()
  d.setDate(d.getDate() - dias)
  d.setHours(hora, 0, 0, 0)
  return d.toISOString()
}

function daquiA(dias: number, hora = 9, minuto = 0): string {
  const d = hoje()
  d.setDate(d.getDate() + dias)
  d.setHours(hora, minuto, 0, 0)
  return d.toISOString()
}

/** 'AAAA-MM' de N meses atrás — as séries do financeiro e dos relatórios. */
function competenciaAtras(meses: number): string {
  const d = hoje()
  d.setDate(1)
  d.setMonth(d.getMonth() - meses)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function rotuloMesAtras(meses: number): string {
  const d = hoje()
  d.setDate(1)
  d.setMonth(d.getMonth() - meses)
  const r = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return r.charAt(0).toUpperCase() + r.slice(1)
}

/* ───────────────────────── O consultório ───────────────────────── */

export const CONSULTORIO_DEMO = {
  id: 'demo-consultorio',
  nome: 'Ótica Visão Clara',
  slug: 'visao-clara-demo',
  telefone: '(92) 99999-0000',
  endereco: 'Av. Djalma Batista, 1200 — Manaus/AM',
  logoUrl: null,
  duracaoConsultaMin: 30,
  fusoHorario: 'America/Manaus',
  criadoEm: diasAtras(420),
  diaVencimento: 10,
  plano: 'PRO',
  blocosExpediente: [1, 2, 3, 4, 5].map((diaSemana) => ({
    id: `bloco-${diaSemana}`,
    diaSemana,
    inicioMin: 8 * 60,
    fimMin: 18 * 60,
  })),
  diasAtendimento: 'Segunda a sexta',
  resumoExpediente: 'Seg a Sex, 08:00–18:00 · consultas de 30 min',
}

export const SESSAO_DEMO = {
  user: {
    id: 'demo-usuario',
    name: 'Dra. Marina Castro',
    email: 'marina@visaoclara.demo',
    papel: 'DONO' as const,
    consultorioId: CONSULTORIO_DEMO.id,
    consultorioNome: CONSULTORIO_DEMO.nome,
    consultorioSlug: CONSULTORIO_DEMO.slug,
    /** Sem isto o `Moldura` encerra a sessão achando que o browser reabriu. */
    rememberMe: true,
    telas: null,
    redeId: null,
    plano: 'PRO' as const,
  },
  /** Longe o bastante para o next-auth não tentar renovar durante a visita. */
  expires: new Date(Date.now() + 86_400_000).toISOString(),
}

/* ───────────────────────── Equipe e pacientes ───────────────────────── */

const PROFISSIONAIS = [
  { id: 'prof-1', nome: 'Dra. Marina Castro', fotoUrl: null },
  { id: 'prof-2', nome: 'Dr. Rafael Lima', fotoUrl: null },
]

const EQUIPE = [
  ...PROFISSIONAIS,
  { id: 'user-3', nome: 'Juliana (recepção)', fotoUrl: null },
]

const PACIENTES = [
  {
    id: 'pac-1', nome: 'Helena Barros', telefone: '(92) 98111-2201', email: 'helena@exemplo.com',
    cpf: '123.456.789-00', dataNascimento: '1986-03-12T12:00:00.000Z', convenio: 'Particular',
    origemContato: 'Instagram', observacoes: null, ativo: true, criadoEm: diasAtras(210),
  },
  {
    id: 'pac-2', nome: 'Caio Nogueira', telefone: '(92) 98222-3312', email: 'caio@exemplo.com',
    cpf: '234.567.890-11', dataNascimento: '1994-07-02T12:00:00.000Z', convenio: 'Unimed',
    origemContato: 'Indicação', observacoes: null, ativo: true, criadoEm: diasAtras(120),
  },
  {
    id: 'pac-3', nome: 'Marta Vilela', telefone: '(92) 98333-4423', email: null,
    cpf: '345.678.901-22', dataNascimento: '1971-11-23T12:00:00.000Z', convenio: 'Particular',
    origemContato: 'Link público', observacoes: null, ativo: true, criadoEm: diasAtras(64),
  },
  {
    id: 'pac-4', nome: 'Otávio Lins', telefone: '(92) 98444-5534', email: 'otavio@exemplo.com',
    cpf: null, dataNascimento: '2001-01-09T12:00:00.000Z', convenio: 'Particular',
    origemContato: 'Google', observacoes: null, ativo: true, criadoEm: diasAtras(30),
  },
  {
    id: 'pac-5', nome: 'Bianca Teixeira', telefone: '(92) 98555-6645', email: null,
    cpf: null, dataNascimento: null, convenio: 'Particular',
    origemContato: 'Instagram', observacoes: null, ativo: true, criadoEm: diasAtras(6),
  },
  {
    id: 'pac-6', nome: 'Rogério Pinto', telefone: '(92) 98666-7756', email: 'rogerio@exemplo.com',
    cpf: '456.789.012-33', dataNascimento: '1959-05-30T12:00:00.000Z', convenio: 'Bradesco Saúde',
    origemContato: 'Indicação', observacoes: null, ativo: true, criadoEm: diasAtras(380),
  },
]

const paciente = (i: number) => ({
  id: PACIENTES[i].id,
  nome: PACIENTES[i].nome,
  telefone: PACIENTES[i].telefone,
  cpf: PACIENTES[i].cpf,
})

/* ───────────────────────── Agenda ───────────────────────── */

const CONSULTAS = [
  {
    id: 'con-1', dataHora: hojeAs(8, 0), status: 'CONCLUIDA', valor: 180, formaPagamento: 'PIX',
    observacoes: 'Consulta de rotina', origemPublica: false, vendaFechada: false, vendaFechadaEm: null,
    campanhaId: null, campanha: null, paciente: paciente(0), profissional: PROFISSIONAIS[0],
    criadoPor: EQUIPE[2], vendedoraResponsavel: null,
  },
  {
    id: 'con-2', dataHora: hojeAs(8, 30), status: 'CONCLUIDA', valor: 180, formaPagamento: 'CARTAO_CREDITO',
    observacoes: 'Adaptação de lente', origemPublica: false, vendaFechada: true, vendaFechadaEm: hojeAs(9),
    campanhaId: 'camp-1', campanha: { id: 'camp-1', nome: 'Exame + armação', valorReferencia: 200 },
    paciente: paciente(1), profissional: PROFISSIONAIS[0], criadoPor: EQUIPE[2], vendedoraResponsavel: null,
  },
  {
    id: 'con-3', dataHora: hojeAs(9, 0), status: 'AGENDADA', valor: 180, formaPagamento: null,
    observacoes: 'Retorno', origemPublica: true, vendaFechada: false, vendaFechadaEm: null,
    campanhaId: null, campanha: null, paciente: paciente(2), profissional: PROFISSIONAIS[1],
    criadoPor: null, vendedoraResponsavel: null,
  },
  {
    id: 'con-4', dataHora: hojeAs(9, 30), status: 'AGENDADA', valor: 180, formaPagamento: null,
    observacoes: 'Exame de refração', origemPublica: false, vendaFechada: false, vendaFechadaEm: null,
    campanhaId: null, campanha: null, paciente: paciente(3), profissional: PROFISSIONAIS[0],
    criadoPor: EQUIPE[2], vendedoraResponsavel: null,
  },
  {
    id: 'con-5', dataHora: hojeAs(10, 0), status: 'AGENDADA', valor: 150, formaPagamento: null,
    observacoes: 'Primeira consulta', origemPublica: true, vendaFechada: false, vendaFechadaEm: null,
    campanhaId: 'camp-1', campanha: { id: 'camp-1', nome: 'Exame + armação', valorReferencia: 200 },
    paciente: paciente(4), profissional: PROFISSIONAIS[1], criadoPor: null, vendedoraResponsavel: null,
  },
  {
    id: 'con-6', dataHora: hojeAs(14, 0), status: 'AGENDADA', valor: 180, formaPagamento: null,
    observacoes: null, origemPublica: false, vendaFechada: false, vendaFechadaEm: null,
    campanhaId: null, campanha: null, paciente: paciente(5), profissional: PROFISSIONAIS[0],
    criadoPor: EQUIPE[2], vendedoraResponsavel: null,
  },
  {
    id: 'con-7', dataHora: daquiA(1, 8, 30), status: 'AGENDADA', valor: 180, formaPagamento: null,
    observacoes: 'Retorno de 30 dias', origemPublica: false, vendaFechada: false, vendaFechadaEm: null,
    campanhaId: null, campanha: null, paciente: paciente(0), profissional: PROFISSIONAIS[0],
    criadoPor: EQUIPE[2], vendedoraResponsavel: null,
  },
  {
    id: 'con-8', dataHora: daquiA(2, 10, 0), status: 'AGENDADA', valor: 180, formaPagamento: null,
    observacoes: null, origemPublica: true, vendaFechada: false, vendaFechadaEm: null,
    campanhaId: null, campanha: null, paciente: paciente(2), profissional: PROFISSIONAIS[1],
    criadoPor: null, vendedoraResponsavel: null,
  },
  {
    id: 'con-9', dataHora: diasAtras(1, 15), status: 'FALTA', valor: 180, formaPagamento: null,
    observacoes: null, origemPublica: false, vendaFechada: false, vendaFechadaEm: null,
    campanhaId: null, campanha: null, paciente: paciente(3), profissional: PROFISSIONAIS[0],
    criadoPor: EQUIPE[2], vendedoraResponsavel: null,
  },
  {
    id: 'con-10', dataHora: diasAtras(2, 9), status: 'CONCLUIDA', valor: 180, formaPagamento: 'DINHEIRO',
    observacoes: null, origemPublica: false, vendaFechada: false, vendaFechadaEm: null,
    campanhaId: null, campanha: null, paciente: paciente(5), profissional: PROFISSIONAIS[1],
    criadoPor: EQUIPE[2], vendedoraResponsavel: null,
  },
]

/* ───────────────────────── Prontuários e receitas ───────────────────────── */

const PRONTUARIOS = [
  {
    id: 'pro-1', dataExame: diasAtras(0, 8), pacienteId: 'pac-1', paciente: paciente(0),
    queixaPrincipal: 'Dor de cabeça ao fim do dia', historicoOcular: 'Usa óculos há 6 anos',
    historicoSistemico: 'Nega', medicamentosEmUso: 'Nenhum', usaCorrecaoAtual: true,
    tempoUltimoExame: 'Mais de 2 anos', necessidadeUso: 'Computador e leitura',
    grauAtualEsfericoOD: '-1,50', grauAtualCilindricoOD: '-0,50', grauAtualEixoOD: '180',
    grauAtualEsfericoOE: '-1,25', grauAtualCilindricoOE: '-0,75', grauAtualEixoOE: '170',
    grauAtualAdicaoOD: null, grauAtualAdicaoOE: null, tipoLenteAtual: 'VISAO_SIMPLES',
    avSemCorrecaoOD: '20/60', avSemCorrecaoOE: '20/50',
    avComCorrecaoOD: '20/20', avComCorrecaoOE: '20/20',
    refracaoEsfericoOD: '-1,75', refracaoCilindricoOD: '-0,50', refracaoEixoOD: '180',
    refracaoEsfericoOE: '-1,50', refracaoCilindricoOE: '-0,75', refracaoEixoOE: '170',
    observacoes: 'Orientada quanto a pausas na tela.', criadoEm: diasAtras(0, 8),
  },
  {
    id: 'pro-2', dataExame: diasAtras(2, 9), pacienteId: 'pac-6', paciente: paciente(5),
    queixaPrincipal: 'Dificuldade para ler de perto', historicoOcular: 'Primeira consulta',
    historicoSistemico: 'Hipertensão', medicamentosEmUso: 'Losartana', usaCorrecaoAtual: false,
    tempoUltimoExame: 'Nunca fez', necessidadeUso: 'Leitura',
    grauAtualEsfericoOD: null, grauAtualCilindricoOD: null, grauAtualEixoOD: null,
    grauAtualEsfericoOE: null, grauAtualCilindricoOE: null, grauAtualEixoOE: null,
    grauAtualAdicaoOD: null, grauAtualAdicaoOE: null, tipoLenteAtual: null,
    avSemCorrecaoOD: '20/30', avSemCorrecaoOE: '20/30',
    avComCorrecaoOD: '20/20', avComCorrecaoOE: '20/20',
    refracaoEsfericoOD: '+1,00', refracaoCilindricoOD: null, refracaoEixoOD: null,
    refracaoEsfericoOE: '+1,00', refracaoCilindricoOE: null, refracaoEixoOE: null,
    observacoes: 'Presbiopia inicial.', criadoEm: diasAtras(2, 9),
  },
]

const RECEITAS = [
  {
    id: 'rec-1', dataEmissao: diasAtras(0, 9), pacienteId: 'pac-1', paciente: paciente(0),
    tipoReceita: 'OPTOMETRICA', tipoLente: 'VISAO_SIMPLES',
    esfericoOD: '-1,75', cilindricoOD: '-0,50', eixoOD: '180', adicaoOD: null,
    esfericoOE: '-1,50', cilindricoOE: '-0,75', eixoOE: '170', adicaoOE: null,
    avCorrigidaOD: '20/20', avCorrigidaOE: '20/20', avPertoOD: 'J1', avPertoOE: 'J1',
    dpLongeOD: '31', dpLongeOE: '31', dpPerto: '58', alturaOD: '18', alturaOE: '18',
    observacoes: 'Antirreflexo recomendado.', validadeMeses: 12, criadoEm: diasAtras(0, 9),
  },
  {
    id: 'rec-2', dataEmissao: diasAtras(2, 10), pacienteId: 'pac-6', paciente: paciente(5),
    tipoReceita: 'OPTOMETRICA', tipoLente: 'MULTIFOCAL',
    esfericoOD: '+1,00', cilindricoOD: null, eixoOD: null, adicaoOD: '+1,50',
    esfericoOE: '+1,00', cilindricoOE: null, eixoOE: null, adicaoOE: '+1,50',
    avCorrigidaOD: '20/20', avCorrigidaOE: '20/20', avPertoOD: 'J2', avPertoOE: 'J2',
    dpLongeOD: '32', dpLongeOE: '32', dpPerto: '60', alturaOD: '20', alturaOE: '20',
    observacoes: null, validadeMeses: 12, criadoEm: diasAtras(2, 10),
  },
]

/* ───────────────────────── Financeiro ───────────────────────── */

const LANCAMENTOS = [
  { id: 'lan-1', descricao: 'Consulta — Helena Barros', valor: 180, tipo: 'RECEITA', status: 'PAGO', data: diasAtras(0, 9), formaPagamento: 'PIX', pacienteId: 'pac-1', paciente: { id: 'pac-1', nome: 'Helena Barros' }, consultaId: 'con-1', complementoDeId: null, criadoEm: diasAtras(0, 9) },
  { id: 'lan-2', descricao: 'Consulta — Caio Nogueira', valor: 180, tipo: 'RECEITA', status: 'PAGO', data: diasAtras(0, 10), formaPagamento: 'CARTAO_CREDITO', pacienteId: 'pac-2', paciente: { id: 'pac-2', nome: 'Caio Nogueira' }, consultaId: 'con-2', complementoDeId: null, criadoEm: diasAtras(0, 10) },
  { id: 'lan-3', descricao: 'Complemento de campanha — ótica parceira', valor: 20, tipo: 'RECEITA', status: 'PENDENTE', data: diasAtras(0, 10), formaPagamento: null, pacienteId: null, paciente: null, consultaId: null, complementoDeId: 'con-2', criadoEm: diasAtras(0, 10) },
  { id: 'lan-4', descricao: 'Consulta — Rogério Pinto', valor: 180, tipo: 'RECEITA', status: 'PAGO', data: diasAtras(2, 9), formaPagamento: 'DINHEIRO', pacienteId: 'pac-6', paciente: { id: 'pac-6', nome: 'Rogério Pinto' }, consultaId: 'con-10', complementoDeId: null, criadoEm: diasAtras(2, 9) },
  { id: 'lan-5', descricao: 'Aluguel da sala', valor: 2800, tipo: 'DESPESA', status: 'PAGO', data: diasAtras(6, 9), formaPagamento: 'PIX', pacienteId: null, paciente: null, consultaId: null, complementoDeId: null, criadoEm: diasAtras(6, 9) },
  { id: 'lan-6', descricao: 'Lentes — fornecedor', valor: 1450, tipo: 'DESPESA', status: 'PAGO', data: diasAtras(9, 9), formaPagamento: 'BOLETO', pacienteId: null, paciente: null, consultaId: null, complementoDeId: null, criadoEm: diasAtras(9, 9) },
  { id: 'lan-7', descricao: 'Consulta — Marta Vilela', valor: 180, tipo: 'RECEITA', status: 'PENDENTE', data: daquiA(3, 9), formaPagamento: null, pacienteId: 'pac-3', paciente: { id: 'pac-3', nome: 'Marta Vilela' }, consultaId: null, complementoDeId: null, criadoEm: diasAtras(0, 11) },
  { id: 'lan-8', descricao: 'Energia', valor: 540, tipo: 'DESPESA', status: 'PENDENTE', data: daquiA(5, 9), formaPagamento: null, pacienteId: null, paciente: null, consultaId: null, complementoDeId: null, criadoEm: diasAtras(1, 9) },
]

const SERIE = [5, 4, 3, 2, 1, 0].map((m, i) => {
  const receitas = [28400, 31200, 29800, 34600, 38900, 41250][i]
  const despesas = [16800, 17400, 16200, 18900, 19400, 18740][i]
  return { mes: competenciaAtras(m), receitas, despesas, saldo: receitas - despesas }
})

const RESUMO = {
  mesAtual: competenciaAtras(0),
  atual: SERIE[SERIE.length - 1],
  anterior: SERIE[SERIE.length - 2],
  variacaoReceitas: 6.0,
  variacaoSaldo: 8.4,
  aReceber: 1240,
  aPagar: 540,
  ticketMedio: 183.4,
  atendimentosPagos: 225,
  melhorMes: SERIE[SERIE.length - 1],
  serie: SERIE,
  meta: {
    valor: 45000,
    alcancado: 41250,
    progresso: 91.7,
    falta: 3750,
    diasRestantes: 9,
    porDia: 416.67,
  },
  porForma: [
    { forma: 'PIX', total: 18900 },
    { forma: 'CARTAO_CREDITO', total: 12400 },
    { forma: 'DINHEIRO', total: 6300 },
    { forma: 'CONVENIO', total: 3650 },
  ],
  porProfissional: [
    { id: 'prof-1', nome: 'Dra. Marina Castro', total: 26400, atendimentos: 142 },
    { id: 'prof-2', nome: 'Dr. Rafael Lima', total: 14850, atendimentos: 83 },
  ],
}

const CAMPANHAS = {
  hoje: hojeAs(12),
  campanhas: [
    {
      id: 'camp-1', nome: 'Exame + armação', descricao: 'Exame por R$ 150 com 20% na armação',
      inicio: diasAtras(12, 12), fim: daquiA(18, 12),
      precoPromocional: 150, descontoPercentual: 20, metaVendas: 40,
      valorReferencia: 200, quemPagaDiferenca: 'PARCEIRO_PAGA', parceiroNome: 'Ótica Central',
      criadoEm: diasAtras(12, 12), situacao: 'ATIVA',
      vendas: 27, agendadas: 9, vendasOtica: 21, faturado: 4050, progressoMeta: 67.5,
    },
    {
      id: 'camp-2', nome: 'Campanha do Dia das Mães', descricao: null,
      inicio: diasAtras(120, 12), fim: diasAtras(96, 12),
      precoPromocional: null, descontoPercentual: 15, metaVendas: 30,
      valorReferencia: null, quemPagaDiferenca: null, parceiroNome: null,
      criadoEm: diasAtras(130, 12), situacao: 'ENCERRADA',
      vendas: 34, agendadas: 0, vendasOtica: 26, faturado: 5780, progressoMeta: 113.3,
    },
  ],
}

/* ───────────────────────── Painel e relatórios ───────────────────────── */

const DASHBOARD = {
  receitaHoje: 360,
  consultasHoje: 6,
  pacientesAtivos: 412,
  pacientesNovosMes: 23,
  receitaMes: 41250,
  pagamentosPendentesValor: 1240,
  pagamentosPendentesQtd: 4,
  ticketMedio: 183.4,
  faltasMes: 11,
  faltasPercentualMes: 4.6,
  receitaMensal: [6, 5, 4, 3, 2, 1, 0].map((m, i) => ({
    mes: rotuloMesAtras(m),
    receitas: [26300, 28400, 31200, 29800, 34600, 38900, 41250][i],
    despesas: [15900, 16800, 17400, 16200, 18900, 19400, 18740][i],
  })),
  comparecimentoSemana: [
    { dia: 'Seg', concluidas: 11, faltas: 1 },
    { dia: 'Ter', concluidas: 13, faltas: 0 },
    { dia: 'Qua', concluidas: 12, faltas: 2 },
    { dia: 'Qui', concluidas: 14, faltas: 1 },
    { dia: 'Sex', concluidas: 10, faltas: 1 },
    { dia: 'Sáb', concluidas: 5, faltas: 0 },
    { dia: 'Dom', concluidas: 0, faltas: 0 },
  ],
  atividadeRecente: [
    { descricao: 'Consulta concluída — Helena Barros', data: hojeAs(8, 30) },
    { descricao: 'Agendamento online — Marta Vilela', data: hojeAs(8, 10) },
    { descricao: 'Novo paciente — Bianca Teixeira', data: diasAtras(0, 7) },
    { descricao: 'Consulta concluída — Caio Nogueira', data: diasAtras(1, 16) },
    { descricao: 'Agendamento — Otávio Lins', data: diasAtras(1, 14) },
    { descricao: 'Novo paciente — Otávio Lins', data: diasAtras(2, 11) },
  ],
}

const RELATORIOS = {
  periodo: { de: competenciaAtras(0) + '-01', ate: competenciaAtras(0) + '-28' },
  kpis: {
    receitas: 41250, despesas: 18740, saldo: 22510,
    pendenteValor: 1240, pendenteQtd: 4,
    concluidas: 225, faltas: 11, canceladas: 6, agendadas: 38,
    taxaComparecimento: 95.3, ticketMedio: 183.4,
    novosPacientes: 23, receitasEmitidas: 198,
  },
  serieMensal: [5, 4, 3, 2, 1, 0].map((m, i) => ({
    mes: rotuloMesAtras(m),
    receitas: [28400, 31200, 29800, 34600, 38900, 41250][i],
    despesas: [16800, 17400, 16200, 18900, 19400, 18740][i],
    concluidas: [168, 182, 175, 196, 213, 225][i],
    faltas: [14, 12, 15, 9, 13, 11][i],
  })),
  porOrigem: [
    { rotulo: 'Instagram', total: 86 },
    { rotulo: 'Indicação', total: 64 },
    { rotulo: 'Link público', total: 41 },
    { rotulo: 'Google', total: 27 },
  ],
  porTipoLente: [
    { rotulo: 'VISAO_SIMPLES', total: 118 },
    { rotulo: 'MULTIFOCAL', total: 54 },
    { rotulo: 'BIFOCAL', total: 26 },
  ],
  porVendedora: [
    { rotulo: 'Juliana', total: 112 },
    { rotulo: 'Dra. Marina Castro', total: 86 },
  ],
  topPacientes: [
    { pacienteId: 'pac-6', rotulo: 'Rogério Pinto', total: 1240 },
    { pacienteId: 'pac-1', rotulo: 'Helena Barros', total: 980 },
    { pacienteId: 'pac-2', rotulo: 'Caio Nogueira', total: 760 },
  ],
}

/* ───────────────────────── Roteamento das respostas ───────────────────────── */

/**
 * O que cada rota devolve no demo. Chave sem query string; a busca é
 * ignorada de propósito — filtrar de mentira daria resultado vazio, que é
 * pior que mostrar a lista inteira.
 */
const RESPOSTAS: Record<string, () => unknown> = {
  '/api/dashboard': () => DASHBOARD,
  '/api/consultas': () => CONSULTAS,
  '/api/consultorio': () => CONSULTORIO_DEMO,
  '/api/profissionais': () => PROFISSIONAIS,
  '/api/ausencias': () => [],
  '/api/pacientes': () => PACIENTES,
  '/api/prontuarios': () => PRONTUARIOS,
  '/api/receitas': () => RECEITAS,
  '/api/encaminhamentos': () => [],
  '/api/financeiro': () => LANCAMENTOS,
  '/api/financeiro/resumo': () => RESUMO,
  '/api/campanhas': () => CAMPANHAS,
  '/api/relatorios': () => RELATORIOS,
  '/api/lembretes': () => [],
  '/api/ia/painel': () => PAINEL_IA_EXEMPLO,
  '/api/notificacoes': () => [],
  '/api/usuarios': () => EQUIPE.map((u) => ({ ...u, email: `${u.id}@visaoclara.demo`, papel: u.id === 'prof-1' ? 'DONO' : 'ATENDENTE', ativo: true, atendePacientes: u.id !== 'user-3', telas: null })),
  '/api/perfil': () => ({ ...SESSAO_DEMO.user, fotoUrl: null, telefone: CONSULTORIO_DEMO.telefone }),
  // A conta do demo está em dia: é o `PortaoDeAcesso` que lê daqui, e uma
  // conta "bloqueada" trancaria o visitante na tela de cobrança.
  '/api/cobranca': () => ({
    consultorio: CONSULTORIO_DEMO.nome,
    plano: { nome: 'PRO', rotulo: 'Pro', inclui: [], precoTabela: 397, tetoUsuarios: 5, superiores: [] },
    online: { disponivel: false, ativo: false, forma: null, valorMensalidade: 397, documentoFinal: null },
    situacao: {
      bloqueado: false, emAtraso: false, diasDeAtraso: 0, valorEmAberto: 0,
      quantidadeEmAberto: 0, vencimentoMaisAntigo: null, diasCarencia: 5,
      primeiroPagamentoPendente: false,
    },
    pixDisponivel: false, pix: null, faturaAtual: null, faturas: [],
  }),
}

export const MENSAGEM_SO_LEITURA =
  'Isto é uma demonstração: nada é salvo. Crie sua conta para usar de verdade.'

/**
 * Resposta do demo para uma URL de API, ou `undefined` quando a rota não é
 * conhecida — nesse caso quem chama devolve lista vazia, que é o formato que
 * a maioria das telas espera e o único que não quebra render.
 */
export function respostaDemo(url: string): unknown {
  const caminho = url.split('?')[0].replace(/\/$/, '')
  const monta = RESPOSTAS[caminho]
  if (monta) return monta()

  // `/api/pacientes/pac-1` e afins: devolve o item quando der para achar.
  const partes = caminho.split('/').filter(Boolean)
  if (partes.length === 3) {
    const colecao = RESPOSTAS[`/${partes[0]}/${partes[1]}`]?.()
    if (Array.isArray(colecao)) {
      const achado = colecao.find((i: any) => i?.id === partes[2])
      if (achado) return achado
    }
  }
  return undefined
}
