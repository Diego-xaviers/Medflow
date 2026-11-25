import { randomBytes } from 'crypto'
import { prisma } from './prisma'
import { ErroDeNegocio } from './api'
import { notificar, equipeDoConsultorio, superAdmins } from './notificacoes'
import { statusAposSalvar } from './whatsappRegras'

/** Ultra pagou: a instância precisa ser criada à mão. Idempotente: só avisa na primeira virada. */
export async function aoVirarUltraPago(consultorioId: string): Promise<void> {
  const { count } = await prisma.consultorio.updateMany({
    where: { id: consultorioId, whatsappStatus: 'SEM_INSTANCIA' },
    data: { whatsappStatus: 'EM_CONFIGURACAO', whatsappConfiguracaoDesde: new Date() },
  })
  if (count === 0) return
  const c = await prisma.consultorio.findUnique({ where: { id: consultorioId }, select: { nome: true } })
  await notificar({
    usuarioIds: await superAdmins(),
    consultorioId: null,
    tipo: 'ASSISTENTE_IA',
    titulo: `Configurar WhatsApp da ${c?.nome ?? 'clínica'} (prazo de 24 h)`,
    link: `/admin?consultorio=${consultorioId}`,
  })
}

/**
 * Saiu do Ultra: nada mais sai. Não apaga id/token (a instância é cancelada à
 * mão), mas volta a SEM_INSTANCIA: assim o cron não tenta credenciais mortas e,
 * se voltar ao Ultra, `aoVirarUltraPago` pede a instância de novo.
 */
export async function aoSairDoUltra(consultorioId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const lotes = await tx.loteIA.findMany({ where: { consultorioId, status: 'APROVADO' }, select: { id: true } })
    const loteIds = lotes.map((l) => l.id)
    await tx.loteIA.updateMany({ where: { consultorioId, id: { in: loteIds } }, data: { status: 'PAUSADO' } })
    // Conversa que nunca enviou nada some, para o contato poder ganhar outra depois (contatoLoteId é único).
    await tx.conversaIA.deleteMany({
      where: {
        consultorioId,
        status: 'AGUARDANDO_ENVIO',
        aberturaEnviadaEm: null,
        mensagens: { none: {} },
        contatoLote: { is: { consultorioId, loteId: { in: loteIds } } },
      },
    })
    await tx.contatoLote.updateMany({
      where: { consultorioId, loteId: { in: loteIds }, status: 'LIBERADO', conversa: { is: null } },
      data: { status: 'AGUARDANDO', liberadoEm: null, enviarEm: null },
    })
    await tx.conversaIA.updateMany({
      where: { consultorioId, status: 'AGUARDANDO_ENVIO' },
      data: { status: 'ENCERRADA' },
    })
  })
  const c = await prisma.consultorio.update({
    where: { id: consultorioId },
    data: { iaPosVendaLigada: false, whatsappStatus: 'SEM_INSTANCIA', whatsappConfiguracaoDesde: null },
    select: { nome: true },
  })
  await notificar({
    usuarioIds: await superAdmins(),
    consultorioId: null,
    tipo: 'ASSISTENTE_IA',
    titulo: `Cancelar a instância do WhatsApp da ${c.nome}`,
    link: `/admin?consultorio=${consultorioId}`,
  })
}

/** URL que o dono cola na instância; null se NEXTAUTH_URL não existe. */
export function urlDoWebhook(segredo: string | null): string | null {
  const base = process.env.NEXTAUTH_URL?.trim().replace(/\/+$/, '')
  return base && segredo ? `${base}/api/webhooks/zapi/${segredo}` : null
}

export async function salvarInstancia(
  consultorioId: string,
  id: string,
  token: string
): Promise<{ urlWebhook: string | null }> {
  id = id.trim()
  token = token.trim()
  if (!id || !token) throw new ErroDeNegocio('Informe o ID e o token da instância')

  const atual = await prisma.consultorio.findUnique({
    where: { id: consultorioId },
    select: { plano: true, whatsappStatus: true, whatsappSegredoWebhook: true },
  })
  if (!atual) throw new ErroDeNegocio('Consultório não encontrado')
  if (atual.plano !== 'ULTRA') throw new ErroDeNegocio('Este consultório não está no plano Ultra.')

  // Mantém o segredo: a URL já colada na instância continua valendo.
  const segredo = atual.whatsappSegredoWebhook ?? randomBytes(32).toString('hex')
  const novoStatus = statusAposSalvar(atual.whatsappStatus)

  await prisma.consultorio.update({
    where: { id: consultorioId },
    data: {
      whatsappInstanciaId: id,
      whatsappInstanciaToken: token,
      whatsappSegredoWebhook: segredo,
      whatsappStatus: novoStatus as any,
    },
  })

  if (novoStatus !== atual.whatsappStatus) {
    await notificar({
      usuarioIds: await equipeDoConsultorio(consultorioId),
      consultorioId,
      tipo: 'ASSISTENTE_IA',
      titulo: 'Seu Assistente IA está pronto. Conecte o WhatsApp da clínica.',
      link: '/ia',
    })
  }
  return { urlWebhook: urlDoWebhook(segredo) }
}
