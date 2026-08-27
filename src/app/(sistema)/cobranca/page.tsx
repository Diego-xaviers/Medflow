'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { motion } from 'framer-motion'
import {
  Wallet, Copy, Check, ShieldCheck, CircleAlert, CircleCheck, Clock,
  QrCode, Receipt, Ban,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { moeda, data as fmtData } from '@/lib/formato'

/**
 * Cobrança e pagamentos do consultório.
 *
 * Esta tela mostra a fatura e o meio de pagar. Ela NÃO coleta nada: não há
 * campo de cartão, não há formulário de pagamento e o sistema não conversa
 * com adquirente. O que aparece é uma chave PIX e um QR — a transferência
 * acontece inteira no aplicativo do banco de quem paga, e a baixa é feita
 * manualmente por quem administra o Medflow.
 *
 * É uma decisão consciente enquanto a segurança do fluxo financeiro não for
 * auditada: sem dado de pagamento guardado, não há o que vazar.
 */
export default function CobrancaPage() {
  const { data, isLoading } = useSWR('/api/cobranca', fetcher, { refreshInterval: 60_000 })
  const [copiado, setCopiado] = useState(false)

  const situacao = data?.situacao
  const pix = data?.pix
  const atual = data?.faturaAtual

  function copiar() {
    if (!pix?.copiaECola) return
    navigator.clipboard.writeText(pix.copiaECola)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className="p-4 sm:p-7 max-w-[900px]">
      <div className="mb-6">
        <h1 className="titulo-pagina">Cobrança e pagamentos</h1>
        <p className="subtitulo mt-1">Suas faturas do Medflow</p>
      </div>

      {isLoading ? (
        <div className="space-y-5">
          <div className="esqueleto h-[110px]" />
          <div className="esqueleto h-[280px]" />
        </div>
      ) : (
        <div className="space-y-5">
          <Situacao situacao={situacao} />

          {atual ? (
            <section className="cartao p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-1">
                <Receipt size={16} className="text-neutro-400" strokeWidth={2} />
                <h2 className="titulo-secao">Fatura em aberto</h2>
              </div>
              <p className="text-[12px] text-neutro-400 mb-5">
                Competência {atual.competencia} · vence em {fmtData(atual.vencimento)}
              </p>

              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-1 min-w-0">
                  <p className="rotulo-kpi">Valor</p>
                  <p className="numero-destaque mt-1">{moeda(atual.valor)}</p>
                  {atual.descricao && (
                    <p className="text-[12.5px] text-neutro-500 mt-2">{atual.descricao}</p>
                  )}

                  {pix ? (
                    <>
                      <p className="rotulo mt-5">PIX copia e cola</p>
                      <textarea
                        readOnly value={pix.copiaECola} rows={3}
                        onFocus={(e) => e.currentTarget.select()}
                        className="campo !mt-1 font-mono text-[10.5px] resize-none break-all"
                      />
                      <button onClick={copiar} className="btn-primario w-full mt-2.5">
                        {copiado ? <Check size={15} strokeWidth={2.4} /> : <Copy size={15} />}
                        {copiado ? 'Código copiado' : 'Copiar código PIX'}
                      </button>
                    </>
                  ) : (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-4 py-3 mt-5">
                      <p className="text-[12.5px] text-amber-800 dark:text-amber-300">
                        A chave PIX ainda não foi configurada pelo administrador.
                        Fale pelo Suporte para receber os dados de pagamento.
                      </p>
                    </div>
                  )}
                </div>

                {pix && (
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="rounded-xl bg-white p-3 border border-neutro-200 dark:border-neutro-700">
                      {/* O QR sai do servidor já como imagem; é um data URI, então
                          não passa por next/image. */}
                      <img src={pix.qrCode} alt="QR Code do PIX" width={190} height={190} />
                    </div>
                    <p className="text-[11px] text-neutro-400 mt-2 flex items-center gap-1.5">
                      <QrCode size={11} strokeWidth={2} /> Escaneie pelo app do banco
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2.5 text-[11.5px] text-neutro-500 bg-neutro-50 dark:bg-neutro-950/40 border border-neutro-200/70 dark:border-neutro-800 rounded-lg px-4 py-3 mt-6">
                <ShieldCheck size={15} className="shrink-0 mt-0.5 text-brand-600" strokeWidth={2} />
                <span>
                  <strong className="font-medium">Não pedimos cartão.</strong> O Medflow não
                  guarda nenhum dado de pagamento e não processa cobrança: o PIX
                  sai do seu banco direto para o nosso. Depois de pagar, a baixa
                  é feita manualmente e o acesso volta na hora.
                </span>
              </div>
            </section>
          ) : (
            <div className="cartao py-16 flex flex-col items-center text-center px-6">
              <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center mb-3">
                <CircleCheck size={24} strokeWidth={2} />
              </div>
              <p className="text-[14px] font-medium">Nenhuma fatura em aberto</p>
              <p className="text-[12px] text-neutro-400 mt-1">
                Está tudo em dia. As próximas cobranças aparecem aqui.
              </p>
            </div>
          )}

          <Historico faturas={data?.faturas ?? []} />
        </div>
      )}
    </div>
  )
}

function Situacao({ situacao }: { situacao: any }) {
  if (!situacao) return null

  const estado = situacao.bloqueado
    ? {
        icone: Ban, cor: 'text-red-600 bg-red-50 dark:bg-red-950/40',
        titulo: 'Acesso pausado',
        texto: `Em aberto há ${situacao.diasDeAtraso} dias. As telas voltam assim que o pagamento for confirmado.`,
      }
    : situacao.emAtraso
    ? {
        icone: CircleAlert, cor: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40',
        titulo: 'Fatura vencida',
        texto: `Vencida há ${situacao.diasDeAtraso} dia${situacao.diasDeAtraso === 1 ? '' : 's'}. Você tem ${situacao.diasCarencia} dias de carência antes do bloqueio.`,
      }
    : situacao.quantidadeEmAberto > 0
    ? {
        icone: Clock, cor: 'text-neutro-600 bg-neutro-100 dark:bg-neutro-800 dark:text-neutro-300',
        titulo: 'Fatura a vencer',
        texto: 'Nada vencido. Pague até a data para manter tudo liberado.',
      }
    : {
        icone: CircleCheck, cor: 'text-brand-600 bg-brand-50 dark:bg-brand-900/30',
        titulo: 'Tudo em dia',
        texto: 'Não há pendências na sua conta.',
      }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="cartao p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${estado.cor}`}>
        <estado.icone size={20} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{estado.titulo}</p>
        <p className="text-[12.5px] text-neutro-500 mt-0.5 leading-relaxed">{estado.texto}</p>
      </div>
      {situacao.valorEmAberto > 0 && (
        <div className="text-right shrink-0">
          <p className="text-[10.5px] text-neutro-400 uppercase tracking-wide">Em aberto</p>
          <p className="text-[17px] font-semibold numerico mt-0.5">
            {moeda(situacao.valorEmAberto)}
          </p>
        </div>
      )}
    </motion.section>
  )
}

const rotuloStatus: Record<string, { texto: string; classe: string }> = {
  ABERTA: { texto: 'Em aberto', classe: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
  PAGA: { texto: 'Paga', classe: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' },
  CANCELADA: { texto: 'Cancelada', classe: 'bg-neutro-100 text-neutro-500 dark:bg-neutro-800' },
}

function Historico({ faturas }: { faturas: any[] }) {
  if (faturas.length === 0) return null

  return (
    <section className="cartao overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-neutro-100 dark:border-neutro-800">
        <Wallet size={16} className="text-neutro-400" strokeWidth={2} />
        <h2 className="titulo-secao">Histórico</h2>
      </div>

      <div className="divide-y divide-neutro-100 dark:divide-neutro-800">
        {faturas.map((f) => {
          const estilo = rotuloStatus[f.status] ?? rotuloStatus.ABERTA
          return (
            <div key={f.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium">{f.competencia}</p>
                <p className="text-[11.5px] text-neutro-400 truncate">
                  {f.descricao || 'Mensalidade'} · vence {fmtData(f.vencimento)}
                  {f.pagoEm && ` · pago em ${fmtData(f.pagoEm)}`}
                </p>
              </div>
              <span className={`etiqueta shrink-0 ${estilo.classe}`}>{estilo.texto}</span>
              <p className="text-[13px] font-semibold numerico shrink-0 w-24 text-right">
                {moeda(f.valor)}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
