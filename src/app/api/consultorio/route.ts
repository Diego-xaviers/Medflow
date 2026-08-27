import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { exigirSessao, exigirPapel } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { configConsultorioSchema } from '@/lib/schemas'
import { diasAtendidos, resumoExpediente } from '@/lib/agenda'

const campos = {
  id: true,
  nome: true,
  slug: true,
  telefone: true,
  endereco: true,
  logoUrl: true,
  duracaoConsultaMin: true,
  fusoHorario: true,
  criadoEm: true,
  blocosExpediente: {
    select: { id: true, diaSemana: true, inicioMin: true, fimMin: true },
    orderBy: [{ diaSemana: 'asc' }, { inicioMin: 'asc' }],
  },
} satisfies Prisma.ConsultorioSelect

/** Acrescenta o que a tela usa mas o banco não guarda: é tudo derivado. */
function comDerivados<T extends { blocosExpediente: any[]; duracaoConsultaMin: number; fusoHorario: string }>(c: T) {
  return {
    ...c,
    diasAtendimento: diasAtendidos(c),
    resumoExpediente: resumoExpediente(c),
  }
}

/**
 * Dados e configurações do consultório da sessão.
 *
 * Ler pode qualquer pessoa logada (a agenda precisa saber o expediente),
 * mas escrever é só do DONO — atendente não muda horário de funcionamento.
 */
export async function GET() {
  return rota(async () => {
    const { consultorioId } = await exigirSessao({ permitirEmAtraso: true })

    const consultorio = await prisma.consultorio.findUniqueOrThrow({
      where: { id: consultorioId },
      select: campos,
    })

    return comDerivados(consultorio)
  })
}

export async function PATCH(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO')
    const dados = configConsultorioSchema.parse(await req.json())

    // Os blocos são substituídos por inteiro, numa transação: editar em
    // diferença exigiria casar id por id, e o ganho seria zero num punhado de
    // linhas. Se algo falhar no meio, o expediente antigo continua de pé.
    await prisma.$transaction([
      prisma.consultorio.update({
        where: { id: consultorioId },
        data: {
          nome: dados.nome.trim(),
          telefone: dados.telefone?.trim() || null,
          endereco: dados.endereco?.trim() || null,
          duracaoConsultaMin: dados.duracaoConsultaMin,
          fusoHorario: dados.fusoHorario,
        },
      }),
      prisma.blocoExpediente.deleteMany({ where: { consultorioId } }),
      prisma.blocoExpediente.createMany({
        data: dados.blocos.map((b) => ({ ...b, consultorioId })),
      }),
    ])

    const consultorio = await prisma.consultorio.findUniqueOrThrow({
      where: { id: consultorioId },
      select: campos,
    })

    return comDerivados(consultorio)
  })
}
