'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { appUrl } from '@/lib/rotas'
import useSWR from 'swr'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarCheck, CalendarX2, Receipt, RefreshCw, Wallet, Send, Check, CheckCheck,
  PhoneOff, Globe, RotateCcw, MessageCircle, Undo2, Sparkles,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { data, hora, moeda } from '@/lib/formato'
import { linkWhatsApp } from '@/lib/whatsapp'
import Avatar from '@/components/Avatar'
import CampoBusca, { contem } from '@/components/CampoBusca'

/**
 * Central de disparos pelo WhatsApp.
 *
 * Cada fila nasce de um dado real do sistema (consulta, falta, receita,
 * retorno, pagamento) e o item some sozinho quando o motivo deixa de existir.
 * O envio é pelo `wa.me`: abre a conversa com o texto pronto e a pessoa só
 * aperta enviar — a API oficial do WhatsApp Business não está contratada.
 *
 * O que já foi enviado e os modelos editados ficam no navegador.
 * ponytail: por navegador; se duas atendentes disparam a mesma fila, mover
 * "enviados" para uma tabela no banco.
 */

type Chave = 'confirmacoes' | 'remarcar' | 'receitasVencendo' | 'retornos' | 'financeiro'

const primeiroNome = (nome?: string | null) => (nome ?? '').trim().split(/\s+/)[0] || 'tudo bem'

function quandoAmigavel(iso: string) {
  const d = new Date(iso)
  const hoje = new Date()
  const amanha = new Date(); amanha.setDate(hoje.getDate() + 1)
  if (d.toDateString() === hoje.toDateString()) return 'hoje'
  if (d.toDateString() === amanha.toDateString()) return 'amanhã'
  return `em ${data(iso)}`
}

const FILAS: {
  chave: Chave
  titulo: string
  descricao: string
  icone: any
  cor: string
  variaveis: string[]
  modelo: string
  valores: (i: any) => Record<string, string>
  detalhe: (i: any) => string
  selo: (i: any) => string | null
}[] = [
  {
    chave: 'confirmacoes',
    titulo: 'Confirmar presença',
    descricao: 'Consultas nas próximas 48h',
    icone: CalendarCheck,
    cor: 'text-brand-600 bg-brand-50 dark:bg-brand-900/30 dark:text-brand-400',
    variaveis: ['nome', 'dia', 'hora', 'clinica'],
    modelo: 'Olá, {nome}! Aqui é da *{clinica}*. Passando para confirmar sua consulta {dia} às *{hora}*. Podemos contar com você? 😊',
    valores: (i) => ({ dia: quandoAmigavel(i.quando), hora: hora(i.quando) }),
    detalhe: (i) => `${i.hoje ? 'Hoje' : data(i.quando)} às ${hora(i.quando)}`,
    selo: (i) => (i.origemPublica ? 'Online' : null),
  },
  {
    chave: 'remarcar',
    titulo: 'Remarcar faltas',
    descricao: 'Faltou e não tem novo horário',
    icone: CalendarX2,
    cor: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400',
    variaveis: ['nome', 'data', 'clinica'],
    modelo: 'Olá, {nome}! Sentimos sua falta na consulta de {data} aqui na *{clinica}*. Quer escolher um novo horário? Estamos à disposição.',
    valores: (i) => ({ data: data(i.quando) }),
    detalhe: (i) => `Faltou em ${data(i.quando)}`,
    selo: () => null,
  },
  {
    chave: 'receitasVencendo',
    titulo: 'Receitas a renovar',
    descricao: 'Vencidas ou vencendo em 45 dias',
    icone: Receipt,
    cor: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-400',
    variaveis: ['nome', 'situacao', 'validade', 'clinica'],
    modelo: 'Olá, {nome}! Sua receita de óculos {situacao} em *{validade}*. Que tal agendar um novo exame na *{clinica}* para manter sua visão em dia?',
    valores: (i) => ({ situacao: i.vencida ? 'venceu' : 'vence', validade: data(i.validadeAte) }),
    detalhe: (i) => (i.vencida ? `Venceu em ${data(i.validadeAte)}` : `Vence em ${data(i.validadeAte)}`),
    selo: (i) => (i.vencida ? 'Vencida' : null),
  },
  {
    chave: 'retornos',
    titulo: 'Retorno anual',
    descricao: 'Sem consulta há mais de 12 meses',
    icone: RefreshCw,
    cor: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-400',
    variaveis: ['nome', 'ultima', 'clinica'],
    modelo: 'Olá, {nome}! Já faz mais de um ano desde seu último exame de vista aqui na *{clinica}*. Vamos agendar uma revisão?',
    valores: (i) => ({ ultima: i.ultimaConsulta ? data(i.ultimaConsulta) : '' }),
    detalhe: (i) => (i.ultimaConsulta ? `Última consulta em ${data(i.ultimaConsulta)}` : 'Sem histórico recente'),
    selo: () => null,
  },
  {
    chave: 'financeiro',
    titulo: 'Pagamentos em atraso',
    descricao: 'Lançamentos vencidos',
    icone: Wallet,
    cor: 'text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400',
    variaveis: ['nome', 'valor', 'descricao', 'vencimento', 'clinica'],
    modelo: 'Olá, {nome}! Aqui é da *{clinica}*. Consta em aberto o valor de *{valor}* referente a {descricao}, com vencimento em {vencimento}. Podemos ajudar a acertar?',
    valores: (i) => ({ valor: moeda(i.valor), descricao: i.descricao, vencimento: data(i.data) }),
    detalhe: (i) => `${moeda(i.valor)} · ${i.descricao} · venceu ${data(i.data)}`,
    selo: (i) => moeda(i.valor),
  },
]

/* ─────────── Memória local: enviados e modelos ─────────── */

const CHAVE_ENVIADOS = 'medflow:disparos:enviados'
const CHAVE_MODELOS = 'medflow:disparos:modelos'
const SETE_DIAS = 7 * 864e5

function ler<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave)
    return v ? (JSON.parse(v) as T) : padrao
  } catch { return padrao }
}

function gravar(chave: string, valor: unknown) {
  try { localStorage.setItem(chave, JSON.stringify(valor)) } catch { /* modo privado */ }
}

/** Troca {variavel} pelo valor. Variável sem valor some sem deixar chave. */
function preencher(modelo: string, valores: Record<string, string>) {
  return modelo.replace(/\{(\w+)\}/g, (_, v) => valores[v] ?? '')
}

/** *negrito* do WhatsApp, renderizado na prévia. */
function TextoWhats({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*[^*\n]+\*)/g).map((parte, i) =>
        parte.startsWith('*') && parte.endsWith('*') && parte.length > 2
          ? <strong key={i}>{parte.slice(1, -1)}</strong>
          : <span key={i}>{parte}</span>
      )}
    </>
  )
}

export default function LembretesPage() {
  const { data: lembretes, isLoading } = useSWR('/api/lembretes', fetcher, { refreshInterval: 60_000 })
  const { data: consultorio } = useSWR('/api/consultorio', fetcher)

  const [filaAtiva, setFilaAtiva] = useState<Chave>('confirmacoes')
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [visao, setVisao] = useState<'pendentes' | 'enviados' | 'todos'>('pendentes')
  const [busca, setBusca] = useState('')
  const [enviados, setEnviados] = useState<Record<string, number>>({})
  const [modelos, setModelos] = useState<Record<string, string>>({})
  const previa = useRef<HTMLDivElement>(null)

  // Lê do navegador só no cliente, e já descarta envios antigos.
  useEffect(() => {
    const agora = Date.now()
    const salvos = ler<Record<string, number>>(CHAVE_ENVIADOS, {})
    const recentes = Object.fromEntries(Object.entries(salvos).filter(([, t]) => agora - t < SETE_DIAS))
    setEnviados(recentes)
    gravar(CHAVE_ENVIADOS, recentes)
    setModelos(ler(CHAVE_MODELOS, {}))
  }, [])

  // Primeira fila com algo pendente abre selecionada.
  useEffect(() => {
    if (!lembretes) return
    const comItens = FILAS.find((f) => (lembretes[f.chave] ?? []).length > 0)
    if (comItens) setFilaAtiva((atual) => ((lembretes[atual] ?? []).length ? atual : comItens.chave))
  }, [lembretes])

  const fila = FILAS.find((f) => f.chave === filaAtiva)!
  const chaveItem = (c: Chave, i: any) => `${c}:${i.id}`
  const foiEnviado = (c: Chave, i: any) => !!enviados[chaveItem(c, i)]

  const itensDaFila: any[] = lembretes?.[filaAtiva] ?? []
  const visiveis = itensDaFila
    .filter((i) => contem(busca, i.paciente, fila.detalhe(i), i.telefone))
    .filter((i) => visao === 'todos' || (visao === 'enviados') === foiEnviado(filaAtiva, i))

  const selecionado = itensDaFila.find((i) => i.id === selecionadoId) ?? visiveis[0] ?? null

  const modelo = modelos[filaAtiva] ?? fila.modelo
  const mensagem = selecionado
    ? preencher(modelo, {
        nome: primeiroNome(selecionado.paciente),
        clinica: consultorio?.nome ?? 'clínica',
        ...fila.valores(selecionado),
      })
    : ''

  // Placar geral do dia, por fila e somado.
  const placar = useMemo(() => {
    const porFila = Object.fromEntries(FILAS.map((f) => {
      const itens: any[] = lembretes?.[f.chave] ?? []
      const env = itens.filter((i) => enviados[`${f.chave}:${i.id}`]).length
      return [f.chave, { total: itens.length, enviados: env, pendentes: itens.length - env }]
    })) as Record<Chave, { total: number; enviados: number; pendentes: number }>
    const total = Object.values(porFila).reduce((s, f) => s + f.total, 0)
    const env = Object.values(porFila).reduce((s, f) => s + f.enviados, 0)
    const semTelefone = FILAS.reduce((s, f) => s + (lembretes?.[f.chave] ?? []).filter((i: any) => !i.telefone).length, 0)
    return { porFila, total, enviados: env, pendentes: total - env, semTelefone }
  }, [lembretes, enviados])

  function marcar(item: any, enviado: boolean) {
    setEnviados((atual) => {
      const novo = { ...atual }
      if (enviado) novo[chaveItem(filaAtiva, item)] = Date.now()
      else delete novo[chaveItem(filaAtiva, item)]
      gravar(CHAVE_ENVIADOS, novo)
      return novo
    })
  }

  function proximoPendente(depoisDe: any) {
    const pendentes = itensDaFila.filter((i) => i.telefone && !foiEnviado(filaAtiva, i) && i.id !== depoisDe.id)
    const idx = itensDaFila.findIndex((i) => i.id === depoisDe.id)
    return pendentes.find((i) => itensDaFila.indexOf(i) > idx) ?? pendentes[0] ?? null
  }

  /** Abre a conversa, marca como enviado e já posiciona no próximo da fila. */
  function disparar(item: any, texto: string, seguir = true) {
    const link = linkWhatsApp(item.telefone, texto)
    if (!link) return
    window.open(link, '_blank', 'noopener')
    marcar(item, true)
    if (seguir) {
      const prox = proximoPendente(item)
      if (prox) setSelecionadoId(prox.id)
    }
  }

  function salvarModelo(texto: string) {
    setModelos((atual) => {
      const novo = { ...atual, [filaAtiva]: texto }
      gravar(CHAVE_MODELOS, novo)
      return novo
    })
  }

  function restaurarModelo() {
    setModelos((atual) => {
      const { [filaAtiva]: _, ...resto } = atual
      gravar(CHAVE_MODELOS, resto)
      return resto
    })
  }

  function escolher(item: any) {
    setSelecionadoId(item.id)
    // No celular a prévia fica abaixo da lista: leva até ela.
    if (window.innerWidth < 1024) setTimeout(() => previa.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const progresso = placar.total ? Math.round((placar.enviados / placar.total) * 100) : 0

  return (
    <div className="p-4 sm:p-7 max-w-[1500px]">
      {/* Cabeçalho */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="titulo-pagina flex items-center gap-2.5">
            Central de disparos
          </h1>
          <p className="subtitulo mt-1">Quem precisa de uma mensagem hoje, com o texto pronto para o WhatsApp</p>
        </div>
      </div>

      {/* Placar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Placar rotulo="Na fila" valor={placar.total} icone={MessageCircle} />
        <Placar rotulo="Pendentes" valor={placar.pendentes} icone={Send} destaque />
        <Placar rotulo="Enviados (7 dias)" valor={placar.enviados} icone={CheckCheck} />
        <div className="cartao p-4">
          <p className="rotulo-kpi">Progresso</p>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-[22px] font-semibold numerico tracking-apertado">{progresso}%</span>
            {placar.semTelefone > 0 && (
              <span className="text-[11px] text-neutro-400">· {placar.semTelefone} sem telefone</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-neutro-100 dark:bg-neutro-800 mt-2 overflow-hidden">
            <motion.div className="h-full bg-brand-500 rounded-full"
              initial={false} animate={{ width: `${progresso}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid lg:grid-cols-[240px_1fr_380px] gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="esqueleto h-[420px]" />)}
        </div>
      ) : placar.total === 0 ? (
        <div className="cartao py-20 flex flex-col items-center text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center mb-4">
            <Sparkles size={24} strokeWidth={1.9} />
          </div>
          <p className="text-[15px] font-semibold">Tudo em dia</p>
          <p className="text-[12.5px] text-neutro-400 mt-1 max-w-sm">
            Consultas confirmadas, receitas em dia e ninguém para remarcar. As filas se enchem sozinhas conforme a agenda anda.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[240px_minmax(0,1fr)_380px] gap-4 items-start">
          {/* ── Filas ── */}
          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0 lg:sticky lg:top-[85px]">
            {FILAS.map((f) => {
              const p = placar.porFila[f.chave]
              const ativa = f.chave === filaAtiva
              return (
                <button key={f.chave}
                  onClick={() => { setFilaAtiva(f.chave); setSelecionadoId(null); setBusca('') }}
                  className={`shrink-0 lg:w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-200 active:scale-[0.99] ${
                    ativa
                      ? 'bg-white dark:bg-neutro-900 border-neutro-200 dark:border-neutro-700 shadow-media'
                      : 'border-transparent hover:bg-neutro-100/70 dark:hover:bg-neutro-800/60'
                  }`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${f.cor}`}>
                    <f.icone size={17} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-medium truncate ${ativa ? '' : 'text-neutro-600 dark:text-neutro-300'}`}>{f.titulo}</p>
                    <p className="text-[11px] text-neutro-400 truncate hidden lg:block">
                      {p.total === 0 ? 'Nada pendente' : `${p.enviados} de ${p.total} enviados`}
                    </p>
                  </div>
                  {p.pendentes > 0 && (
                    <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-brand-500 text-brand-950 text-[11px] font-semibold numerico flex items-center justify-center">
                      {p.pendentes}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* ── Contatos da fila ── */}
          <section className="cartao overflow-hidden flex flex-col min-h-[420px] lg:max-h-[calc(100vh-260px)]">
            <div className="px-4 py-3.5 border-b border-neutro-100 dark:border-neutro-800 space-y-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${fila.cor}`}>
                  <fila.icone size={15} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="titulo-secao truncate">{fila.titulo}</h2>
                  <p className="text-[11px] text-neutro-400 truncate">{fila.descricao}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar contato..." />
                <div className="flex items-center p-0.5 rounded-lg bg-neutro-100 dark:bg-neutro-800">
                  {(['pendentes', 'enviados', 'todos'] as const).map((v) => (
                    <button key={v} onClick={() => setVisao(v)}
                      className={`px-2.5 py-1.5 rounded-md text-[11.5px] font-medium capitalize transition-all ${
                        visao === v
                          ? 'bg-white dark:bg-neutro-900 shadow-suave'
                          : 'text-neutro-500 hover:text-neutro-700 dark:hover:text-neutro-300'
                      }`}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-neutro-100 dark:divide-neutro-800">
              {visiveis.length === 0 && (
                <div className="py-14 flex flex-col items-center text-center px-6">
                  <CheckCheck size={22} className="text-brand-500 mb-2" />
                  <p className="text-[13px] font-medium">
                    {visao === 'pendentes' && !busca ? 'Fila concluída' : 'Ninguém aqui'}
                  </p>
                  <p className="text-[11.5px] text-neutro-400 mt-0.5">
                    {visao === 'pendentes' && !busca ? 'Todos desta fila já receberam mensagem.' : 'Ajuste a busca ou o filtro.'}
                  </p>
                </div>
              )}
              <AnimatePresence initial={false}>
                {visiveis.map((item) => {
                  const enviado = foiEnviado(filaAtiva, item)
                  const ativo = selecionado?.id === item.id
                  const selo = fila.selo(item)
                  return (
                    <motion.div key={item.id} layout
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      onClick={() => escolher(item)}
                      className={`relative flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        ativo ? 'bg-brand-50/60 dark:bg-brand-900/15' : 'hover:bg-neutro-50 dark:hover:bg-neutro-800/40'
                      }`}>
                      {ativo && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-brand-500" />}
                      <div className={enviado ? 'opacity-50' : ''}>
                        <Avatar nome={item.paciente} tamanho={38} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-[13.5px] font-medium truncate ${enviado ? 'text-neutro-400' : ''}`}>
                            {item.paciente ?? 'Sem paciente vinculado'}
                          </p>
                          {selo === 'Online' && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded shrink-0">
                              <Globe size={10} strokeWidth={2.2} /> Online
                            </span>
                          )}
                          {selo && selo !== 'Online' && (
                            <span className="text-[10px] font-medium text-neutro-500 bg-neutro-100 dark:bg-neutro-800 px-1.5 py-0.5 rounded numerico shrink-0">
                              {selo}
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-neutro-400 truncate mt-0.5">{fila.detalhe(item)}</p>
                      </div>

                      {!item.telefone ? (
                        <span title="Paciente sem telefone cadastrado"
                          className="flex items-center gap-1 text-[11px] text-neutro-400 shrink-0">
                          <PhoneOff size={13} strokeWidth={2} />
                          <span className="hidden sm:inline">Sem telefone</span>
                        </span>
                      ) : enviado ? (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-brand-600 dark:text-brand-400 shrink-0">
                          <CheckCheck size={15} strokeWidth={2.2} />
                          <span className="hidden sm:inline">Enviado</span>
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            disparar(item, preencher(modelo, {
                              nome: primeiroNome(item.paciente),
                              clinica: consultorio?.nome ?? 'clínica',
                              ...fila.valores(item),
                            }), false)
                          }}
                          title="Enviar agora pelo WhatsApp"
                          className="w-8 h-8 rounded-full bg-brand-500 text-brand-950 flex items-center justify-center shrink-0 hover:bg-brand-400 active:scale-95 transition-all shadow-suave">
                          <Send size={14} strokeWidth={2.2} className="-ml-0.5" />
                        </button>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </section>

          {/* ── Prévia + modelo ── */}
          <aside ref={previa} className="lg:sticky lg:top-[85px] space-y-3">
            <div className="cartao overflow-hidden">
              {/* Cabeçalho da conversa, como no WhatsApp */}
              <div className="flex items-center gap-3 px-4 py-3 bg-neutro-50 dark:bg-neutro-950/60 border-b border-neutro-100 dark:border-neutro-800">
                {selecionado ? (
                  <>
                    <Avatar nome={selecionado.paciente} tamanho={34} />
                    <div className="min-w-0 flex-1">
                      {selecionado.pacienteId ? (
                        <Link href={appUrl(`/pacientes?paciente=${selecionado.pacienteId}`)}
                          className="block text-[13px] font-medium truncate hover:text-brand-600 transition-colors">
                          {selecionado.paciente}
                        </Link>
                      ) : (
                        <p className="text-[13px] font-medium truncate">{selecionado.paciente ?? 'Sem paciente'}</p>
                      )}
                      <p className="text-[11px] text-neutro-400 numerico truncate">
                        {selecionado.telefone ?? 'Sem telefone cadastrado'}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-[12.5px] text-neutro-400 py-1.5">Escolha um contato</p>
                )}
              </div>

              {/* Conversa */}
              <div className="papel-whats px-4 py-6 min-h-[200px] flex flex-col justify-end">
                <AnimatePresence mode="wait">
                  {selecionado && (
                    <motion.div key={`${filaAtiva}-${selecionado.id}`}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="self-end max-w-[88%] rounded-lg rounded-tr-none px-3 py-2 shadow-suave bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef]">
                      <p className="text-[13px] leading-[1.45] whitespace-pre-wrap break-words">
                        <TextoWhats texto={mensagem} />
                      </p>
                      <p className="flex items-center justify-end gap-1 text-[10px] text-[#667781] dark:text-[#8696a0] mt-1 -mb-0.5">
                        {hora(new Date().toISOString())}
                        {foiEnviado(filaAtiva, selecionado)
                          ? <CheckCheck size={14} className="text-[#53bdeb]" />
                          : <Check size={14} />}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Ações */}
              {selecionado && (
                <div className="p-3 border-t border-neutro-100 dark:border-neutro-800 flex items-center gap-2">
                  {foiEnviado(filaAtiva, selecionado) ? (
                    <>
                      <button onClick={() => disparar(selecionado, mensagem, false)} disabled={!selecionado.telefone}
                        className="btn-suave flex-1 justify-center !text-[12.5px]">
                        <Send size={14} strokeWidth={2} /> Reenviar
                      </button>
                      <button onClick={() => marcar(selecionado, false)} title="Voltar para pendentes"
                        className="btn-suave !px-3 !text-[12.5px]">
                        <Undo2 size={14} strokeWidth={2} />
                      </button>
                    </>
                  ) : selecionado.telefone ? (
                    <>
                      <button onClick={() => disparar(selecionado, mensagem)}
                        className="btn flex-1 justify-center bg-brand-500 text-brand-950 hover:bg-brand-400 font-semibold shadow-suave !text-[13px]">
                        <Send size={15} strokeWidth={2.2} /> Enviar e ir para o próximo
                      </button>
                      <button onClick={() => marcar(selecionado, true)} title="Marcar como enviado sem abrir o WhatsApp"
                        className="btn-suave !px-3">
                        <Check size={15} strokeWidth={2.2} />
                      </button>
                    </>
                  ) : (
                    <Link href={selecionado.pacienteId ? `/pacientes?paciente=${selecionado.pacienteId}` : '/pacientes'}
                      className="btn-suave flex-1 justify-center !text-[12.5px]">
                      <PhoneOff size={14} strokeWidth={2} /> Cadastrar telefone
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Modelo da fila */}
            <EditorDeModelo
              chave={filaAtiva}
              texto={modelo}
              variaveis={fila.variaveis}
              alterado={modelos[filaAtiva] !== undefined}
              aoMudar={salvarModelo}
              aoRestaurar={restaurarModelo}
            />
          </aside>
        </div>
      )}
    </div>
  )
}

function Placar({ rotulo, valor, icone: Icone, destaque }: { rotulo: string; valor: number; icone: any; destaque?: boolean }) {
  return (
    <div className="cartao p-4 flex items-start justify-between">
      <div>
        <p className="rotulo-kpi">{rotulo}</p>
        <p className={`text-[22px] font-semibold numerico tracking-apertado mt-1.5 ${destaque && valor > 0 ? 'text-brand-600 dark:text-brand-400' : ''}`}>
          {valor}
        </p>
      </div>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        destaque ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400' : 'bg-neutro-100 text-neutro-500 dark:bg-neutro-800'
      }`}>
        <Icone size={15} strokeWidth={2} />
      </div>
    </div>
  )
}

/** Texto da fila, editável. As variáveis entram onde o cursor está. */
function EditorDeModelo({ chave, texto, variaveis, alterado, aoMudar, aoRestaurar }: {
  chave: string
  texto: string
  variaveis: string[]
  alterado: boolean
  aoMudar: (t: string) => void
  aoRestaurar: () => void
}) {
  const area = useRef<HTMLTextAreaElement>(null)
  const [salvo, setSalvo] = useState(false)

  function inserir(variavel: string) {
    const el = area.current
    const marca = `{${variavel}}`
    if (!el) return aoMudar(texto + marca)
    const ini = el.selectionStart ?? texto.length
    const fim = el.selectionEnd ?? texto.length
    aoMudar(texto.slice(0, ini) + marca + texto.slice(fim))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(ini + marca.length, ini + marca.length)
    })
  }

  function mudar(t: string) {
    aoMudar(t)
    setSalvo(true)
  }

  useEffect(() => {
    if (!salvo) return
    const t = setTimeout(() => setSalvo(false), 1200)
    return () => clearTimeout(t)
  }, [salvo, texto])

  return (
    <div className="cartao p-4 space-y-2.5" key={chave}>
      <div className="flex items-center justify-between">
        <p className="rotulo-kpi">Mensagem desta fila</p>
        <div className="flex items-center gap-2">
          {salvo && (
            <span className="flex items-center gap-1 text-[11px] text-brand-600 dark:text-brand-400">
              <Check size={11} strokeWidth={2.4} /> Salvo
            </span>
          )}
          {alterado && !salvo && (
            <button onClick={aoRestaurar} title="Voltar ao texto original"
              className="flex items-center gap-1 text-[11px] text-neutro-400 hover:text-neutro-600 dark:hover:text-neutro-300 transition-colors">
              <RotateCcw size={11} strokeWidth={2} /> Restaurar
            </button>
          )}
        </div>
      </div>
      <textarea ref={area} rows={5} className="campo !mt-0 resize-none text-[12.5px] leading-relaxed"
        value={texto} onChange={(e) => mudar(e.target.value)} />
      <div className="flex flex-wrap gap-1.5">
        {variaveis.map((v) => (
          <button key={v} type="button" onClick={() => inserir(v)}
            className="text-[11px] font-medium px-2 py-1 rounded-md bg-neutro-100 dark:bg-neutro-800 text-neutro-600 dark:text-neutro-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-900/30 dark:hover:text-brand-400 transition-colors font-mono">
            {`{${v}}`}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-neutro-400">
        Use *asteriscos* para negrito. O texto fica salvo neste navegador.
      </p>
    </div>
  )
}
