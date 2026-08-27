'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye } from 'lucide-react'

/** A chave que o login deixa marcada para esta tela consumir uma vez só. */
export const CHAVE_BOAS_VINDAS = 'medflow:boas-vindas'

const DURACAO_MS = 2400

/**
 * A abertura do sistema, logo depois do login.
 *
 * Aparece uma vez por entrada, não a cada tela: quem já está trabalhando não
 * quer ver a marca de novo ao trocar de aba. O login deixa uma marca na sessão
 * do navegador e esta tela a consome — por isso recarregar a página não
 * dispara a animação de novo.
 *
 * A saída é por tempo, com um piso curto: mesmo numa conexão rápida ela fica
 * o suficiente para ser lida, e nunca prende ninguém esperando.
 */
export default function BoasVindas() {
  const { data: sessao } = useSession()
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(CHAVE_BOAS_VINDAS) !== '1') return

    // Consome já: se a pessoa navegar no meio da animação, não volta.
    sessionStorage.removeItem(CHAVE_BOAS_VINDAS)
    setVisivel(true)

    const t = setTimeout(() => setVisivel(false), DURACAO_MS)
    return () => clearTimeout(t)
  }, [])

  const primeiroNome = (sessao?.user?.name ?? '').trim().split(' ')[0]

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          key="boas-vindas"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] } }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white dark:bg-neutro-950"
        >
          {/* O símbolo entra com uma mola curta e um halo que se abre atrás —
              é o que dá a sensação de "ligando" em vez de "carregando". */}
          <div className="relative flex items-center justify-center">
            <motion.span
              initial={{ scale: 0.6, opacity: 0.5 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 1.4, ease: 'easeOut', delay: 0.15 }}
              className="absolute w-20 h-20 rounded-3xl bg-brand-500/30"
            />
            <motion.div
              initial={{ scale: 0.4, opacity: 0, rotate: -12 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16 }}
              className="w-20 h-20 rounded-3xl bg-brand-600 flex items-center justify-center text-white shadow-media"
            >
              <Eye size={38} strokeWidth={2.1} />
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 10, letterSpacing: '0.3em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '-0.02em' }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="text-[26px] font-semibold mt-6"
          >
            Medflow
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.65 }}
            className="text-[14px] text-neutro-500 mt-1.5"
          >
            {primeiroNome ? `Seja bem-vindo, ${primeiroNome}` : 'Seja bem-vindo ao Medflow'}
          </motion.p>

          {/* Fio de progresso: dá noção de que há um fim, sem número nenhum. */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 128 }}
            transition={{ duration: DURACAO_MS / 1000 - 0.4, ease: 'easeInOut' }}
            className="h-[2px] rounded-full bg-brand-500/70 mt-9"
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
