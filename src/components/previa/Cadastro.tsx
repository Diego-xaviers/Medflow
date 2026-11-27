'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import { enviar } from '@/lib/fetcher'
import {
  INCLUI,
  PLANOS_A_VENDA,
  PRECO_TABELA,
  ROTULO,
  TETO_USUARIOS,
  type PlanoNome,
} from '@/lib/planos'

/**
 * O cadastro que a própria pessoa faz, vindo do card de plano da vitrine.
 *
 * Entra logada: criar a conta e depois mostrar uma tela de login seria pedir
 * a mesma senha duas vezes seguidas, e é o momento de maior desistência de
 * todo o fluxo. Por isso o `signIn` roda aqui mesmo, com a senha que ela
 * acabou de digitar.
 *
 * E cai em Cobrança, não no Dashboard: ela clicou em "Assinar", então o que
 * ela espera ver a seguir é como pagar. O Dashboard fica a um clique no menu.
 */
export default function Cadastro() {
  const router = useRouter()
  const parametros = useSearchParams()

  // O plano vem da URL (`/cadastro?plano=PRO`), mas a URL é digitável: valor
  // inventado cai no PRO em vez de quebrar a tela com `undefined`.
  const daUrl = parametros.get('plano') as PlanoNome | null
  const [plano, setPlano] = useState<PlanoNome>(
    daUrl && PLANOS_A_VENDA.includes(daUrl) ? daUrl : 'PRO'
  )

  const [nomeConsultorio, setNomeConsultorio] = useState('')
  const [nomeDono, setNomeDono] = useState('')
  const [emailDono, setEmailDono] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senhaDono, setSenhaDono] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [aceiteTermos, setAceiteTermos] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)

    try {
      await enviar('/api/cadastro', 'POST', {
        nomeConsultorio,
        nomeDono,
        emailDono,
        telefone: telefone || undefined,
        senhaDono,
        plano,
        aceiteTermos,
      })
    } catch (e: any) {
      setErro(e.message ?? 'Não foi possível criar a conta.')
      setEnviando(false)
      return
    }

    const resultado = await signIn('credentials', {
      email: emailDono,
      senha: senhaDono,
      rememberMe: 'true',
      redirect: false,
    })

    // A conta existe — o que falhou foi só o login automático. Mandar para
    // /login é melhor que mostrar erro: a senha dela já funciona lá.
    if (resultado?.error) {
      router.push('/login')
      return
    }

    // Primeiro paga, depois entra: o checkout fica fora do sistema e só abre
    // o painel quando o Asaas confirma. As boas-vindas tocam lá, depois do pago.
    router.replace('/assinar')
  }

  const teto = TETO_USUARIOS[plano]

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-neutro-950">
      <header className="border-b border-neutro-200 dark:border-neutro-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <span
                className="text-brand-950 font-black text-[20px] leading-none"
                style={{ letterSpacing: '-2px', marginRight: '-1px' }}
              >+</span>
            </div>
            <p className="text-[15px] font-bold tracking-apertado">Medflow</p>
          </Link>
          <Link href="/login" className="btn-suave text-[13px] px-3 py-2">
            Já tenho conta
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        {/* ─── Formulário ─────────────────────────────────────── */}
        <div>
          <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-apertado">
            Criar a conta da sua clínica
          </h1>
          <p className="text-[13.5px] text-neutro-500 mt-2">
            Leva um minuto. Você entra no sistema na sequência.
          </p>

          <form onSubmit={criar} className="mt-7 space-y-4 max-w-lg">
            <div>
              <label className="rotulo">Nome da clínica ou ótica</label>
              <input
                className="campo" required autoFocus
                value={nomeConsultorio}
                onChange={(e) => setNomeConsultorio(e.target.value)}
                placeholder="Ótica Visão Clara"
              />
            </div>

            <div>
              <label className="rotulo">Seu nome</label>
              <input
                className="campo" required
                value={nomeDono}
                onChange={(e) => setNomeDono(e.target.value)}
                placeholder="Maria Souza"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="rotulo">E-mail</label>
                <input
                  className="campo" type="email" required
                  value={emailDono}
                  onChange={(e) => setEmailDono(e.target.value)}
                  placeholder="maria@clinica.com.br"
                />
              </div>
              <div>
                <label className="rotulo">WhatsApp</label>
                <input
                  className="campo" type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(65) 99999-0000"
                />
              </div>
            </div>

            <div>
              <label className="rotulo">Senha</label>
              <div className="relative">
                <input
                  className="campo pr-11"
                  type={mostrarSenha ? 'text' : 'password'}
                  required minLength={8}
                  value={senhaDono}
                  onChange={(e) => setSenhaDono(e.target.value)}
                  placeholder="Ao menos 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute inset-y-0 right-3 top-1.5 flex items-center text-neutro-400 hover:text-neutro-600 dark:hover:text-neutro-300 transition-colors"
                  aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={aceiteTermos}
                onChange={(e) => setAceiteTermos(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-neutro-300 accent-brand-500 cursor-pointer"
              />
              <span className="text-[12.5px] text-neutro-600 dark:text-neutro-400 leading-relaxed">
                Li e aceito os{' '}
                <Link href="/termos" target="_blank" className="underline underline-offset-2 hover:text-brand-600">
                  Termos de Uso
                </Link>{' '}
                e a{' '}
                <Link href="/politica-de-privacidade" target="_blank" className="underline underline-offset-2 hover:text-brand-600">
                  Política de Privacidade
                </Link>
                .
              </span>
            </label>

            {erro && (
              <p className="text-[12px] text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                {erro}
              </p>
            )}

            <button type="submit" disabled={enviando || !aceiteTermos} className="btn-primario w-full">
              {enviando && <Loader2 size={16} className="animate-spin" />}
              {enviando ? 'Criando a conta...' : `Criar conta no plano ${ROTULO[plano]}`}
            </button>

            <p className="text-[11.5px] text-neutro-400 leading-relaxed">
              Sem fidelidade: a troca de plano e o cancelamento ficam na própria
              tela de Cobrança, dentro do sistema.
            </p>
          </form>
        </div>

        {/* ─── Resumo do plano escolhido ──────────────────────── */}
        <aside className="cartao p-5 lg:sticky lg:top-8">
          <label className="rotulo">Plano</label>
          <select
            className="campo"
            value={plano}
            onChange={(e) => setPlano(e.target.value as PlanoNome)}
          >
            {PLANOS_A_VENDA.map((p) => (
              <option key={p} value={p}>
                {ROTULO[p]} — R$ {PRECO_TABELA[p].toLocaleString('pt-BR')}/mês
              </option>
            ))}
          </select>

          <p className="mt-4">
            <span className="numero-destaque">
              R$ {PRECO_TABELA[plano].toLocaleString('pt-BR')}
            </span>
            <span className="text-[12.5px] text-neutro-400"> /mês</span>
          </p>
          <p className="text-[11.5px] text-neutro-400 mt-1">
            {teto === null ? 'Usuários ilimitados' : `${teto} ${teto === 1 ? 'usuário' : 'usuários'}`}
          </p>

          <ul className="mt-4 space-y-1.5">
            {INCLUI[plano].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-[12.5px] text-neutro-600 dark:text-neutro-300"
              >
                <Check size={13} className="text-brand-600 shrink-0 mt-[3px]" strokeWidth={2.4} />
                {item}
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  )
}
