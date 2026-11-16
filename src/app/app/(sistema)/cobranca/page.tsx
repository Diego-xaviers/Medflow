'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  Wallet, Copy, Check, ShieldCheck, CircleAlert, CircleCheck, Clock,
  QrCode, Receipt, Ban, CreditCard, ExternalLink, RefreshCw, Lock, Loader2, Sparkles,
} from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'
import { moeda, data as fmtData } from '@/lib/formato'

/**
 * Cobrança e pagamentos do consultório.
 *
 * Com assinatura no Asaas, a fatura traz PIX e link de checkout próprios, e a
 * baixa chega sozinha pelo webhook. Sem assinatura, vale o PIX manual do
 * administrador. Em nenhum caso esta tela coleta dado de cartão: ele é
 * digitado na página do Asaas.
 */
function Cobranca() {
  const { data, isLoading, mutate } = useSWR('/api/cobranca', fetcher, { refreshInterval: 60_000 })
  const [copiado, setCopiado] = useState(false)
  const [conferindo, setConferindo] = useState(false)
  // Quem chegou aqui barrado pelo plano traz a tela na URL — o middleware põe.
  const bloqueado = useSearchParams().get('bloqueado')

  /** "Já paguei": consulta o Asaas na hora, sem esperar o webhook. */
  async function conferirPagamento() {
    setConferindo(true)
    try { await mutate(await fetcher('/api/cobranca?atualizar=1'), { revalidate: false }) } finally { setConferindo(false) }
  }

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
          <MeuPlano plano={data?.plano} bloqueado={bloqueado} />

          <Situacao situacao={situacao} />

          <PagamentoOnline online={data?.online} aoMudar={() => conferirPagamento()} />

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
                  ) : atual.linkPagamento ? null : (
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

              {atual.linkPagamento && (
                <div className="flex flex-wrap gap-2 mt-5">
                  <a href={atual.linkPagamento} target="_blank" rel="noreferrer" className="btn-primario">
                    <CreditCard size={15} strokeWidth={2} /> Pagar agora <ExternalLink size={13} strokeWidth={2} />
                  </a>
                  <button onClick={conferirPagamento} disabled={conferindo} className="btn-suave">
                    {conferindo ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} strokeWidth={2} />}
                    Já paguei, atualizar
                  </button>
                </div>
              )}

              {!atual.automatica && <div className="flex items-start gap-2.5 text-[11.5px] text-neutro-500 bg-neutro-50 dark:bg-neutro-950/40 border border-neutro-200/70 dark:border-neutro-800 rounded-lg px-4 py-3 mt-6">
                <ShieldCheck size={15} className="shrink-0 mt-0.5 text-brand-600" strokeWidth={2} />
                <span>
                  <strong className="font-medium">Não pedimos cartão.</strong> O Medflow não
                  guarda nenhum dado de pagamento e não processa cobrança: o PIX
                  sai do seu banco direto para o nosso. Depois de pagar, a baixa
                  é feita manualmente e o acesso volta na hora.
                </span>
              </div>}
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

/**
 * O plano contratado, o que ele inclui e o que viria no de cima.
 *
 * É também a tela onde cai quem tentou abrir algo fora do plano — o
 * middleware redireciona para cá com `?bloqueado=/a-tela`. Mandar para o
 * Dashboard esconderia a causa; aqui a pessoa vê o que tem, o que falta e
 * para quem falar. Não existe botão de upgrade: com a base atual, subir de
 * plano é conversa, e conversa fecha melhor que checkout.
 */
function MeuPlano({ plano, bloqueado }: { plano: any; bloqueado: string | null }) {
  if (!plano) return null

  const proximo = plano.superiores?.[0]

  return (
    <section className="cartao p-5 sm:p-6">
      {bloqueado && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-4 py-3 mb-5">
          <p className="text-[12.5px] text-amber-800 dark:text-amber-300">
            A tela <strong className="font-semibold">{bloqueado}</strong> não faz parte do
            plano {plano.rotulo}. Veja abaixo o que o plano de cima inclui.
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 mb-1">
        <Sparkles size={16} className="text-brand-600 shrink-0 mt-0.5" strokeWidth={2} />
        <div className="flex-1 min-w-0">
          <h2 className="titulo-secao">Plano {plano.rotulo}</h2>
          <p className="text-[12px] text-neutro-400 mt-0.5">
            {plano.tetoUsuarios === null
              ? 'Usuários ilimitados'
              : `${plano.tetoUsuarios} ${plano.tetoUsuarios === 1 ? 'usuário' : 'usuários'}`}
          </p>
        </div>
      </div>

      <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {plano.inclui.map((item: string) => (
          <li key={item} className="flex items-center gap-2 text-[12.5px] text-neutro-600 dark:text-neutro-300">
            <CircleCheck size={13} className="text-brand-600 shrink-0" strokeWidth={2.2} />
            {item}
          </li>
        ))}
      </ul>

      {proximo && (
        <div className="mt-5 pt-5 border-t border-neutro-200/70 dark:border-neutro-800">
          <p className="text-[12.5px] font-semibold">
            No plano {proximo.rotulo} você também tem
          </p>
          <ul className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {proximo.inclui
              .filter((item: string) => !item.startsWith('Tudo do'))
              .map((item: string) => (
                <li key={item} className="flex items-center gap-2 text-[12.5px] text-neutro-500">
                  <CircleCheck size={13} className="text-neutro-300 dark:text-neutro-600 shrink-0" strokeWidth={2.2} />
                  {item}
                </li>
              ))}
          </ul>
          <p className="text-[11px] text-neutro-400 mt-3">
            Para subir de plano, fale com a gente pelo Suporte.
          </p>
        </div>
      )}
    </section>
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
              {f.linkPagamento && (
                <a href={f.linkPagamento} target="_blank" rel="noreferrer"
                  className="text-[12px] font-medium text-brand-600 hover:underline shrink-0">Pagar</a>
              )}
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

/**
 * Cobrança automática pelo Asaas. O dono escolhe PIX ou cartão; o cartão
 * é digitado na página do Asaas, nunca aqui.
 */
function PagamentoOnline({ online, aoMudar }: { online: any; aoMudar: () => void }) {
  const { data: sessao } = useSession()
  const ehDono = sessao?.user?.papel === 'DONO'
  const [editando, setEditando] = useState(false)
  const [forma, setForma] = useState<'PIX' | 'CREDIT_CARD'>(online?.forma ?? 'CREDIT_CARD')
  const [documento, setDocumento] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (!online?.disponivel && !online?.ativo) return null

  async function ativar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null)
    try {
      await enviar('/api/cobranca/assinatura', 'POST', { forma, documento })
      setEditando(false)
      aoMudar()
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  const rotuloForma = online.forma === 'CREDIT_CARD'
    ? 'Cartão de crédito · débito automático todo mês'
    : 'PIX · a cobrança chega todo mês'

  if (online.ativo && !editando) {
    return (
      <section className="cartao p-5 flex items-center gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center shrink-0">
          {online.forma === 'CREDIT_CARD' ? <CreditCard size={20} strokeWidth={2} /> : <QrCode size={20} strokeWidth={2} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold">Pagamento automático ativo</p>
          <p className="text-[12.5px] text-neutro-500 mt-0.5">
            {rotuloForma}{online.valorMensalidade ? ` · ${moeda(online.valorMensalidade)}/mês` : ''}
          </p>
        </div>
        {ehDono && (
          <button onClick={() => { setForma(online.forma === 'PIX' ? 'CREDIT_CARD' : 'PIX'); setEditando(true) }}
            className="btn-suave !text-[12.5px]">
            Trocar para {online.forma === 'PIX' ? 'cartão' : 'PIX'}
          </button>
        )}
      </section>
    )
  }

  if (!ehDono) {
    return (
      <section className="cartao p-5 text-[12.5px] text-neutro-500">
        O pagamento online está disponível. Peça ao dono do consultório para ativar em Cobrança.
      </section>
    )
  }

  return (
    <motion.form onSubmit={ativar}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="cartao p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="titulo-secao flex items-center gap-2">
          <Sparkles size={15} className="text-brand-600" strokeWidth={2} />
          {online.ativo ? 'Trocar forma de pagamento' : 'Ative o pagamento automático'}
        </h2>
        <p className="text-[12.5px] text-neutro-500 mt-1">
          Mensalidade de <strong className="font-semibold text-neutro-800 dark:text-neutro-100">{moeda(online.valorMensalidade)}</strong>.
          A baixa é automática e o acesso não fica preso esperando confirmação.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5">
        {([
          ['CREDIT_CARD', CreditCard, 'Cartão de crédito', 'Cobrado sozinho todo mês. Você não precisa lembrar.'],
          ['PIX', QrCode, 'PIX', 'Todo mês chega a cobrança; paga em segundos pelo app do banco.'],
        ] as const).map(([valor, Icone, titulo, dica]) => (
          <button key={valor} type="button" onClick={() => setForma(valor)}
            className={`text-left p-3.5 rounded-xl border transition-all active:scale-[0.99] ${
              forma === valor
                ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-700 ring-4 ring-brand-500/10'
                : 'border-neutro-200 dark:border-neutro-700 hover:border-neutro-300'
            }`}>
            <span className="flex items-center gap-2 text-[13.5px] font-semibold">
              <Icone size={16} strokeWidth={2} className={forma === valor ? 'text-brand-600' : 'text-neutro-400'} />
              {titulo}
            </span>
            <span className="block text-[11.5px] text-neutro-500 mt-1">{dica}</span>
          </button>
        ))}
      </div>

      <div>
        <label className="rotulo">CPF ou CNPJ de quem paga</label>
        <input className="campo" required inputMode="numeric" placeholder="000.000.000-00"
          value={documento} onChange={(e) => setDocumento(e.target.value)} />
        <p className="text-[11px] text-neutro-400 mt-1.5">
          Exigido para emitir a cobrança e a nota fiscal.
          {online.documentoFinal && ` Cadastrado hoje: final ${online.documentoFinal}.`}
        </p>
      </div>

      {erro && <p className="text-[12px] text-red-600">{erro}</p>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="flex items-center gap-1.5 text-[11.5px] text-neutro-500">
          <Lock size={12} strokeWidth={2} /> Cartão digitado no ambiente seguro do Asaas, nunca no Medflow.
        </p>
        <div className="flex gap-2">
          {online.ativo && (
            <button type="button" onClick={() => setEditando(false)}
              className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">Cancelar</button>
          )}
          <button type="submit" disabled={salvando} className="btn-primario">
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {online.ativo ? 'Salvar' : 'Ativar pagamento'}
          </button>
        </div>
      </div>
    </motion.form>
  )
}

/**
 * `useSearchParams` exige uma fronteira de Suspense: sem ela o Next tenta
 * prerenderizar esta tela durante a build, não encontra query nenhuma e aborta
 * o export com `missing-suspense-with-csr-bailout`.
 *
 * O fallback é vazio de propósito — a própria tela já desenha o esqueleto de
 * carregamento enquanto o SWR não responde, e um segundo esqueleto por cima
 * dele só pisca.
 */
export default function CobrancaPage() {
  return (
    <Suspense>
      <Cobranca />
    </Suspense>
  )
}
