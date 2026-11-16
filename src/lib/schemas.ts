import { z } from 'zod'
import { FUSOS_BR, NOMES_DIAS } from './agenda'
import { CODIGOS_FORMA } from './pagamento'

/**
 * Data sem horário (nascimento, vencimento, validade). "1990-05-10" vira
 * meio-dia UTC: `z.coerce.date()` gravaria meia-noite UTC, que no Brasil é
 * 21h do dia ANTERIOR — e a ficha mostraria 09/05. Meio-dia cai no mesmo dia
 * em qualquer fuso do país. Valor com horário passa direto.
 */
export const dataSemHora = z.preprocess(
  (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00Z` : v),
  z.coerce.date()
)

export const formaPagamentoSchema = z.enum(CODIGOS_FORMA)

export const pacienteSchema = z.object({
  nome: z.string().min(2, 'Informe o nome do paciente'),
  email: z.string().email('E-mail inválido').optional().nullable().or(z.literal('')),
  telefone: z.string().optional().nullable(),
  dataNascimento: dataSemHora.optional().nullable(),
  ativo: z.boolean().default(true),

  cpf: z.string().optional().nullable(),
  rg: z.string().optional().nullable(),
  sexo: z.string().optional().nullable(),
  profissao: z.string().optional().nullable(),

  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),

  convenio: z.string().optional().nullable(),
  observacoesGerais: z.string().optional().nullable(),
  origemContato: z.string().optional().nullable(),
})

export const consultaSchema = z.object({
  pacienteId: z.string().min(1, 'Selecione o paciente'),
  profissionalId: z.string().min(1, 'Selecione o profissional que vai atender'),
  dataHora: z.coerce.date(),
  valor: z.coerce.number().nonnegative().optional().nullable(),
  observacoes: z.string().optional(),
  campanhaId: z.string().optional().nullable(),
  formaPagamento: formaPagamentoSchema.optional().nullable(),
})

/** Dia no formato AAAA-MM-DD. */
const diaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')

export const campanhaSchema = z
  .object({
    nome: z.string().trim().min(2, 'Dê um nome à campanha').max(80),
    descricao: z.string().trim().max(300).optional().nullable(),
    inicio: diaSchema,
    fim: diaSchema,
    precoPromocional: z.coerce.number().positive('O preço deve ser maior que zero').optional().nullable(),
    descontoPercentual: z.coerce.number().int().min(1, 'Desconto mínimo de 1%').max(100).optional().nullable(),
    metaVendas: z.coerce.number().int().positive('A meta deve ser maior que zero').optional().nullable(),
    valorReferencia: z.coerce.number().positive('O valor de referência deve ser maior que zero').optional().nullable(),
    quemPagaDiferenca: z.enum(['CLINICA_PAGA', 'PARCEIRO_PAGA']).optional().nullable(),
    parceiroNome: z.string().trim().max(80).optional().nullable(),
  })
  .refine((c) => !c.valorReferencia || c.quemPagaDiferenca, {
    message: 'Diga quem paga a diferença quando a venda fechar',
    path: ['quemPagaDiferenca'],
  })
  .refine((c) => !c.valorReferencia || !c.precoPromocional || c.valorReferencia > c.precoPromocional, {
    message: 'O valor de referência precisa ser maior que o preço promocional',
    path: ['valorReferencia'],
  })
  .refine((c) => c.fim >= c.inicio, { message: 'O fim não pode ser antes do início', path: ['fim'] })
  .refine((c) => !(c.precoPromocional && c.descontoPercentual), {
    message: 'Escolha preço promocional OU desconto, não os dois',
    path: ['descontoPercentual'],
  })

export const metaFinanceiraSchema = z.object({
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'Use o formato AAAA-MM'),
  /// Nulo apaga a meta do mês.
  valor: z.coerce.number().positive('A meta deve ser maior que zero').nullable(),
})

export const lancamentoSchema = z.object({
  descricao: z.string().min(2, 'Informe a descrição'),
  valor: z.coerce.number().positive('O valor deve ser maior que zero'),
  tipo: z.enum(['RECEITA', 'DESPESA']),
  status: z.enum(['PAGO', 'PENDENTE']).default('PENDENTE'),
  data: dataSemHora,
  pacienteId: z.string().optional().nullable(),
  formaPagamento: formaPagamentoSchema.optional().nullable(),
})

/** Agendamento público: só o mínimo, sem login. */
export const agendamentoPublicoSchema = z.object({
  nome: z.string().min(2, 'Informe seu nome'),
  telefone: z.string().min(8, 'Informe um telefone válido'),
  profissionalId: z.string().min(1, 'Escolha com quem quer ser atendido'),
  vendedoraResponsavel: z.string().optional().nullable(),
  dataHora: z.coerce.date(),
})

export const novoConsultorioSchema = z.object({
  nomeConsultorio: z.string().min(2, 'Informe o nome do consultório'),
  telefone: z.string().optional(),
  endereco: z.string().optional(),
  nomeDono: z.string().min(2, 'Informe o nome do responsável'),
  emailDono: z.string().email('E-mail inválido'),
  senhaDono: z.string().min(8, 'A senha deve ter ao menos 8 caracteres'),
})

/**
 * Cadastro feito pela própria pessoa na vitrine.
 *
 * É o `novoConsultorioSchema` com duas coisas que só existem quando não há
 * administrador na frente: o plano que ela escolheu no card e o aceite dos
 * termos, que precisa ser um ato dela — por isso `literal(true)`, e não
 * `boolean`: um `false` que passasse viraria consentimento registrado sem
 * consentimento dado.
 */
export const cadastroSchema = novoConsultorioSchema.extend({
  plano: z.enum(['BASICO', 'PRO', 'ULTRA']),
  aceiteTermos: z.literal(true, {
    errorMap: () => ({ message: 'É preciso aceitar os termos de uso' }),
  }),
})

export const novoUsuarioSchema = z.object({
  nome: z.string().min(2, 'Informe o nome'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres'),
  papel: z.enum(['ATENDENTE', 'VENDEDORA']),
  /// Separado do papel de propósito: atender pacientes é uma atribuição, não
  /// um nível de acesso. Uma atendente pode fazer exames sem virar dona.
  atendePacientes: z.boolean().default(false),
})

export const prontuarioSchema = z.object({
  pacienteId: z.string().min(1, 'Selecione o paciente'),
  consultaId: z.string().optional().nullable(),
  /// Dia do exame. Ausente = hoje na criação, sem mudança na edição.
  /// Existe para a clínica migrar o histórico de exames antigos.
  dataExame: diaSchema.optional(),

  queixaPrincipal: z.string().optional(),
  historicoOcular: z.string().optional(),
  historicoSistemico: z.string().optional(),
  medicamentosEmUso: z.string().optional(),
  usaCorrecaoAtual: z.boolean().default(false),
  tempoUltimoExame: z.string().optional(),
  necessidadeUso: z.string().optional(),

  grauAtualEsfericoOD: z.string().optional(),
  grauAtualCilindricoOD: z.string().optional(),
  grauAtualEixoOD: z.string().optional(),
  grauAtualEsfericoOE: z.string().optional(),
  grauAtualCilindricoOE: z.string().optional(),
  grauAtualEixoOE: z.string().optional(),
  grauAtualAdicaoOD: z.string().optional(),
  grauAtualAdicaoOE: z.string().optional(),
  /// Vazio no formulário vira nulo: o tipo é escolhido só para quem usa óculos.
  tipoLenteAtual: z.preprocess((v) => (v === '' ? null : v),
    z.enum(['MONOFOCAL', 'BIFOCAL', 'MULTIFOCAL', 'OCUPACIONAL', 'CONTATO']).nullable().optional()),

  avSemCorrecaoOD: z.string().optional(),
  avSemCorrecaoOE: z.string().optional(),
  avComCorrecaoOD: z.string().optional(),
  avComCorrecaoOE: z.string().optional(),

  refracaoEsfericoOD: z.string().optional(),
  refracaoCilindricoOD: z.string().optional(),
  refracaoEixoOD: z.string().optional(),
  refracaoEsfericoOE: z.string().optional(),
  refracaoCilindricoOE: z.string().optional(),
  refracaoEixoOE: z.string().optional(),

  adicaoOD: z.string().optional(),
  adicaoOE: z.string().optional(),

  biomicroscopia: z.string().optional(),
  tonometriaOD: z.string().optional(),
  tonometriaOE: z.string().optional(),
  fundoscopia: z.string().optional(),
  motilidadeOcular: z.string().optional(),
  testeCobertura: z.string().optional(),
  reflexosPupilares: z.string().optional(),
  visaoCores: z.string().optional(),

  diagnostico: z.string().optional(),
  conduta: z.string().optional(),
  observacoes: z.string().optional(),
})

export const receitaSchema = z.object({
  pacienteId: z.string().min(1, 'Selecione o paciente'),
  /// Quem assina. Se não vier, a rota usa quem está logado.
  profissionalId: z.string().optional().nullable(),
  prontuarioId: z.string().optional().nullable(),
  /// Dia da emissão. Ausente = hoje na criação, sem mudança na edição.
  dataEmissao: diaSchema.optional(),
  validadeAte: dataSemHora,

  longeEsfericoOD: z.string().optional(),
  longeCilindricoOD: z.string().optional(),
  longeEixoOD: z.string().optional(),
  longeEsfericoOE: z.string().optional(),
  longeCilindricoOE: z.string().optional(),
  longeEixoOE: z.string().optional(),

  pertoEsfericoOD: z.string().optional(),
  pertoCilindricoOD: z.string().optional(),
  pertoEixoOD: z.string().optional(),
  pertoEsfericoOE: z.string().optional(),
  pertoCilindricoOE: z.string().optional(),
  pertoEixoOE: z.string().optional(),

  adicaoOD: z.string().optional(),
  adicaoOE: z.string().optional(),

  /// AV alcançada com o grau prescrito — o resultado da lente nova, não a
  /// medida do estado atual (essa fica no prontuário).
  avCorrigidaOD: z.string().optional(),
  avCorrigidaOE: z.string().optional(),
  avPertoOD: z.string().optional(),
  avPertoOE: z.string().optional(),

  dpLongeOD: z.string().optional(),
  dpLongeOE: z.string().optional(),
  dpPerto: z.string().optional(),
  alturaOD: z.string().optional(),
  alturaOE: z.string().optional(),

  prismaOD: z.string().optional(),
  baseprismaOD: z.string().optional(),
  prismaOE: z.string().optional(),
  baseprismaOE: z.string().optional(),

  tipoLente: z.enum(['MONOFOCAL', 'BIFOCAL', 'MULTIFOCAL', 'OCUPACIONAL', 'CONTATO']).default('MONOFOCAL'),
  tipoReceita: z.enum(['OFTALMOLOGICA', 'OPTOMETRICA']).default('OPTOMETRICA'),
  materialLente: z.string().optional(),
  tratamentos: z.string().optional(),
  orientacoesUso: z.string().optional(),
})

export const ausenciaSchema = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  /// Em branco = dia inteiro.
  horaInicio: z.string().optional(),
  horaFim: z.string().optional(),
  motivo: z.string().max(200).optional(),
})

export const encaminhamentoSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o nome do documento').max(80).default('Encaminhamento'),
  pacienteNome: z.string().trim().min(1, 'Informe o nome do paciente').max(200),
  texto: z.string().trim().min(1, 'Escreva o encaminhamento').max(10000),
})

/**
 * Configurações do consultório. O expediente vai como lista de blocos —
 * um intervalo contínuo num dia da semana — porque é isso que permite
 * "sábado só até meio-dia" e o fecha-para-almoço no mesmo modelo.
 */
const blocoSchema = z
  .object({
    diaSemana: z.coerce.number().int().min(0).max(6),
    inicioMin: z.coerce.number().int().min(0).max(1439),
    fimMin: z.coerce.number().int().min(1).max(1440),
  })
  .refine((b) => b.fimMin > b.inicioMin, {
    message: 'O fim do horário precisa ser depois do início',
    path: ['fimMin'],
  })

export const configConsultorioSchema = z
  .object({
    nome: z.string().min(2, 'Informe o nome do consultório'),
    telefone: z.string().optional(),
    endereco: z.string().optional(),
    duracaoConsultaMin: z.coerce.number().int()
      .min(5, 'A consulta deve durar ao menos 5 minutos')
      .max(240, 'A consulta não pode passar de 4 horas'),
    // Validado contra a lista de fusos brasileiros: o campo alimenta cálculo
    // de horário, e um valor inválido faria o expediente inteiro escorregar.
    fusoHorario: z.enum(FUSOS_BR.map((f) => f.valor) as [string, ...string[]]),
    blocos: z.array(blocoSchema).min(1, 'Defina ao menos um horário de atendimento'),
  })
  .superRefine((dados, ctx) => {
    // Dois blocos que se cruzam no mesmo dia gerariam horários repetidos na
    // tela pública — e o paciente veria a mesma hora duas vezes.
    const porDia = new Map<number, typeof dados.blocos>()
    for (const b of dados.blocos) {
      porDia.set(b.diaSemana, [...(porDia.get(b.diaSemana) ?? []), b])
    }

    for (const [dia, blocos] of Array.from(porDia.entries())) {
      const ordenados = [...blocos].sort((a, b) => a.inicioMin - b.inicioMin)
      for (let i = 1; i < ordenados.length; i++) {
        if (ordenados[i].inicioMin < ordenados[i - 1].fimMin) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${NOMES_DIAS[dia]}: há dois horários que se sobrepõem`,
            path: ['blocos'],
          })
          break
        }
      }
    }
  })

export const perfilSchema = z.object({
  nome: z.string().min(2, 'Informe seu nome'),
  email: z.string().email('E-mail inválido'),
  /// Conselho e registro saem impressos na receita. Ficam livres porque a
  /// sigla varia com a formação — CBOO, CRM, CRO — e travar numa lista
  /// deixaria de fora quem tem outra.
  conselhoProfissional: z.string().max(20).optional(),
  registroProfissional: z.string().max(40).optional(),
})

export const trocaSenhaSchema = z.object({
  senhaAtual: z.string().min(1, 'Informe a senha atual'),
  novaSenha: z.string().min(8, 'A nova senha deve ter ao menos 8 caracteres'),
})
