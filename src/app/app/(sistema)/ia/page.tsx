'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useSWR from 'swr'
import { Sparkles, Play, Loader2 } from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'
import type { Painel } from '@/lib/lotesServidor'
import AtividadeContatos from '@/components/ia/AtividadeContatos'
import PainelIA from '@/components/ia/PainelIA'
import PreviaUltra from '@/components/ia/PreviaUltra'
import Agentes from '@/components/ia/Agentes'
import AbasAssistente, { type AbaAssistente } from '@/components/ia/AbasAssistente'
import BaseConhecimento from '@/components/ia/BaseConhecimento'
import CarregandoIA from '@/components/ia/CarregandoIA'
import ResumoIA from '@/components/ia/ResumoIA'

type RespostaPainel = { liberado: false } | Painel

/**
 * Assistente IA: análise do consultório, lotes de pacientes para reativar,
 * aprovação e os contatos do dia. Abre para todos os planos; quem não é
 * Ultra vê a prévia com o convite.
 */
export default function PaginaAssistenteIA() {
  const { data, error, isLoading, mutate } = useSWR<RespostaPainel>('/api/ia/painel', fetcher, {
    revalidateOnFocus: false,
  })
  const [aba, setAba] = useState<AbaAssistente>('geral')
  const [trabalhando, setTrabalhando] = useState(false)
  const [resultado, setResultado] = useState<Painel | null>(null)
  const [erroIA, setErroIA] = useState<string | null>(null)
  const [comecou, setComecou] = useState(false)
  const [escrevendo, setEscrevendo] = useState<number | null>(null)
  const escrevendoRef = useRef(false)

  async function comecar() {
    setTrabalhando(true)
    setResultado(null)
    setErroIA(null)
    try {
      const novo: Painel & { erroAnalise?: string | null } = await enviar('/api/ia/analise', 'POST')
      setResultado(novo)
    } catch (e) {
      setErroIA(e instanceof Error ? e.message : 'Não consegui falar com a IA agora.')
    }
  }

  const terminar = useCallback(() => {
    if (resultado) mutate(resultado, { revalidate: false })
    // Mesmo se a IA falhou, os lotes já existem: sai da tela de boas-vindas.
    if (resultado) setComecou(true)
    setTrabalhando(false)
  }, [resultado, mutate])

  // Mensagens do dia: uma chamada à IA por vez, até acabar ou parar de avançar.
  const semMensagem = data && data.liberado
    ? data.andamento.filter((l) => l.status === 'APROVADO').flatMap((l) => l.hoje).filter((c) => c.status === 'LIBERADO' && !c.mensagem).length
    : 0
  useEffect(() => {
    if (!semMensagem || escrevendoRef.current || trabalhando) return
    escrevendoRef.current = true
    ;(async () => {
      try {
        for (let i = 0; i < 10; i++) {
          const r = await enviar('/api/ia/mensagens', 'POST')
          mutate(r, { revalidate: false })
          setEscrevendo(r.pendentes)
          if (!r.pendentes || !r.escritas) break
        }
      } catch {
        // Sem IA agora: cada contato tem o botão "Gerar mensagem".
      } finally {
        setEscrevendo(null)
      }
    })()
  }, [semMensagem, trabalhando, mutate])

  const liberado = data && data.liberado
  const primeiraVez = liberado && !comecou && !data.analise && data.andamento.length === 0

  // Sem Ultra só existem as abas de prévia (agentes e base).
  const abaVista: AbaAssistente = data && !data.liberado && (aba === 'geral' || aba === 'atividade') ? 'agentes' : aba
  const zap = liberado ? data.whatsapp : null
  const conectado = zap?.status === 'CONECTADO'

  return (
    <div className="p-4 sm:p-7 max-w-[1300px]">
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div className="min-w-0">
          <h1 className="titulo-pagina flex items-center gap-2.5">
            <Sparkles size={22} className="text-brand-500" strokeWidth={2.2} /> Assistente IA
          </h1>
          <p className="subtitulo mt-1">Sua secretária no WhatsApp: reativa pacientes e acompanha o pós-venda.</p>
        </div>
        {zap && (
          <button onClick={() => setAba('agentes')}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${conectado
              ? 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-200'
              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'}`}>
            <span className="relative flex h-2 w-2">
              {conectado && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${conectado ? 'bg-brand-500' : 'bg-amber-500'}`} />
            </span>
            {conectado ? `WhatsApp conectado${zap.numero ? ` · ${zap.numero}` : ''}` : 'WhatsApp desconectado · conectar'}
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="esqueleto h-[112px]" />)}</div>
          <div className="esqueleto h-[260px]" />
        </div>
      )}

      {error && (
        <div className="text-[13px] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 px-4 py-3 rounded-lg">
          {error.message}
        </div>
      )}

      {liberado && !primeiraVez && <ResumoIA painel={data} />}

      {data && <AbasAssistente aba={abaVista} aoMudar={setAba} ocultar={data.liberado ? [] : ['geral', 'atividade']} />}

      <AnimatePresence mode="wait">
        <motion.div key={abaVista} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}>
          {data && !data.liberado && <PreviaUltra aba={abaVista} />}

          {liberado && aba === 'geral' && (primeiraVez ? (
            <div className="cartao relative overflow-hidden px-6 py-14 sm:py-20 text-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,220,130,0.14),transparent_60%)] pointer-events-none" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-brand-500 text-brand-950 flex items-center justify-center mx-auto mb-5">
                  <Sparkles size={26} strokeWidth={2.2} />
                </div>
                <h2 className="text-[22px] font-semibold tracking-apertado">Vamos colocar a IA para trabalhar</h2>
                <p className="text-[13.5px] text-neutro-500 mt-2 max-w-md mx-auto">
                  Ela lê os números do consultório, separa os pacientes que precisam voltar e explica por onde começar.
                  Nada é enviado sem a sua aprovação.
                </p>
                <button onClick={comecar} className="btn-marca mt-6 px-6 py-3 text-[15px]">
                  <Play size={16} /> Começar
                </button>
              </div>
            </div>
          ) : (
            <>
              {escrevendo !== null && (
                <div className="mb-4 flex items-center gap-2 text-[13px] text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-900 px-4 py-2.5 rounded-lg">
                  <Loader2 size={14} className="animate-spin" /> A IA está escrevendo as mensagens de hoje
                  {escrevendo > 0 && <span className="text-neutro-500">· faltam {escrevendo}</span>}
                </div>
              )}
              <PainelIA painel={data} aoMudar={(p) => mutate(p, { revalidate: false })} aoAtualizarAnalise={comecar} />
            </>
          ))}

          {liberado && aba === 'agentes' && (
            <Agentes painel={data} aoMudar={(p) => mutate(p, { revalidate: false })} aoConectar={() => mutate()} />
          )}

          {liberado && aba === 'atividade' && <AtividadeContatos />}

          {liberado && aba === 'base' && <BaseConhecimento />}
        </motion.div>
      </AnimatePresence>

      {trabalhando && <CarregandoIA resultado={resultado} erro={erroIA} aoTerminar={terminar} />}
    </div>
  )
}
