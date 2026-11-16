/**
 * Os dados da prévia da apresentação. Tudo inventado.
 *
 * A prévia é a única prova que o visitante tem do produto: não existe trial,
 * porque conta grátis com IA ligada é prejuízo direto. Então a vitrine mostra
 * o sistema de mentira, e isso impõe duas regras a este arquivo:
 *
 *   1. Nome nenhum aqui pode ser de paciente real, nem de clínica real. São
 *      pessoas inventadas, e é por isso que os dados moram num módulo só —
 *      para ninguém "pegar um exemplo do banco" na correria.
 *   2. Nada aqui atravessa rede. Sem fetch, sem sessão, sem rota de API: não
 *      existe conta para abusar, e a IA não é alcançável a partir da prévia.
 *
 * Os números são plausíveis de propósito. Clínica que fatura R$ 1,2 milhão no
 * mês não convence ninguém que atende 20 pacientes por dia — e uma prévia que
 * não parece possível vira desconfiança, não desejo.
 */

export interface ConsultaPrevia {
  hora: string
  paciente: string
  tipo: string
  status: 'CONFIRMADA' | 'AGUARDANDO' | 'ATENDIDA'
}

export const AGENDA_PREVIA: ConsultaPrevia[] = [
  { hora: '08:00', paciente: 'Helena Barros', tipo: 'Consulta de rotina', status: 'ATENDIDA' },
  { hora: '08:30', paciente: 'Caio Nogueira', tipo: 'Adaptação de lente', status: 'ATENDIDA' },
  { hora: '09:00', paciente: 'Marta Vilela', tipo: 'Retorno', status: 'CONFIRMADA' },
  { hora: '09:30', paciente: 'Otávio Lins', tipo: 'Exame de refração', status: 'CONFIRMADA' },
  { hora: '10:00', paciente: 'Bianca Teixeira', tipo: 'Primeira consulta', status: 'AGUARDANDO' },
  { hora: '10:30', paciente: 'Rogério Pinto', tipo: 'Consulta de rotina', status: 'AGUARDANDO' },
]

export const KPIS_PREVIA = [
  { rotulo: 'Faturamento do mês', valor: 'R$ 48.350', variacao: '+12%' },
  { rotulo: 'Consultas na semana', valor: '63', variacao: '+8%' },
  { rotulo: 'Pacientes ativos', valor: '412', variacao: '+5%' },
  { rotulo: 'Taxa de retorno', valor: '38%', variacao: '+3%' },
]

export const PRONTUARIO_PREVIA = {
  paciente: 'Marta Vilela',
  idade: 42,
  data: '12/11/2026',
  queixa: 'Dificuldade para ler de perto há cerca de seis meses, com cansaço no fim do dia.',
  exame: 'Acuidade visual 20/30 em ambos os olhos. Fundo de olho sem alterações.',
  conduta: 'Prescrição de lentes para perto. Retorno em 6 meses.',
}

export const RECEITA_PREVIA = {
  paciente: 'Marta Vilela',
  tipo: 'Optométrica',
  olhos: [
    { olho: 'OD', esferico: '+1,25', cilindrico: '-0,50', eixo: '180°', adicao: '+1,00' },
    { olho: 'OE', esferico: '+1,50', cilindrico: '-0,25', eixo: '175°', adicao: '+1,00' },
  ],
  observacao: 'Uso permanente para leitura e trabalho em computador.',
}

export const FINANCEIRO_PREVIA = {
  entradas: 'R$ 52.100',
  saidas: 'R$ 18.740',
  saldo: 'R$ 33.360',
  lancamentos: [
    { data: '14/11', descricao: 'Consultas particulares', categoria: 'Receita', valor: 'R$ 3.400', entrada: true },
    { data: '13/11', descricao: 'Convênio Visão+', categoria: 'Receita', valor: 'R$ 2.180', entrada: true },
    { data: '12/11', descricao: 'Aluguel da sala', categoria: 'Fixo', valor: 'R$ 4.200', entrada: false },
    { data: '11/11', descricao: 'Lentes de teste', categoria: 'Insumo', valor: 'R$ 860', entrada: false },
  ],
}

export const RELATORIO_PREVIA = {
  meses: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov'],
  // Altura relativa das barras, em porcentagem. Guardado pronto para a prévia
  // não precisar de biblioteca de gráfico só para desenhar seis retângulos.
  barras: [52, 61, 58, 74, 83, 96],
  topProcedimentos: [
    { nome: 'Consulta de rotina', total: 184 },
    { nome: 'Exame de refração', total: 121 },
    { nome: 'Adaptação de lente', total: 76 },
    { nome: 'Retorno', total: 54 },
  ],
}
