'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const CHAVE = 'mf_cookies_aceitos'

export default function CookieBanner() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(CHAVE)) setVisivel(true)
    } catch {
      // localStorage pode estar bloqueado em alguns contextos; não é crítico.
    }
  }, [])

  function aceitar() {
    try {
      localStorage.setItem(CHAVE, '1')
    } catch {}
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 p-4"
      role="dialog"
      aria-label="Aviso de cookies"
    >
      <div className="max-w-2xl mx-auto bg-neutro-900 dark:bg-neutro-100 text-neutro-50 dark:text-neutro-900 rounded-2xl shadow-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-[13px] leading-relaxed flex-1">
          Usamos cookies essenciais para autenticação e segurança da sessão. Nenhum cookie de
          rastreamento ou publicidade é utilizado.{' '}
          <Link
            href="/politica-de-privacidade"
            className="underline underline-offset-2 hover:opacity-75 transition-opacity"
          >
            Política de Privacidade
          </Link>
          .
        </p>
        <button
          onClick={aceitar}
          className="shrink-0 bg-brand-500 hover:bg-brand-600 text-white text-[13px] font-medium px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-neutro-900"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
