'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import useSWR from 'swr'
import { motion } from 'framer-motion'
import {
  Check, CreditCard, QrCode, Lock, Loader2, Copy, ExternalLink, CircleCheck, ShieldCheck, LogOut,
} from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'
import { moeda } from '@/lib/formato'
import { appUrl } from '@/lib/rotas'
import { CHAVE_BOAS_VINDAS } from '@/components/BoasVindas'

/**
 * Checkout da primeira mensalidade.
 *
 * Fica FORA do sistema de propósito: quem acabou de se cadastrar ainda não
 * pagou, e abrir o painel com menu, números e um aviso de "ative sua
 * assinatura" lá dentro dava a impressão de que a conta já estava pronta.
 * Aqui só existe uma coisa a fazer — pagar — e o sistema só abre depois que
 * o Asaas confirma o pagamento.
 *
 * A página confere sozinha (`?atualizar=1` consulta o Asaas) enquanto a
 * pessoa paga, para não depender só do webhook nem de um botão "já paguei".
 */
export default function Assinar() {
  const router = useRouter()
  const { data: sessao, status } = useSession()

  const [forma, setForma] = useState<'PIX' | 'CREDIT_CARD'>('CREDIT_CARD')
  const [documento, setDocumento] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login?callbackUrl=%2Fassinar')
  }, [status, router])

  const { data, mutate } = useSWR(status === 'authenticated' ? '/api/cobranca' : null, fetcher)
  const online = data?.online
  const situacao = data?.situacao
  const fatura = data?.faturaAtual
  const pix = data?.pix
  const aguardandoPagamento = Boolean(online?.ativo && situacao?.bloqueado)
  const liberado = data && !situacao?.bloqueado

  // Enquanto a cobrança existe e não foi paga, confere no Asaas a cada 6 s.
  useEffect(() => {
    if (!aguardandoPagamento) return
    const t = setInterval(async () => {
      try { await mutate(await fetcher('/api/cobranca?atualizar=1'), { revalidate: false }) } catch { /* tenta de novo */ }
    }, 6000)
    return () => clearInterval(t)
  }, [aguardandoPagamento, mutate])

  // Pago: mostra a confirmação por um instante e entra no sistema.
  useEffect(() => {
    if (!liberado) return
    try { sessionStorage.setItem(CHAVE_BOAS_VINDAS, '1') } catch { /* não é crítico */ }
    const t = setTimeout(() => router.replace(appUrl('/')), 2200)
    return () => clearTimeout(t)
  }, [liberado, router])

  async function gerarCobranca(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true); setErro(null)
    try {
      await enviar('/api/cobranca/assinatura', 'POST', { forma, documento })
      await mutate()
    } catch (e: any) {
      setErro(e.message ?? 'Não consegui gerar a cobrança. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  function copiar() {
    if (!pix?.copiaECola) return
    navigator.clipboard?.writeText(pix.copiaECola)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  const valor = online?.valorMensalidade ?? data?.plano?.precoTabela
  const ehDono = sessao?.user?.papel === 'DONO'

  return (
    <div className="min-h-[100dvh] bg-neutro-50 dark:bg-neutro-950">
      <header className="bg-white dark:bg-neutro-900 border-b border-neutro-200 dark:border-neutro-800">
        <div className="max-w-xl mx-auto px-4 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <span className="text-brand-950 font-black text-[17px] leading-none" style={{ letterSpacing: '-1.5px', marginRight: '-1px' }}>+</span>
            </div>
            <span className="text-[15px] font-bold tracking-apertado">Medflow</span>
          </div>
          <span className="flex items-center gap-1.5 text-[12px] text-neutro-500">
            <Lock size={13} /> Pagamento seguro
          </span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 sm:py-10">
        {/* Etapas: deixa claro que a conta existe e só falta este passo. */}
        <ol className="flex items-center gap-2 text-[12px] font-medium mb-6">
          <Etapa feita rotulo="Conta criada" />
          <span className="flex-1 h-px bg-neutro-200 dark:bg-neutro-800" />
          <Etapa atual={!liberado} feita={!!liberado} rotulo="Pagamento" numero={2} />
          <span className="flex-1 h-px bg-neutro-200 dark:bg-neutro-800" />
          <Etapa feita={!!liberado} rotulo="Acesso" numero={3} />
        </ol>

        {!data ? (
          <div className="cartao p-10 flex justify-center"><Loader2 className="animate-spin text-neutro-400" /></div>
        ) : liberado ? (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="cartao p-8 sm:p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-50 dark:bg-brand-950/40 text-brand-600 flex items-center justify-center mx-auto">
              <CircleCheck size={34} />
            </div>
            <h1 className="text-[22px] font-semibold mt-4">Pagamento confirmado!</h1>
            <p className="text-[14px] text-neutro-500 mt-1">Abrindo o seu sistema…</p>
            <button onClick={() => router.replace(appUrl('/'))} className="btn-marca w-full mt-6">Entrar no Medflow</button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <section className="cartao p-5 sm:p-6">
              <p className="text-[12px] text-neutro-400 uppercase tracking-wide">Sua assinatura</p>
              <div className="flex items-end justify-between gap-3 mt-1">
                <div>
                  <h1 className="text-[20px] font-semibold">Plano {data.plano?.rotulo}</h1>
                  <p className="text-[13px] text-neutro-500">{data.consultorio}</p>
                </div>
                {valor != null && (
                  <p className="text-right">
                    <span className="text-[24px] font-bold numerico">{moeda(valor)}</span>
                    <span className="text-[12px] text-neutro-400">/mês</span>
                  </p>
                )}
              </div>
              <ul className="mt-4 grid sm:grid-cols-2 gap-1.5">
                {(data.plano?.inclui ?? []).slice(0, 6).map((item: string) => (
                  <li key={item} className="flex items-center gap-2 text-[12.5px] text-neutro-600 dark:text-neutro-300">
                    <Check size={13} className="text-brand-600 shrink-0" strokeWidth={2.6} /> {item}
                  </li>
                ))}
              </ul>
            </section>

            {!ehDono ? (
              <section className="cartao p-5 text-[13px] text-neutro-500">
                A assinatura deste consultório ainda não foi paga. Peça ao dono da conta para concluir o pagamento.
              </section>
            ) : !online?.ativo ? (
              <form onSubmit={gerarCobranca} className="cartao p-5 sm:p-6 space-y-4">
                <h2 className="text-[16px] font-semibold">Como você quer pagar?</h2>
                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    ['CREDIT_CARD', CreditCard, 'Cartão', 'Débito automático todo mês'],
                    ['PIX', QrCode, 'PIX', 'Paga pelo app do banco'],
                  ] as const).map(([v, Icone, titulo, dica]) => (
                    <button key={v} type="button" onClick={() => setForma(v)}
                      className={`text-left p-3.5 rounded-xl border transition-all ${
                        forma === v
                          ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20 ring-4 ring-brand-500/10'
                          : 'border-neutro-200 dark:border-neutro-700 hover:border-neutro-300'
                      }`}>
                      <span className="flex items-center gap-2 text-[14px] font-semibold">
                        <Icone size={17} className={forma === v ? 'text-brand-600' : 'text-neutro-400'} /> {titulo}
                      </span>
                      <span className="block text-[11.5px] text-neutro-500 mt-1">{dica}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="rotulo">CPF ou CNPJ de quem paga</label>
                  <input className="campo" required inputMode="numeric" placeholder="000.000.000-00"
                    value={documento} onChange={(e) => setDocumento(e.target.value)} />
                  <p className="text-[11px] text-neutro-400 mt-1.5">Necessário para emitir a cobrança e a nota fiscal.</p>
                </div>
                {erro && <p className="text-[12.5px] text-red-600">{erro}</p>}
                <button type="submit" disabled={enviando} className="btn-marca w-full !py-3 !text-[15px]">
                  {enviando ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
                  {forma === 'PIX' ? 'Gerar PIX' : 'Ir para o pagamento'}
                </button>
                <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-neutro-400">
                  <ShieldCheck size={13} /> Cartão digitado no ambiente seguro do Asaas, nunca no Medflow.
                </p>
              </form>
            ) : (
              <section className="cartao p-5 sm:p-6">
                <h2 className="text-[16px] font-semibold">
                  {pix ? 'Pague com PIX' : 'Finalize o pagamento'}
                </h2>
                <p className="text-[12.5px] text-neutro-500 mt-1">
                  Assim que o pagamento for confirmado, o sistema abre sozinho nesta tela.
                </p>

                {pix ? (
                  <div className="mt-5 flex flex-col items-center">
                    <div className="rounded-xl bg-white p-3 border border-neutro-200">
                      <img src={pix.qrCode} alt="QR Code do PIX" width={210} height={210} />
                    </div>
                    <p className="text-[12px] text-neutro-400 mt-2">Escaneie pelo app do banco ou copie o código</p>
                    <button onClick={copiar} className="btn-primario w-full mt-4">
                      {copiado ? <Check size={15} /> : <Copy size={15} />}
                      {copiado ? 'Código copiado' : 'Copiar código PIX'}
                    </button>
                  </div>
                ) : fatura?.linkPagamento ? (
                  <a href={fatura.linkPagamento} target="_blank" rel="noreferrer" className="btn-marca w-full mt-5 !py-3 !text-[15px]">
                    <CreditCard size={16} /> Pagar {fatura.valor ? moeda(fatura.valor) : ''} com cartão <ExternalLink size={14} />
                  </a>
                ) : (
                  <p className="mt-5 text-[13px] text-neutro-500 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Gerando a cobrança…
                  </p>
                )}

                <div className="mt-5 flex items-center justify-center gap-2 text-[12.5px] text-neutro-500 bg-neutro-50 dark:bg-neutro-950/40 rounded-lg py-3">
                  <Loader2 size={14} className="animate-spin text-brand-600" /> Aguardando confirmação do pagamento
                </div>
              </section>
            )}

            <button onClick={() => signOut({ callbackUrl: '/login' })}
              className="mx-auto flex items-center gap-1.5 text-[12.5px] text-neutro-400 hover:text-neutro-600 pt-2">
              <LogOut size={13} /> Sair e pagar depois
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function Etapa({ rotulo, feita, atual, numero }: { rotulo: string; feita?: boolean; atual?: boolean; numero?: number }) {
  return (
    <li className={`flex items-center gap-1.5 shrink-0 ${feita || atual ? 'text-neutro-800 dark:text-neutro-100' : 'text-neutro-400'}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
        feita ? 'bg-brand-500 text-brand-950' : atual ? 'bg-neutro-900 text-white dark:bg-white dark:text-neutro-900' : 'bg-neutro-200 dark:bg-neutro-800'
      }`}>
        {feita ? <Check size={13} strokeWidth={3} /> : numero}
      </span>
      {rotulo}
    </li>
  )
}
