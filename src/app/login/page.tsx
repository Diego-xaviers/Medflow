'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { CHAVE_BOAS_VINDAS } from '@/components/BoasVindas'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, Loader2, LogIn } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)

    const resultado = await signIn('credentials', { email, senha, redirect: false })

    if (resultado?.error) {
      setErro('E-mail ou senha inválidos.')
      setEnviando(false)
      return
    }
    // Marca a entrada para a tela de boas-vindas aparecer uma vez só. Fica na
    // sessão do navegador: recarregar a página depois não repete a animação.
    sessionStorage.setItem(CHAVE_BOAS_VINDAS, '1')

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-brand-400/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center text-white mb-3 shadow-lg shadow-brand-500/25">
            <Eye size={24} />
          </div>
          <h1 className="text-[20px] font-semibold tracking-apertado">Medflow</h1>
          <p className="text-[10px] font-medium tracking-wider text-neutro-400 mt-1">GESTÃO CLÍNICA</p>
        </div>

        <form onSubmit={entrar} className="cartao shadow-media p-6 space-y-4">
          <div>
            <label className="rotulo">E-mail</label>
            <input type="email" autoFocus required className="campo"
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
          </div>

          <div>
            <label className="rotulo">Senha</label>
            <input type="password" required className="campo"
              value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
          </div>

          {erro && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="text-[12px] text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2"
            >
              {erro}
            </motion.p>
          )}

          <button type="submit" disabled={enviando}
            className="btn-primario w-full">
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[11px] text-neutro-400 mt-6">
          Acesso restrito. As contas são criadas pelo administrador.
        </p>
        <p className="text-center text-[11px] text-neutro-400 mt-3 space-x-2">
          <Link href="/politica-de-privacidade" className="hover:text-brand-500 transition-colors underline underline-offset-2">
            Política de Privacidade
          </Link>
          <span>·</span>
          <Link href="/termos" className="hover:text-brand-500 transition-colors underline underline-offset-2">
            Termos de Uso
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
