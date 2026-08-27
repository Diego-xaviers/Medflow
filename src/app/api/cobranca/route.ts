import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { situacaoDaConta } from '@/lib/cobranca'
import { gerarBrCode, pixConfigurado } from '@/lib/pix'

/**
 * A aba de Cobrança do consultório.
 *
 * Precisa responder mesmo com a conta bloqueada — é a única tela que resolve
 * o bloqueio, então trancá-la seria trancar a saída. Daí o `permitirEmAtraso`.
 *
 * O que sai daqui é informação de cobrança e um código PIX para copiar. Nada
 * de cartão, nada de meio de pagamento: o sistema não recebe dinheiro, só
 * registra que a fatura foi quitada quando o administrador confirma.
 */
export async function GET() {
  return rota(async () => {
    const { consultorioId } = await exigirSessao({ permitirEmAtraso: true })

    const [faturas, situacao, parametros, consultorio] = await Promise.all([
      prisma.fatura.findMany({
        where: { consultorioId },
        orderBy: { vencimento: 'desc' },
        take: 24,
      }),
      situacaoDaConta(consultorioId),
      prisma.parametrosSaas.findUnique({ where: { id: 'unico' } }),
      prisma.consultorio.findUniqueOrThrow({
        where: { id: consultorioId },
        select: { nome: true },
      }),
    ])

    // O código PIX é montado para a fatura em aberto mais antiga: é essa que
    // precisa ser paga primeiro para destravar a conta.
    const aPagar = faturas
      .filter((f) => f.status === 'ABERTA')
      .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())[0]

    let pix: { copiaECola: string; qrCode: string; valor: number } | null = null

    if (aPagar && parametros && pixConfigurado(parametros)) {
      const copiaECola = gerarBrCode({
        chave: parametros.pixChave!,
        beneficiario: parametros.pixBeneficiario!,
        cidade: parametros.pixCidade!,
        valor: Number(aPagar.valor),
        identificador: `MEDFLOW${aPagar.competencia.replace('-', '')}`,
      })

      pix = {
        copiaECola,
        // O QR vai como data URI: é uma imagem pequena e evita mais uma rota
        // só para servi-la.
        qrCode: await QRCode.toDataURL(copiaECola, { margin: 1, width: 320 }),
        valor: Number(aPagar.valor),
      }
    }

    return {
      consultorio: consultorio.nome,
      situacao,
      pixDisponivel: Boolean(pix),
      pix,
      faturaAtual: aPagar
        ? {
            id: aPagar.id,
            competencia: aPagar.competencia,
            valor: Number(aPagar.valor),
            vencimento: aPagar.vencimento,
            descricao: aPagar.descricao,
          }
        : null,
      faturas: faturas.map((f) => ({
        id: f.id,
        competencia: f.competencia,
        descricao: f.descricao,
        valor: Number(f.valor),
        vencimento: f.vencimento,
        status: f.status,
        pagoEm: f.pagoEm,
      })),
    }
  })
}
