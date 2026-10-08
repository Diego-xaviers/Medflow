'use client'

import { signOut, useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { Moon, Sun, LogOut, ChevronDown, UserRound, Pencil, Menu } from 'lucide-react'
import { useTema } from './TemaProvider'
import Avatar from './Avatar'
import Notificacoes from './Notificacoes'
import BuscaGlobal from './BuscaGlobal'
import SeletorConsultorio from './SeletorConsultorio'
import { fetcher } from '@/lib/fetcher'

const rotuloPapel: Record<string, string> = {
  SUPER_ADMIN: 'Administrador', DONO: 'Optometrista',
  ATENDENTE: 'Atendente', VENDEDORA: 'Vendedora',
}

export default function Topbar({ aoAbrirMenu }: { aoAbrirMenu?: () => void } = {}) {
  const { data: sessao } = useSession()
  const { tema, alternarTema } = useTema()
  const [menuAberto, setMenuAberto] = useState(false)

  // A foto não cabe no token de sessão (o cookie estouraria), então vem numa
  // chamada à parte — que o SWR mantém em cache entre as telas.
  const { data: perfil } = useSWR('/api/perfil', fetcher)

  return (
    <header className="topbar h-[60px] sm:h-[65px] flex items-center justify-between px-3 sm:px-6 border-b border-neutro-200/70 dark:border-neutro-800 bg-white/80 dark:bg-neutro-900/60 backdrop-blur-xl sticky top-0 z-30">
      {/* No celular: botão da gaveta e a marca. A busca só entra a partir do
          tablet — num telefone ela tomaria a largura toda do cabeçalho. */}
      <div className="flex items-center gap-2 md:hidden">
        <button onClick={aoAbrirMenu} aria-label="Abrir menu" className="btn-icone shrink-0">
          <Menu size={20} strokeWidth={2} />
        </button>
        <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center shrink-0">
          <span className="text-brand-950 font-black text-[14px] leading-none" style={{ letterSpacing: '-1.5px', marginRight: '-1px' }}>+</span>
        </div>
        <p className="text-[14px] font-semibold tracking-apertado">Medflow</p>
      </div>

      <BuscaGlobal />

      <div className="flex items-center gap-0.5 sm:gap-1.5 md:ml-6">
        <SeletorConsultorio />

        {/* Tema */}
        <button onClick={alternarTema} className="btn-icone overflow-hidden"
          title={tema === 'claro' ? 'Modo escuro' : 'Modo claro'}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={tema}
              initial={{ y: -16, opacity: 0, rotate: -60 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: 16, opacity: 0, rotate: 60 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="absolute">
              {tema === 'claro' ? <Moon size={17} strokeWidth={1.9} /> : <Sun size={17} strokeWidth={1.9} />}
            </motion.span>
          </AnimatePresence>
        </button>

        <Notificacoes />

        {/* Usuário */}
        <div className="relative ml-2 pl-3 border-l border-neutro-200 dark:border-neutro-800">
          <button onClick={() => setMenuAberto((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-neutro-100 dark:hover:bg-neutro-800">
            <Avatar nome={sessao?.user?.name} fotoUrl={perfil?.fotoUrl} tamanho={32} />
            <div className="text-left leading-tight hidden sm:block">
              <p className="text-[13px] font-medium">{sessao?.user?.name}</p>
              <p className="text-[11px] text-neutro-400">
                {rotuloPapel[sessao?.user?.papel ?? ''] ?? ''}
              </p>
            </div>
            <ChevronDown size={14} className={`text-neutro-400 transition-transform duration-200 ${menuAberto ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {menuAberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 mt-2 w-56 cartao shadow-alta p-1.5 z-20">
                  <div className="flex items-center gap-3 px-3 py-3 border-b border-neutro-100 dark:border-neutro-800 mb-1">
                    <Avatar nome={sessao?.user?.name} fotoUrl={perfil?.fotoUrl} tamanho={38} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate">{sessao?.user?.name}</p>
                      <p className="text-[11px] text-neutro-400 truncate">{sessao?.user?.email}</p>
                    </div>
                  </div>

                  <Link href="/perfil" onClick={() => setMenuAberto(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium hover:bg-neutro-100 dark:hover:bg-neutro-800 transition-colors">
                    <UserRound size={15} strokeWidth={1.9} className="text-neutro-400" /> Meu perfil
                  </Link>
                  <Link href="/perfil?editar=1" onClick={() => setMenuAberto(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium hover:bg-neutro-100 dark:hover:bg-neutro-800 transition-colors">
                    <Pencil size={15} strokeWidth={1.9} className="text-neutro-400" /> Editar perfil
                  </Link>

                  <div className="my-1 border-t border-neutro-100 dark:border-neutro-800" />

                  <button onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                    <LogOut size={15} strokeWidth={1.9} /> Sair da conta
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
