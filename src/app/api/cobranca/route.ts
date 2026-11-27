import { NextRequest } from 'next/server'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { exigirSessao } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { situacaoDaConta } from '@/lib/cobranca'
import { gerarBrCode, pixConfigurado } from '@/lib/pix'
import { asaasConfigurado, pixDoPagamento, sincronizarPagamentos } from '@/lib/asaas'
import { INCLUI, PLANOS_A_VENDA, PRECO_TABELA, ROTULO, TETO_USUARIOS, type PlanoNome } from '@/lib/planos'

/**
 * A aba de Cobrança do consultório.
 *
 * Precisa responder mesmo com a conta bloqueada — é a única tela que resolve
 * o bloqueio, então trancá-la seria trancar a saída. Daí o `permitirEmAtraso`.
 *
 * Duas formas de pagar convivem: a assinatura no Asaas (checkout e baixa
 * automáticos) e o PIX manual do administrador, para faturas lançadas à mão.
 * Dado de cartão nunca passa por aqui.
 *
 * `?atualizar=1` puxa os pagamentos direto do Asaas — o botão "Já paguei"
 * da tela, para o caso de o webhook ainda não ter chegado.
 */
export async function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirSessao({ permitirEmAtraso: true })
    if (req.nextUrl.searchParams.get('atualizar')) await sincronizarPagamentos(consultorioId)

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
        select: {
          nome: true, plano: true, valorMensalidade: true, formaCobranca: true,
          asaasAssinaturaId: true, documentoCobranca: true,
        },
      }),
    ])

    // O código PIX é montado para a fatura em aberto mais antiga: é essa que
    // precisa ser paga primeiro para destravar a conta.
    const aPagar = faturas
      .filter((f) => f.status === 'ABERTA')
      .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())[0]

    let pix: { copiaECola: string; qrCode: string; valor: number } | null = null

    if (aPagar?.asaasPagamentoId) {
      // Cobrança do Asaas: o PIX é o dele, com baixa automática.
      if (aPagar.formaPagamento === 'PIX') {
        try {
          pix = { ...(await pixDoPagamento(aPagar.asaasPagamentoId)), valor: Number(aPagar.valor) }
        } catch { /* sem QR, a tela oferece o link da fatura */ }
      }
    } else if (aPagar && parametros && pixConfigurado(parametros)) {
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

    const doc = consultorio.documentoCobranca?.replace(/D/g, '') ?? ''
    const plano = consultorio.plano as PlanoNome
    return {
      consultorio: consultorio.nome,
      // O plano e o que ele inclui. `precoTabela` é só vitrine: o que o
      // cliente paga é `online.valorMensalidade`, e os dois podem divergir
      // de propósito (preço negociado, desconto de rede, cliente fundador).
      plano: {
        nome: plano,
        rotulo: ROTULO[plano],
        inclui: INCLUI[plano],
        precoTabela: PRECO_TABELA[plano],
        tetoUsuarios: TETO_USUARIOS[plano],
        superiores: PLANOS_A_VENDA
          .filter((outro) => PRECO_TABELA[outro] > PRECO_TABELA[plano])
          .map((outro) => ({
            nome: outro,
            rotulo: ROTULO[outro],
            precoTabela: PRECO_TABELA[outro],
            inclui: INCLUI[outro],
          })),
      },
      // Pagamento online disponível quando o Asaas está configurado e o
      // administrador já definiu o valor deste consultório.
      online: {
        disponivel: asaasConfigurado() && Boolean(consultorio.valorMensalidade),
        ativo: Boolean(consultorio.asaasAssinaturaId),
        forma: consultorio.formaCobranca,
        valorMensalidade: consultorio.valorMensalidade ? Number(consultorio.valorMensalidade) : null,
        // Só o final, para conferência — o documento inteiro não volta para a tela.
        documentoFinal: doc ? doc.slice(-4) : null,
      },
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
            linkPagamento: aPagar.linkPagamento,
            automatica: Boolean(aPagar.asaasPagamentoId),
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
        linkPagamento: f.status === 'ABERTA' ? f.linkPagamento : null,
      })),
    }
  })
}
