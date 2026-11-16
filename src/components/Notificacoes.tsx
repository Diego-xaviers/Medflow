'use client'

import { useState } from 'react'
import { appUrl } from '@/lib/rotas'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, CalendarPlus, CalendarX2, CheckCircle2, UsersRound,
  LifeBuoy, MessageSquare, CheckCheck, Wallet,
} from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'
import { tempoRelativo } from '@/lib/formato'

/**
 * Campainha do topo.
 *
 * "Tempo real" aqui é uma consulta a cada 15 segundos, e não um socket aberto.
 * É uma escolha, não uma limitação de pressa: em serverless (que é onde este
 * projeto roda) uma conexão persistente por usuário logado custa caro e cai
 * junto com a função. Para avisos de agenda e suporte, 15 segundos é
 * indistinguível de instantâneo para quem está usando o sistema.
 */

const visual: Record<string, { icone: any; cor: string }> = {
  AGENDAMENTO: { icone: CalendarPlus, cor: 'text-brand-600 bg-brand-50 dark:bg-brand-900/30' },
  CANCELAMENTO: { icone: CalendarX2, cor: 'text-red-600 bg-red-50 dark:bg-red-950/40' },
  STATUS: { icone: CheckCircle2, cor: 'text-neutro-600 bg-neutro-100 dark:bg-neutro-800 dark:text-neutro-300' },
  EQUIPE: { icone: UsersRound, cor: 'text-neutro-600 bg-neutro-100 dark:bg-neutro-800 dark:text-neutro-300' },
  SUPORTE: { icone: LifeBuoy, cor: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
  CHAMADO: { icone: MessageSquare, cor: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
  COBRANCA: { icone: Wallet, cor: 'text-brand-600 bg-brand-50 dark:bg-brand-900/30' },
}

export default function Notificacoes() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)

  const { data, mutate } = useSWR('/api/notificacoes', fetcher, {
    refreshInterval: 15_000,
    revalidateOnFocus: true,
  })

  const lista = data?.lista ?? []
  const naoLidas = data?.naoLidas ?? 0

  async function abrirItem(item: any) {
    setAberto(false)
    if (!item.lidaEm) {
      // Atualiza a tela na hora e reconcilia com o servidor depois: esperar a
      // resposta para tirar o negrito deixaria o clique com cara de travado.
      mutate(
        {
          ...data,
          naoLidas: Math.max(0, naoLidas - 1),
          lista: lista.map((n: any) => (n.id === item.id ? { ...n, lidaEm: new Date() } : n)),
        },
        false
      )
      await enviar('/api/notificacoes', 'PATCH', { id: item.id })
      mutate()
    }
    // O link do aviso é gravado no banco como chave de tela (`/agenda?x`), sem
    // o prefixo — assim os avisos antigos continuam valendo depois da mudança.
    if (item.link) router.push(appUrl(item.link))
  }

  async function marcarTodas() {
    mutate({ ...data, naoLidas: 0, lista: lista.map((n: any) => ({ ...n, lidaEm: n.lidaEm ?? new Date() })) }, false)
    await enviar('/api/notificacoes', 'PATCH')
    mutate()
  }

  return (
    <div className="relative">
      <button onClick={() => setAberto((v) => !v)} className="btn-icone relative"
        title={naoLidas > 0 ? `${naoLidas} aviso(s) não lido(s)` : 'Notificações'}>
        <Bell size={17} strokeWidth={1.9} />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-brand-500 text-white text-[10px] font-semibold numerico flex items-center justify-center ring-2 ring-white dark:ring-neutro-900">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      <AnimatePresence>
        {aberto && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 mt-2 w-[340px] cartao shadow-alta z-20 overflow-hidden">

              <div className="flex items-center justify-between px-4 py-3 border-b border-neutro-100 dark:border-neutro-800">
                <div>
                  <p className="text-[13px] font-semibold">Notificações</p>
                  <p className="text-[11px] text-neutro-400">
                    {naoLidas > 0 ? `${naoLidas} não lida${naoLidas === 1 ? '' : 's'}` : 'Tudo em dia'}
                  </p>
                </div>
                {naoLidas > 0 && (
                  <button onClick={marcarTodas}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-neutro-500 hover:text-brand-600 transition-colors">
                    <CheckCheck size={13} strokeWidth={2} /> Marcar todas
                  </button>
                )}
              </div>

              <div className="max-h-[380px] overflow-y-auto">
                {lista.length === 0 ? (
                  <div className="py-12 flex flex-col items-center">
                    <Bell size={20} className="text-neutro-300 dark:text-neutro-700 mb-2" strokeWidth={1.8} />
                    <p className="text-[12px] text-neutro-400">Nenhuma notificação ainda</p>
                  </div>
                ) : (
                  lista.map((n: any) => {
                    const v = visual[n.tipo] ?? visual.STATUS
                    return (
                      <button key={n.id} onClick={() => abrirItem(n)}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-neutro-100 dark:border-neutro-800 last:border-0 transition-colors hover:bg-neutro-50 dark:hover:bg-neutro-800/40 ${
                          n.lidaEm ? '' : 'bg-brand-50/40 dark:bg-brand-900/10'
                        }`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${v.cor}`}>
                          <v.icone size={15} strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[12.5px] leading-snug ${n.lidaEm ? 'font-normal' : 'font-medium'}`}>
                            {n.titulo}
                          </p>
                          {n.descricao && (
                            <p className="text-[11.5px] text-neutro-400 mt-0.5 line-clamp-2">{n.descricao}</p>
                          )}
                          <p className="text-[10.5px] text-neutro-400 mt-1">{tempoRelativo(n.criadoEm)}</p>
                        </div>
                        {!n.lidaEm && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0 mt-1.5" />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
