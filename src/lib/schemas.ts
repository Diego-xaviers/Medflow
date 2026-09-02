import { z } from 'zod'
import { FUSOS_BR, NOMES_DIAS } from './agenda'

export const pacienteSchema = z.object({
  nome: z.string().min(2, 'Informe o nome do paciente'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  telefone: z.string().optional(),
  dataNascimento: z.coerce.date().optional().nullable(),
  ativo: z.boolean().default(true),

  cpf: z.string().optional(),
  rg: z.string().optional(),
  sexo: z.string().optional(),
  profissao: z.string().optional(),

  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),

  convenio: z.string().optional(),
  observacoesGerais: z.string().optional(),
  origemContato: z.string().optional(),
})

export const consultaSchema = z.object({
  pacienteId: z.string().min(1, 'Selecione o paciente'),
  profissionalId: z.string().min(1, 'Selecione o profissional que vai atender'),
  dataHora: z.coerce.date(),
  valor: z.coerce.number().nonnegative().optional().nullable(),
  observacoes: z.string().optional(),
})

export const lancamentoSchema = z.object({
  descricao: z.string().min(2, 'Informe a descrição'),
  valor: z.coerce.number().positive('O valor deve ser maior que zero'),
  tipo: z.enum(['RECEITA', 'DESPESA']),
  status: z.enum(['PAGO', 'PENDENTE']).default('PENDENTE'),
  data: z.coerce.date(),
  pacienteId: z.string().optional().nullable(),
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

  queixaPrincipal: z.string().optional(),
  historicoOcular: z.string().optional(),
  historicoSistemico: z.string().optional(),
  medicamentosEmUso: z.string().optional(),
  usaCorrecaoAtual: z.boolean().default(false),
  tempoUltimoExame: z.string().optional(),

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
  validadeAte: z.coerce.date(),

  longeEsfericoOD: z.string().optional(),
  longeCilindricoOD: z.string().optional(),
  longeEixoOD: z.string().optional(),
  longeEsfericoOE: z.string().optional(),
  longeCilindricoOE: z.string().optional(),
  longeEixoOE: z.string().optional(),

  adicaoOD: z.string().optional(),
  adicaoOE: z.string().optional(),

  /// AV alcançada com o grau prescrito — o resultado da lente nova, não a
  /// medida do estado atual (essa fica no prontuário).
  avCorrigidaOD: z.string().optional(),
  avCorrigidaOE: z.string().optional(),

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
