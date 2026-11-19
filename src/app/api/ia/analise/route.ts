import { startOfDay, startOfMonth, subMonths } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { rota, ErroDeNegocio } from '@/lib/api'
import { calcularRelatorio } from '@/lib/relatorios'
import { analisarConsultorio, dadosParaAnalise, podeRecalcular } from '@/lib/iaAnalise'
import { liberarHoje, montarPainel, proporLotes, tamanhosDosLotes } from '@/lib/lotesServidor'
import { exigirAssistente } from '../acesso'

/**
 * "Começar" / "Atualizar análise": refaz os lotes e pede à IA a leitura dos
 * últimos 6 meses. No máximo uma vez por hora por consultório.
 */
export async function POST() {
  return rota(async () => {
    const { consultorioId } = await exigirAssistente()

    const ultima = await prisma.analiseIA.findFirst({
      where: { consultorioId },
      orderBy: { criadoEm: 'desc' },
      select: { criadoEm: true },
    })
    const agora = new Date()
    if (!podeRecalcular(ultima?.criadoEm ?? null, agora)) {
      throw new ErroDeNegocio('A análise foi atualizada há pouco. Tente de novo em alguns minutos.')
    }

    await proporLotes(consultorioId, agora)
    const [relatorio, tamanhos, consultorio] = await Promise.all([
      calcularRelatorio(consultorioId, startOfDay(startOfMonth(subMonths(agora, 5))), agora),
      tamanhosDosLotes(consultorioId),
      prisma.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { nome: true } }),
    ])
    const analise = await analisarConsultorio(dadosParaAnalise(relatorio, tamanhos), consultorio.nome)
    await prisma.analiseIA.create({ data: { consultorioId, conteudo: analise as object } })

    await liberarHoje(consultorioId, agora)
    return montarPainel(consultorioId)
  })
}
