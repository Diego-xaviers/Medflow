import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSessao, exigirPapel } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { configConsultorioSchema } from '@/lib/schemas'
import { diasAtendidos } from '@/lib/agenda'

const campos = {
  id: true,
  nome: true,
  slug: true,
  telefone: true,
  endereco: true,
  horaAbertura: true,
  horaFechamento: true,
  duracaoConsultaMin: true,
  diasAtendimento: true,
  fusoHorario: true,
  criadoEm: true,
} as const

/**
 * Dados e configurações do consultório da sessão.
 *
 * Ler pode qualquer pessoa logada (a agenda precisa saber o expediente),
 * mas escrever é só do DONO — atendente não muda horário de funcionamento.
 */
export async function GET() {
  return rota(async () => {
    const { consultorioId } = await exigirSessao()

    const consultorio = await prisma.consultorio.findUniqueOrThrow({
      where: { id: consultorioId },
      select: campos,
    })

    // O array é o formato que a tela usa; a string é o que o banco guarda.
    return { ...consultorio, diasAtendimento: diasAtendidos(consultorio) }
  })
}

export async function PATCH(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirPapel('DONO')
    const dados = configConsultorioSchema.parse(await req.json())

    const consultorio = await prisma.consultorio.update({
      where: { id: consultorioId },
      data: {
        nome: dados.nome.trim(),
        telefone: dados.telefone?.trim() || null,
        endereco: dados.endereco?.trim() || null,
        horaAbertura: dados.horaAbertura,
        horaFechamento: dados.horaFechamento,
        duracaoConsultaMin: dados.duracaoConsultaMin,
        // Ordenado e sem repetição: "3,1,1" viraria bagunça na leitura.
        diasAtendimento: Array.from(new Set(dados.diasAtendimento)).sort().join(','),
        fusoHorario: dados.fusoHorario,
      },
      select: campos,
    })

    return { ...consultorio, diasAtendimento: diasAtendidos(consultorio) }
  })
}
