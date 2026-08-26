'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LifeBuoy, ChevronDown, Check, Copy, Route, ShieldCheck, Send, Bot,
  UserRound, Headset, Plus, MessageSquare, CheckCircle2, Loader2, Inbox,
  Building2, CalendarDays, FileText, Receipt, Wallet, Users,
} from 'lucide-react'
import Avatar from '@/components/Avatar'
import { fetcher, enviar } from '@/lib/fetcher'
import { tempoRelativo } from '@/lib/formato'
import { BASE } from '@/lib/baseConhecimento'

const roteiro = [
  { icone: Users, titulo: 'Cadastre o paciente', texto: 'Pacientes → Novo. Telefone é o que faz os lembretes de WhatsApp funcionarem.', href: '/pacientes' },
  { icone: CalendarDays, titulo: 'Marque a consulta', texto: 'Agenda → Novo agendamento, ou deixe o paciente marcar pelo link público.', href: '/agenda' },
  { icone: FileText, titulo: 'Registre o exame', texto: 'Prontuários → Novo, vinculado ao paciente e à consulta do dia.', href: '/prontuarios' },
  { icone: Receipt, titulo: 'Emita a receita', texto: 'A partir do prontuário: o grau medido já entra preenchido.', href: '/receitas' },
  { icone: Wallet, titulo: 'Lance o pagamento', texto: 'Financeiro → Novo lançamento. Só o que estiver pago entra no faturamento.', href: '/financeiro' },
]

export default function SuportePage() {
  const { data: sessao } = useSession()

  // O super admin é quem atende: para ele, esta tela é a caixa de entrada.
  if (sessao?.user?.papel === 'SUPER_ADMIN') return <CaixaDeEntrada />
  return <SuporteDoCliente />
}

/* ─────────────────────────── Cliente ─────────────────────────── */

function SuporteDoCliente() {
  const { data: chamados, isLoading, mutate } = useSWR('/api/suporte/chamados', fetcher, {
    refreshInterval: 15_000,
  })
  const [ativoId, setAtivoId] = useState<string | null>(null)

  const lista = chamados ?? []
  const ativo = lista.find((c: any) => c.id === ativoId) ?? lista[0] ?? null

  return (
    <div className="p-4 sm:p-7 max-w-[1200px]">
      <div className="mb-7">
        <h1 className="titulo-pagina">Suporte</h1>
        <p className="subtitulo mt-1">Fale com a gente aqui mesmo, sem sair do sistema</p>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {lista.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              {lista.map((c: any) => (
                <button key={c.id} onClick={() => setAtivoId(c.id)}
                  className={`etiqueta transition-colors ${
                    ativo?.id === c.id
                      ? 'bg-neutro-900 dark:bg-white text-white dark:text-neutro-900'
                      : 'bg-neutro-100 dark:bg-neutro-800 text-neutro-500 hover:text-neutro-700'
                  }`}>
                  <MessageSquare size={10} strokeWidth={2} />
                  <span className="max-w-[160px] truncate">{c.assunto}</span>
                </button>
              ))}
              <button onClick={() => setAtivoId('novo')}
                className="etiqueta bg-neutro-100 dark:bg-neutro-800 text-neutro-500 hover:text-brand-600 transition-colors">
                <Plus size={10} strokeWidth={2.4} /> Nova conversa
              </button>
            </div>
          )}

          <Conversa
            chamado={ativoId === 'novo' ? null : ativo}
            carregando={isLoading}
            souSuporte={false}
            aoAtualizar={async (novo?: any) => {
              await mutate()
              if (novo?.id) setAtivoId(novo.id)
            }}
          />
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-5">
          <Faq />
          <Roteiro />
          <Instalacao />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── Conversa ─────────────────────────── */

function Conversa({
  chamado, carregando, souSuporte, aoAtualizar,
}: {
  chamado: any | null
  carregando?: boolean
  souSuporte: boolean
  aoAtualizar: (novo?: any) => Promise<void> | void
}) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fim = useRef<HTMLDivElement>(null)

  const mensagens = chamado?.mensagens ?? []
  const encerrado = chamado?.status === 'RESOLVIDO'

  // Rola para a última mensagem sempre que a conversa cresce.
  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensagens.length, chamado?.id])

  async function mandar(e: React.FormEvent) {
    e.preventDefault()
    const conteudo = texto.trim()
    if (!conteudo || enviando) return

    setEnviando(true); setErro(null)
    try {
      const resposta = chamado
        ? await enviar(`/api/suporte/chamados/${chamado.id}`, 'POST', { texto: conteudo })
        : await enviar('/api/suporte/chamados', 'POST', { texto: conteudo })
      setTexto('')
      await aoAtualizar(resposta)
    } catch (e: any) { setErro(e.message) } finally { setEnviando(false) }
  }

  async function ajustar(dados: any) {
    setEnviando(true); setErro(null)
    try {
      await enviar(`/api/suporte/chamados/${chamado.id}`, 'PATCH', dados)
      await aoAtualizar()
    } catch (e: any) { setErro(e.message) } finally { setEnviando(false) }
  }

  return (
    <section className="cartao flex flex-col h-[560px] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-neutro-100 dark:border-neutro-800">
        <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center shrink-0">
          {chamado?.escalado ? <Headset size={16} strokeWidth={2} /> : <Bot size={16} strokeWidth={2} />}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="titulo-secao truncate">
            {chamado
              ? chamado.escalado ? 'Atendimento humano' : 'Assistente do Medflow'
              : 'Assistente do Medflow'}
          </h2>
          <p className="text-[11px] text-neutro-400 truncate">
            {encerrado
              ? 'Chamado encerrado'
              : chamado?.escalado
              ? 'Um responsável responde por aqui'
              : 'Responde na hora, com base na central de ajuda'}
          </p>
        </div>
        {chamado && !encerrado && (
          <button onClick={() => ajustar({ resolver: true })} disabled={enviando}
            title="Encerrar este chamado"
            className="btn-icone !w-8 !h-8 hover:!text-brand-600">
            <CheckCircle2 size={16} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
        {carregando ? (
          <div className="space-y-3">
            <div className="esqueleto h-14 w-3/4" />
            <div className="esqueleto h-10 w-1/2 ml-auto" />
          </div>
        ) : !chamado ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center mb-3">
              <Bot size={22} strokeWidth={1.9} />
            </div>
            <p className="text-[14px] font-medium">Como posso ajudar?</p>
            <p className="text-[12.5px] text-neutro-400 mt-1 max-w-xs">
              Descreva sua dúvida. Se eu não souber responder, você abre um
              chamado e fala direto com o responsável pelo sistema.
            </p>
          </div>
        ) : (
          <>
            {mensagens.map((m: any) => <Balao key={m.id} mensagem={m} souSuporte={souSuporte} />)}
            <div ref={fim} />
          </>
        )}
      </div>

      {/* Escalar só aparece quando faz sentido: já existe conversa, ainda está
          com o agente e ninguém encerrou nada. */}
      {chamado && !chamado.escalado && !encerrado && !souSuporte && (
        <div className="px-5 py-2.5 border-t border-neutro-100 dark:border-neutro-800 bg-neutro-50/60 dark:bg-neutro-950/30">
          <button onClick={() => ajustar({ escalar: true })} disabled={enviando}
            className="flex items-center gap-2 text-[12px] font-medium text-neutro-500 hover:text-brand-600 transition-colors disabled:opacity-50">
            <Headset size={13} strokeWidth={2} />
            Não resolveu? Falar com uma pessoa
          </button>
        </div>
      )}

      {erro && <p className="px-5 py-2 text-[12px] text-red-600">{erro}</p>}

      <form onSubmit={mandar}
        className="flex items-end gap-2 px-4 py-3 border-t border-neutro-100 dark:border-neutro-800">
        <textarea
          rows={1} value={texto} disabled={encerrado}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter envia, Shift+Enter quebra linha — o padrão de todo chat.
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); mandar(e as any) }
          }}
          placeholder={encerrado ? 'Chamado encerrado' : 'Escreva sua mensagem…'}
          className="campo !mt-0 resize-none max-h-28 disabled:opacity-60" />
        <button type="submit" disabled={enviando || encerrado || !texto.trim()}
          className="btn-primario !px-3.5 !py-2.5 shrink-0">
          {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} strokeWidth={2.2} />}
        </button>
      </form>
    </section>
  )
}

/** Uma mensagem. O lado direito é sempre "eu", qualquer que seja o meu papel. */
function Balao({ mensagem, souSuporte }: { mensagem: any; souSuporte: boolean }) {
  const meu = souSuporte ? mensagem.autor === 'SUPORTE' : mensagem.autor === 'USUARIO'

  const identidade =
    mensagem.autor === 'AGENTE'
      ? { icone: Bot, nome: 'Assistente' }
      : mensagem.autor === 'SUPORTE'
      ? { icone: Headset, nome: 'Suporte' }
      : { icone: UserRound, nome: 'Você' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-2.5 ${meu ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
        mensagem.autor === 'AGENTE'
          ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600'
          : mensagem.autor === 'SUPORTE'
          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
          : 'bg-neutro-100 dark:bg-neutro-800 text-neutro-500'
      }`}>
        <identidade.icone size={14} strokeWidth={2} />
      </div>

      <div className={`max-w-[78%] ${meu ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-line ${
          meu
            ? 'bg-neutro-900 dark:bg-white text-white dark:text-neutro-900'
            : 'bg-neutro-100 dark:bg-neutro-800'
        }`}>
          {mensagem.texto}
        </div>
        <span className="text-[10.5px] text-neutro-400 mt-1 px-1">
          {identidade.nome} · {tempoRelativo(mensagem.criadoEm)}
        </span>
      </div>
    </motion.div>
  )
}

/* ─────────────────── Caixa de entrada do suporte ─────────────────── */

function CaixaDeEntrada() {
  const { data: chamados, isLoading, mutate } = useSWR('/api/admin/chamados', fetcher, {
    refreshInterval: 15_000,
  })
  const [abertoId, setAbertoId] = useState<string | null>(null)

  const { data: aberto, mutate: recarregar } = useSWR(
    abertoId ? `/api/suporte/chamados/${abertoId}` : null,
    fetcher,
    { refreshInterval: 10_000 }
  )

  const lista = chamados ?? []
  const pendentes = lista.filter((c: any) => c.status !== 'RESOLVIDO').length

  return (
    <div className="p-4 sm:p-7 max-w-[1400px]">
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="titulo-pagina">Chamados</h1>
          <p className="subtitulo mt-1">Conversas que pediram atendimento humano</p>
        </div>
        <span className="etiqueta bg-neutro-100 text-neutro-600 dark:bg-neutro-800 dark:text-neutro-400">
          <Inbox size={12} strokeWidth={2} /> {pendentes} em aberto
        </span>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-5 space-y-2.5">
          {isLoading ? (
            [0, 1, 2].map((i) => <div key={i} className="esqueleto h-[84px]" />)
          ) : lista.length === 0 ? (
            <div className="cartao py-16 flex flex-col items-center">
              <Inbox size={22} className="text-neutro-300 dark:text-neutro-700 mb-2" strokeWidth={1.8} />
              <p className="text-[13px] font-medium">Nenhum chamado</p>
              <p className="text-[12px] text-neutro-400 mt-0.5">
                O agente está dando conta sozinho.
              </p>
            </div>
          ) : (
            lista.map((c: any) => (
              <button key={c.id} onClick={() => setAbertoId(c.id)}
                className={`cartao-interativo w-full text-left px-4 py-3.5 flex items-start gap-3 ${
                  abertoId === c.id ? '!border-brand-400' : ''
                }`}>
                <Avatar nome={c.usuario.nome} fotoUrl={c.usuario.fotoUrl} tamanho={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium truncate">{c.usuario.nome}</p>
                    {c.status === 'RESOLVIDO' ? (
                      <span className="etiqueta bg-neutro-100 text-neutro-500 dark:bg-neutro-800">
                        Encerrado
                      </span>
                    ) : c.status === 'EM_ATENDIMENTO' ? (
                      <span className="etiqueta bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                        Em atendimento
                      </span>
                    ) : (
                      <span className="etiqueta bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        Aguardando
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-neutro-400 flex items-center gap-1 truncate">
                    <Building2 size={10} strokeWidth={2} /> {c.consultorio.nome}
                  </p>
                  <p className="text-[12px] text-neutro-500 truncate mt-1">{c.assunto}</p>
                  <p className="text-[10.5px] text-neutro-400 mt-1">
                    {c._count.mensagens} mensagens · {tempoRelativo(c.atualizadoEm)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="col-span-12 lg:col-span-7">
          {abertoId ? (
            <Conversa chamado={aberto} souSuporte
              aoAtualizar={async () => { await recarregar(); await mutate() }} />
          ) : (
            <div className="cartao h-[560px] flex flex-col items-center justify-center">
              <MessageSquare size={24} className="text-neutro-300 dark:text-neutro-700 mb-2" strokeWidth={1.7} />
              <p className="text-[13px] text-neutro-400">Escolha um chamado para responder</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── Blocos de ajuda ─────────────────────────── */

function Faq() {
  const [aberta, setAberta] = useState<number | null>(0)

  return (
    <section className="cartao overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-neutro-100 dark:border-neutro-800">
        <LifeBuoy size={16} className="text-neutro-400" strokeWidth={2} />
        <h2 className="titulo-secao">Perguntas frequentes</h2>
      </div>

      <div className="divide-y divide-neutro-100 dark:divide-neutro-800">
        {BASE.map((item, i) => (
          <div key={item.id}>
            <button onClick={() => setAberta(aberta === i ? null : i)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-neutro-50 dark:hover:bg-neutro-800/40">
              <span className="flex-1 text-[13px] font-medium">{item.pergunta}</span>
              <ChevronDown size={15}
                className={`text-neutro-400 shrink-0 transition-transform duration-200 ${
                  aberta === i ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence initial={false}>
              {aberta === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden">
                  <p className="px-5 pb-4 text-[12.5px] leading-relaxed text-neutro-500">
                    {item.resposta}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  )
}

function Roteiro() {
  return (
    <section className="cartao p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <Route size={16} className="text-neutro-400" strokeWidth={2} />
        <h2 className="titulo-secao">O caminho de um atendimento</h2>
      </div>
      <p className="text-[11px] text-neutro-400 mb-4">
        A ordem em que as telas se encaixam no dia a dia
      </p>

      <ol className="space-y-1">
        {roteiro.map((passo, i) => (
          <li key={passo.titulo}>
            <Link href={passo.href}
              className="flex items-start gap-3 rounded-lg px-2.5 py-2.5 -mx-2.5 transition-colors hover:bg-neutro-50 dark:hover:bg-neutro-800/40 group">
              <span className="w-6 h-6 rounded-full bg-neutro-100 dark:bg-neutro-800 text-[11px] font-semibold numerico text-neutro-500 flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[13px] font-medium group-hover:text-brand-600 transition-colors">
                  <passo.icone size={13} strokeWidth={2} className="text-neutro-400" />
                  {passo.titulo}
                </span>
                <span className="block text-[11.5px] text-neutro-400 mt-0.5">{passo.texto}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Instalacao() {
  const { data: sessao } = useSession()
  const { data: consultorio } = useSWR('/api/consultorio', fetcher)
  const [copiado, setCopiado] = useState(false)

  const diagnostico = [
    `Consultório: ${consultorio?.nome ?? '—'}`,
    `Link público: /agendar/${consultorio?.slug ?? '—'}`,
    `Usuário: ${sessao?.user?.name ?? '—'} (${sessao?.user?.email ?? '—'})`,
    `Papel: ${sessao?.user?.papel ?? '—'}`,
  ].join('\n')

  function copiar() {
    navigator.clipboard.writeText(diagnostico)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <section className="cartao p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <ShieldCheck size={16} className="text-neutro-400" strokeWidth={2} />
        <h2 className="titulo-secao">Sua instalação</h2>
      </div>
      <p className="text-[11px] text-neutro-400 mb-4">
        Cole junto ao abrir um chamado — ajuda a achar o problema mais rápido
      </p>

      <pre className="text-[11.5px] leading-relaxed text-neutro-500 bg-neutro-50 dark:bg-neutro-950/40 border border-neutro-200/70 dark:border-neutro-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
        {diagnostico}
      </pre>

      <button onClick={copiar} className="btn-suave w-full mt-3 !py-2 !text-[12px]">
        {copiado ? <Check size={14} className="text-brand-600" /> : <Copy size={14} />}
        {copiado ? 'Copiado' : 'Copiar informações'}
      </button>
    </section>
  )
}
