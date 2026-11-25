import { carregarAgentes, estatisticasAgente } from '@/lib/agentesServidor'
import { completude } from '@/lib/agentesIA'
import { rota } from '@/lib/api'
import { dadosWhatsapp } from '@/lib/lotesServidor'
import { temRecurso } from '@/lib/planos'
import { prisma } from '@/lib/prisma'
import { exigirTela } from '@/lib/tenant'

export async function GET() {
  return rota(async () => {
    const { consultorioId, plano } = await exigirTela('/ia')
    if (!temRecurso(plano, 'iaPosVenda')) return { liberado: false }
    const [configs, whatsapp, equipe, { fusoHorario }] = await Promise.all([
      carregarAgentes(consultorioId),
      dadosWhatsapp(consultorioId),
      prisma.usuario.findMany({ where: { consultorioId, ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
      prisma.consultorio.findUniqueOrThrow({ where: { id: consultorioId }, select: { fusoHorario: true } }),
    ])
    const agora = new Date()
    const agentes = await Promise.all(configs.map(async (config) => ({
      config: config.tipo === 'POS_VENDA' ? { ...config, ativo: whatsapp.posVendaLigada } : config,
      completude: completude(config),
      estatisticas: await estatisticasAgente(consultorioId, config.tipo, agora, fusoHorario),
    })))
    return { liberado: true, agentes, whatsapp, equipe, fusoHorario }
  })
}
