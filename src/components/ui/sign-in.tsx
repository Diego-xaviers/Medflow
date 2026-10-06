'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import { CHAVE_BOAS_VINDAS } from '@/components/BoasVindas'
import { CHAVE_SESSAO_ATIVA } from '@/components/Moldura'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Depoimento {
  avatarSrc: string
  nome: string
  cargo: string
  texto: string
  stat: { numero: string; label: string }
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function CampoGlass({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutro-200 dark:border-neutro-700 bg-white/60 dark:bg-neutro-950/60 backdrop-blur-sm transition-colors focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10">
      {children}
    </div>
  )
}

function CartaoBento({ dep, delay }: { dep: Depoimento; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-4 flex flex-col gap-3"
    >
      {/* Stat */}
      <div>
        <p
          className="text-white font-bold text-[22px] leading-none"
          style={{ letterSpacing: '-0.04em' }}
        >
          {dep.stat.numero}
        </p>
        <p className="text-white/50 text-[10px] mt-0.5 uppercase tracking-wider">
          {dep.stat.label}
        </p>
      </div>

      {/* Divisor */}
      <div className="border-t border-white/10" />

      {/* Depoimento */}
      <div className="flex items-start gap-2.5">
        <img
          src={dep.avatarSrc}
          className="h-8 w-8 object-cover rounded-xl flex-shrink-0"
          alt={dep.nome}
        />
        <div className="min-w-0">
          <p className="text-white font-semibold text-[12px] truncate">{dep.nome}</p>
          <p className="text-white/50 text-[10px] truncate">{dep.cargo}</p>
        </div>
      </div>
      <p className="text-white/75 text-[11px] leading-relaxed">{dep.texto}</p>
    </motion.div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface SignInMedflowProps {
  depoimentos?: Depoimento[]
}

export function SignInMedflow({ depoimentos = [] }: SignInMedflowProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)

    const resultado = await signIn('credentials', {
      email,
      senha,
      rememberMe: String(rememberMe),
      redirect: false,
    })

    if (resultado?.error) {
      setErro('E-mail ou senha inválidos.')
      setEnviando(false)
      return
    }

    // Sem "lembrar de mim": marca sessão ativa no sessionStorage.
    // Fechar o browser zera o sessionStorage e força novo login.
    if (!rememberMe) {
      try { sessionStorage.setItem(CHAVE_SESSAO_ATIVA, '1') } catch {}
    }

    sessionStorage.setItem(CHAVE_BOAS_VINDAS, '1')
    router.push('/')
    router.refresh()
  }

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row w-full overflow-hidden">

      {/* ── Coluna esquerda: formulário ── */}
      <section className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-neutro-950">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md flex flex-col gap-6"
        >
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20 flex-shrink-0">
              <span
                className="text-brand-950 font-black text-[22px] leading-none"
                style={{ letterSpacing: '-2px', marginRight: '-1px' }}
              >+</span>
            </div>
            <div>
              <p className="text-[16px] font-bold leading-none" style={{ letterSpacing: '-0.025em' }}>Medflow</p>
              <p className="text-[9px] font-semibold tracking-widest text-neutro-400 mt-0.5 uppercase">Gestão Clínica</p>
            </div>
          </div>

          {/* Cabeçalho */}
          <div>
            <h1
              className="text-[30px] font-bold leading-tight text-neutro-900 dark:text-white"
              style={{ letterSpacing: '-0.04em' }}
            >
              Bem-vindo de volta
            </h1>
            <p className="text-neutro-500 dark:text-neutro-400 mt-1 text-[14px]">
              Acesse sua conta para continuar
            </p>
          </div>

          {/* Formulário */}
          <form className="space-y-4" onSubmit={entrar}>
            <div>
              <label className="rotulo block mb-1.5">E-mail</label>
              <CampoGlass>
                <input
                  type="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-transparent text-[14px] px-3.5 py-3 rounded-xl outline-none placeholder:text-neutro-400"
                />
              </CampoGlass>
            </div>

            <div>
              <label className="rotulo block mb-1.5">Senha</label>
              <CampoGlass>
                <div className="relative">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent text-[14px] px-3.5 py-3 pr-11 rounded-xl outline-none placeholder:text-neutro-400"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-neutro-400 hover:text-neutro-600 dark:hover:text-neutro-300 transition-colors"
                    aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
                  >
                    {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </CampoGlass>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-neutro-300 accent-brand-500 cursor-pointer"
              />
              <span className="text-[13px] text-neutro-600 dark:text-neutro-400">Lembrar de mim</span>
            </label>

            {erro && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-[12px] text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2"
              >
                {erro}
              </motion.p>
            )}

            <button type="submit" disabled={enviando} className="btn-primario w-full">
              {enviando ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              {enviando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Rodapé */}
          <div className="space-y-2">
            <p className="text-center text-[11px] text-neutro-400">
              Acesso restrito. As contas são criadas pelo administrador.
            </p>
            <p className="text-center text-[11px] text-neutro-400 space-x-2">
              <Link href="/politica-de-privacidade" className="hover:text-brand-500 transition-colors underline underline-offset-2">
                Política de Privacidade
              </Link>
              <span>·</span>
              <Link href="/termos" className="hover:text-brand-500 transition-colors underline underline-offset-2">
                Termos de Uso
              </Link>
            </p>
          </div>
        </motion.div>
      </section>

      {/* ── Coluna direita: hero + bento grid ── */}
      <section className="hidden md:block flex-1 relative p-4">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-4 rounded-3xl bg-cover bg-center overflow-hidden"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&q=80)',
          }}
        >
          {/* Gradiente */}
          <div className="absolute inset-0 bg-gradient-to-t from-neutro-950/90 via-neutro-950/30 to-transparent" />

          {/* CTA topo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-7 left-7 right-7"
          >
            <div className="inline-flex items-center gap-2 bg-brand-500/90 backdrop-blur-sm rounded-full px-3 py-1.5 mb-4">
              <span className="text-brand-950 font-black text-[12px]" style={{ letterSpacing: '-1px' }}>+</span>
              <span className="text-brand-950 text-[12px] font-semibold">Medflow</span>
            </div>
            <h2
              className="text-white text-[58px] font-bold leading-[1.05]"
              style={{ letterSpacing: '-0.05em' }}
            >
              A plataforma que<br />
              sua clinica merece!
            </h2>
            <p className="text-white/60 text-[17px] mt-4 leading-relaxed">
              Agenda, prontuário e financeiros integrados. Tudo em um só lugar
            </p>
          </motion.div>

          {/* Bento grid: 2×2 com stat + depoimento em cada célula */}
          {depoimentos.length > 0 && (
            <div className="absolute bottom-7 left-7 right-7 grid grid-cols-2 gap-2.5">
              {depoimentos.slice(0, 4).map((dep, i) => (
                <CartaoBento key={dep.nome} dep={dep} delay={0.5 + i * 0.1} />
              ))}
            </div>
          )}
        </motion.div>
      </section>

    </div>
  )
}
