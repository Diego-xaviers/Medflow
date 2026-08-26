import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const jaTemDados = await prisma.usuario.count()
  if (jaTemDados > 0) {
    console.log('Banco já populado — nada a fazer.')
    return
  }

  const senhaPadrao = await bcrypt.hash('medflow123', 12)

  // 1. Super admin (você) — não pertence a consultório nenhum
  await prisma.usuario.create({
    data: {
      nome: 'Diego Xavier',
      email: 'diego@medflow.com',
      senhaHash: senhaPadrao,
      papel: 'SUPER_ADMIN',
    },
  })

  // 2. Consultório de demonstração com a equipe
  const consultorio = await prisma.consultorio.create({
    data: {
      nome: 'Ótica Exemplo',
      slug: 'otica-exemplo-demo',
      telefone: '(66) 99999-0000',
      fusoHorario: 'America/Cuiaba',
      // Seg a sex 8h-18h e sábado até meio-dia — o caso que motivou os blocos.
      blocosExpediente: {
        create: [
          ...[1, 2, 3, 4, 5].map((diaSemana) => ({ diaSemana, inicioMin: 480, fimMin: 1080 })),
          { diaSemana: 6, inicioMin: 480, fimMin: 720 },
        ],
      },
      usuarios: {
        create: [
          { nome: 'Optometrista Demo', email: 'optometrista@exemplo.com', senhaHash: senhaPadrao, papel: 'DONO', atendePacientes: true },
          { nome: 'Ana Paula', email: 'ana@exemplo.com', senhaHash: senhaPadrao, papel: 'ATENDENTE' },
          { nome: 'Carla Mendes', email: 'carla@exemplo.com', senhaHash: senhaPadrao, papel: 'VENDEDORA' },
          { nome: 'Juliana Reis', email: 'juliana@exemplo.com', senhaHash: senhaPadrao, papel: 'VENDEDORA' },
        ],
      },
    },
  })

  const cid = consultorio.id

  // Quem atende. Os usuários nascem aninhados no consultório acima, então
  // buscamos o optometrista aqui para poder amarrar as consultas a ele.
  const optometrista = await prisma.usuario.findFirstOrThrow({
    where: { consultorioId: cid, papel: 'DONO' },
    select: { id: true },
  })

  // 3. Pacientes
  const fichas = [
    { nome: 'Maurilio Santos', telefone: '(66) 99911-2233', email: 'maurilio@email.com',
      dataNascimento: new Date('1982-04-12'), sexo: 'Masculino', profissao: 'Motorista',
      cidade: 'Juara', estado: 'MT', bairro: 'Centro', convenio: 'Particular',
      origemContato: 'Indicação de amigo' },
    { nome: 'Lauanna Ferreira', telefone: '(66) 99822-4455', email: 'lauanna@email.com',
      dataNascimento: new Date('1995-09-03'), sexo: 'Feminino', profissao: 'Professora',
      cidade: 'Juara', estado: 'MT', bairro: 'Jardim Aeroporto', convenio: 'Unimed',
      origemContato: 'Instagram' },
    { nome: 'Angelica Souza', telefone: '(66) 99788-1122', email: 'angelica@email.com',
      dataNascimento: new Date('1978-01-25'), sexo: 'Feminino', profissao: 'Comerciante',
      cidade: 'Juara', estado: 'MT', convenio: 'Particular' },
    { nome: 'Rafael Lima', telefone: '(66) 99733-6677', email: 'rafael@email.com',
      dataNascimento: new Date('2001-11-18'), sexo: 'Masculino', profissao: 'Estudante',
      cidade: 'Juara', estado: 'MT', origemContato: 'Link online' },
    { nome: 'Beatriz Nogueira', telefone: '(66) 99644-8899', email: 'beatriz@email.com',
      dataNascimento: new Date('1990-06-30'), sexo: 'Feminino', profissao: 'Enfermeira',
      cidade: 'Juara', estado: 'MT', convenio: 'Unimed' },
    { nome: 'Carlos Eduardo Alves', telefone: '(66) 99555-7788',
      dataNascimento: new Date('1965-02-08'), sexo: 'Masculino', profissao: 'Aposentado',
      cidade: 'Juara', estado: 'MT', observacoesGerais: 'Prefere atendimento no período da manhã.' },
  ]
  const pacientes = []
  for (const ficha of fichas) {
    pacientes.push(await prisma.paciente.create({ data: { ...ficha, consultorioId: cid } }))
  }

  // 4. Consultas de hoje e dias próximos
  const hoje = new Date()
  const emHora = (dias: number, h: number, m = 0) => {
    const d = new Date(hoje)
    d.setDate(d.getDate() + dias)
    d.setHours(h, m, 0, 0)
    return d
  }

  await prisma.consulta.createMany({
    data: [
      { pacienteId: pacientes[0].id, dataHora: emHora(0, 9), status: 'CONCLUIDA', valor: 69.9, profissionalId: optometrista.id, consultorioId: cid },
      { pacienteId: pacientes[1].id, dataHora: emHora(0, 10, 30), status: 'AGENDADA', valor: 120, origemPublica: true, telefoneContato: '(66) 99822-4455', vendedoraResponsavel: 'Carla Mendes', profissionalId: optometrista.id, consultorioId: cid },
      { pacienteId: pacientes[2].id, dataHora: emHora(-1, 14), status: 'FALTA', valor: 80, profissionalId: optometrista.id, consultorioId: cid },
      { pacienteId: pacientes[3].id, dataHora: emHora(1, 11), status: 'AGENDADA', valor: 95, origemPublica: true, telefoneContato: '(66) 99733-6677', vendedoraResponsavel: 'Juliana Reis', profissionalId: optometrista.id, consultorioId: cid },
      { pacienteId: pacientes[4].id, dataHora: emHora(0, 15, 30), status: 'AGENDADA', valor: 110, profissionalId: optometrista.id, consultorioId: cid },
    ],
  })

  // 5. Financeiro — mês atual e histórico para o gráfico
  await prisma.lancamento.createMany({
    data: [
      { descricao: 'Consulta — Maurilio Santos', valor: 69.9, tipo: 'RECEITA', status: 'PAGO', data: hoje, pacienteId: pacientes[0].id, consultorioId: cid },
      { descricao: 'Consulta — Lauanna Ferreira', valor: 120, tipo: 'RECEITA', status: 'PENDENTE', data: hoje, pacienteId: pacientes[1].id, consultorioId: cid },
      { descricao: 'Aluguel da clínica', valor: 1800, tipo: 'DESPESA', status: 'PAGO', data: new Date(hoje.getFullYear(), hoje.getMonth(), 5), consultorioId: cid },
    ],
  })

  for (let i = 1; i <= 6; i++) {
    const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 10)
    await prisma.lancamento.createMany({
      data: [
        { descricao: 'Receitas do mês', valor: 150 + i * 17, tipo: 'RECEITA', status: 'PAGO', data: mes, consultorioId: cid },
        { descricao: 'Despesas do mês', valor: 40 + i * 3, tipo: 'DESPESA', status: 'PAGO', data: new Date(mes.getFullYear(), mes.getMonth(), 12), consultorioId: cid },
      ],
    })
  }

  // 6. Um prontuário e uma receita de exemplo
  const prontuario = await prisma.prontuario.create({
    data: {
      pacienteId: pacientes[0].id,
      consultorioId: cid,
      queixaPrincipal: 'Dificuldade para enxergar de longe e dor de cabeça no fim do dia',
      historicoOcular: 'Usa óculos há 6 anos',
      usaCorrecaoAtual: true,
      tempoUltimoExame: 'Há 2 anos',
      avSemCorrecaoOD: '20/60',
      avSemCorrecaoOE: '20/50',
      avComCorrecaoOD: '20/20',
      avComCorrecaoOE: '20/20',
      refracaoEsfericoOD: '-1.75',
      refracaoCilindricoOD: '-0.50',
      refracaoEixoOD: '180',
      refracaoEsfericoOE: '-1.50',
      refracaoCilindricoOE: '-0.75',
      refracaoEixoOE: '175',
      biomicroscopia: 'Segmento anterior sem alterações',
      tonometriaOD: '14 mmHg',
      tonometriaOE: '15 mmHg',
      fundoscopia: 'Papila e mácula de aspecto normal',
      motilidadeOcular: 'Preservada nas nove posições do olhar',
      diagnostico: 'Miopia com astigmatismo em ambos os olhos',
      conduta: 'Prescrição de lentes corretivas e retorno em 12 meses',
    },
  })

  const validade = new Date(hoje)
  validade.setFullYear(validade.getFullYear() + 1)

  await prisma.receita.create({
    data: {
      pacienteId: pacientes[0].id,
      prontuarioId: prontuario.id,
      consultorioId: cid,
      validadeAte: validade,
      longeEsfericoOD: '-1.75',
      longeCilindricoOD: '-0.50',
      longeEixoOD: '180',
      longeEsfericoOE: '-1.50',
      longeCilindricoOE: '-0.75',
      longeEixoOE: '175',
      dpLongeOD: '32',
      dpLongeOE: '32',
      tipoLente: 'MONOFOCAL',
      materialLente: 'Policarbonato',
      tratamentos: 'Antirreflexo + proteção UV',
      orientacoesUso: 'Uso contínuo',
    },
  })

  console.log(`
  ═══════════════════════════════════════════════
   Medflow populado com sucesso.

   Super admin ........ diego@medflow.com / medflow123
   Dono do consultório  optometrista@exemplo.com / medflow123
   Link público ....... /agendar/${consultorio.slug}
  ═══════════════════════════════════════════════
  `)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
