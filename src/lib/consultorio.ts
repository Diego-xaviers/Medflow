import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { ErroDeNegocio } from './api'
import { gerarSlugUnico } from './slug'
import { BLOCOS_PADRAO } from './agenda'
import type { Plano } from '@prisma/client'

export interface NovoConsultorio {
  nomeConsultorio: string
  telefone?: string
  endereco?: string
  nomeDono: string
  emailDono: string
  senhaDono: string
  plano?: Plano
  /**
   * Mensalidade já definida no nascimento. O cadastro público manda o preço
   * de tabela do plano escolhido porque sem valor a tela de Cobrança não
   * oferece assinatura (`ativarAssinatura` recusa sem ele) — e o cliente que
   * se cadastrou sozinho ficaria sem como pagar, esperando um administrador
   * que ele nem sabe que existe. O admin não manda: ele digita o valor
   * negociado depois, na tela do consultório.
   */
  valorMensalidade?: number
  /**
   * Trava o sistema até a primeira mensalidade ser paga. Só o cadastro
   * público manda `true`: quem chega pela vitrine assina para entrar. O admin
   * não manda — cliente dele é negociado fora e entra usando no mesmo dia.
   */
  exigePagamentoInicial?: boolean
}

/**
 * Nascimento de um consultório. Dois caminhos chegam aqui — o admin cadastrando
 * um cliente e a pessoa se cadastrando sozinha na vitrine — e os dois precisam
 * criar exatamente a mesma coisa.
 *
 * Mora fora das rotas porque o que se perde ao duplicar isto não aparece como
 * erro: o consultório nasce sem expediente e o link público abre sem horário,
 * ou nasce sem `atendePacientes` e a agenda abre sem ninguém que atenda. Quem
 * copiasse a rota um dia esqueceria um dos dois e ninguém veria no mesmo dia.
 */
export async function criarConsultorioComDono(dados: NovoConsultorio) {
  const email = dados.emailDono.toLowerCase().trim()
  const jaExiste = await prisma.usuario.findUnique({ where: { email }, select: { id: true } })
  if (jaExiste) throw new ErroDeNegocio('Já existe um usuário com esse e-mail')

  const slug = await gerarSlugUnico(dados.nomeConsultorio)
  const senhaHash = await bcrypt.hash(dados.senhaDono, 12)

  // Consultório e dono nascem juntos: um consultório sem dono seria
  // inacessível, então os dois vão na mesma transação.
  return prisma.consultorio.create({
    data: {
      nome: dados.nomeConsultorio,
      slug,
      telefone: dados.telefone || null,
      endereco: dados.endereco || null,
      // Omitido cai no default do schema (BASICO): plano novo nunca nasce
      // pago por omissão.
      ...(dados.plano ? { plano: dados.plano } : {}),
      ...(dados.valorMensalidade ? { valorMensalidade: dados.valorMensalidade } : {}),
      ...(dados.exigePagamentoInicial ? { exigePagamentoInicial: true } : {}),
      // Sem expediente, o link público nasce sem horário para oferecer.
      blocosExpediente: { create: BLOCOS_PADRAO },
      usuarios: {
        create: {
          nome: dados.nomeDono,
          email,
          senhaHash,
          papel: 'DONO',
          // Sem isto o consultório nasce sem ninguém marcado como quem
          // atende — e o link público, que só oferece profissionais, abre
          // dizendo "agenda ainda não liberada". O dono é o optometrista:
          // é ele quem atende até que a equipe cresça.
          atendePacientes: true,
        },
      },
    },
  })
}

/** Tira da resposta o que só o servidor pode ver da instância do WhatsApp. */
export function semSegredosWhatsapp<T extends Record<string, any>>(c: T) {
  const { whatsappInstanciaId, whatsappInstanciaToken, whatsappSegredoWebhook, ...resto } = c
  return resto
}
