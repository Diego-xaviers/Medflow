import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirSuperAdmin } from '@/lib/tenant'
import { rota, ErroDeNegocio } from '@/lib/api'
import { dataSemHora } from '@/lib/schemas'
import { notificar, equipeDoConsultorio } from '@/lib/notificacoes'
import { moeda, data as fmtData } from '@/lib/formato'

const novaFaturaSchema = z.object({
  consultorioId: z.string().min(1, 'Escolha o consultório'),
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'Use o formato AAAA-MM'),
  descricao: z.string().max(120).optional(),
  valor: z.coerce.number().positive('O valor deve ser maior que zero'),
  vencimento: dataSemHora,
})

/** Faturas de todos os consultórios, para a área do administrador. */
export async function GET(req: NextRequest) {
  return rota(async () => {
    await exigirSuperAdmin()
    const consultorioId = req.nextUrl.searchParams.get('consultorio')

    const faturas = await prisma.fatura.findMany({
      where: consultorioId ? { consultorioId } : undefined,
      orderBy: [{ status: 'asc' }, { vencimento: 'desc' }],
      take: 100,
      include: { consultorio: { select: { id: true, nome: true } } },
    })

    return faturas.map((f) => ({ ...f, valor: Number(f.valor) }))
  })
}

export async function POST(req: NextRequest) {
  return rota(async () => {
    await exigirSuperAdmin()
    const dados = novaFaturaSchema.parse(await req.json())

    const consultorio = await prisma.consultorio.findUnique({
      where: { id: dados.consultorioId },
      select: { id: true, nome: true, asaasAssinaturaId: true },
    })
    if (!consultorio) throw new ErroDeNegocio('Consultório não encontrado')
    // Com assinatura ativa a fatura do mês vem do Asaas; lançar outra à mão
    // cobraria duas vezes.
    if (consultorio.asaasAssinaturaId) {
      throw new ErroDeNegocio('Este consultório paga por assinatura automática — as faturas vêm do Asaas.')
    }

    const repetida = await prisma.fatura.findFirst({
      where: {
        consultorioId: consultorio.id,
        competencia: dados.competencia,
        status: { not: 'CANCELADA' },
      },
      select: { id: true },
    })
    if (repetida) {
      throw new ErroDeNegocio(`Já existe fatura de ${dados.competencia} para ${consultorio.nome}.`)
    }

    const fatura = await prisma.fatura.create({ data: dados })

    // A equipe é avisada na hora: uma cobrança que só aparece no dia do
    // bloqueio pega todo mundo de surpresa.
    await notificar({
      usuarioIds: await equipeDoConsultorio(consultorio.id, { papeis: ['DONO'] }),
      consultorioId: consultorio.id,
      tipo: 'COBRANCA',
      titulo: `Nova fatura — ${moeda(Number(fatura.valor))}`,
      descricao: `Competência ${fatura.competencia}, vence em ${fmtData(fatura.vencimento)}`,
      link: '/cobranca',
    })

    return { ...fatura, valor: Number(fatura.valor) }
  })
}
