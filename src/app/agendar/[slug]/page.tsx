'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye, Check, Loader2, ChevronLeft, ChevronRight, MapPin, Phone,
  CalendarDays, Clock, UserRound, ArrowRight, AlertCircle,
} from 'lucide-react'
import Avatar from '@/components/Avatar'
import { hora, data as fmtData } from '@/lib/formato'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, format, addMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Página pública de agendamento — a única tela que o paciente vê.
 *
 * Feita para o polegar antes do mouse: a maioria abre isto pelo link do
 * WhatsApp, no celular, e decide em menos de um minuto. Por isso o caminho é
 * um passo por vez (com quem → que dia → que horas → quem é você), cada etapa
 * só aparece quando a anterior foi resolvida, e o resumo do que já foi
 * escolhido fica sempre à vista.
 */

/** Data local em AAAA-MM-DD. `toISOString` viraria o dia no fim da tarde. */
const paramDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function AgendamentoPublicoPage() {
  const { slug } = useParams<{ slug: string }>()

  const [consultorio, setConsultorio] = useState<any>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  const [profissional, setProfissional] = useState<any>(null)
  const [mes, setMes] = useState(new Date())
  const [dia, setDia] = useState<Date | null>(null)
  const [horarios, setHorarios] = useState<any[]>([])
  const [carregandoHorarios, setCarregandoHorarios] = useState(false)
  const [escolhido, setEscolhido] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [vendedora, setVendedora] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmado, setConfirmado] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/publico/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.erro) return setErroCarga(d.erro)
        setConsultorio(d)
        // Um profissional só? Então não existe escolha a fazer: já entra
        // selecionado e o paciente cai direto na agenda dele.
        if (d.profissionais?.length === 1) setProfissional(d.profissionais[0])
      })
      .catch(() => setErroCarga('Não foi possível carregar a página.'))
  }, [slug])

  /** Dias do mês visível no calendário, com flag de abertura. */
  const diasDoMes = useMemo(() => {
    if (!consultorio) return []
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const inicio = startOfWeek(startOfMonth(mes), { weekStartsOn: 0 })
    const fim = endOfWeek(endOfMonth(mes), { weekStartsOn: 0 })
    return eachDayOfInterval({ start: inicio, end: fim }).map((d) => ({
      data: d,
      doMes: isSameMonth(d, mes),
      aberto: d >= hoje && consultorio.diasAtendimento.includes(d.getDay()),
    }))
  }, [consultorio, mes])

  // Assim que houver profissional e dia, busca os horários daquele profissional.
  useEffect(() => {
    if (!profissional || !dia) return
    setCarregandoHorarios(true)
    setEscolhido(null)
    fetch(`/api/publico/${slug}/horarios?dia=${paramDia(dia)}&profissional=${profissional.id}`)
      .then((r) => r.json())
      .then((d) => setHorarios(Array.isArray(d) ? d : []))
      .catch(() => setHorarios([]))
      .finally(() => setCarregandoHorarios(false))
  }, [slug, dia, profissional])

  const livres = horarios.filter((h) => h.disponivel)
  const podeConfirmar = escolhido && nome.trim().length >= 2 && telefone.trim().length >= 8

  async function confirmar() {
    if (!podeConfirmar || enviando) return
    setEnviando(true)
    setErro(null)

    try {
      const resposta = await fetch(`/api/publico/${slug}/agendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          telefone,
          profissionalId: profissional.id,
          vendedoraResponsavel: vendedora || null,
          dataHora: escolhido,
        }),
      })
      const dados = await resposta.json()

      if (!resposta.ok) {
        setErro(dados.erro ?? 'Não foi possível concluir o agendamento.')
        // Recarrega: quase sempre alguém pegou este horário primeiro.
        fetch(`/api/publico/${slug}/horarios?dia=${paramDia(dia!)}&profissional=${profissional.id}`)
          .then((r) => r.json())
          .then((d) => setHorarios(Array.isArray(d) ? d : []))
        setEscolhido(null)
        return
      }
      setConfirmado(dados)
    } catch {
      setErro('Falha de conexão. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  if (confirmado) return <TelaConfirmada dados={confirmado} consultorio={consultorio} />

  if (erroCarga) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="cartao p-8 max-w-sm w-full text-center">
          <AlertCircle size={26} className="text-amber-500 mx-auto mb-3" strokeWidth={1.9} />
          <p className="text-[15px] font-semibold mb-1">Link indisponível</p>
          <p className="text-[13px] text-neutro-500">{erroCarga}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28 sm:pb-12">
      {/* Cabeçalho */}
      <header className="bg-white dark:bg-neutro-900 border-b border-neutro-200/70 dark:border-neutro-800">
        <div className="max-w-xl mx-auto px-5 py-7 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white mx-auto mb-3 shadow-suave">
            <Eye size={24} strokeWidth={2.1} />
          </div>
          <h1 className="text-[19px] font-semibold tracking-apertado">
            {consultorio?.nome ?? 'Carregando…'}
          </h1>
          <p className="text-[13px] text-neutro-400 mt-0.5">Agende sua consulta</p>

          {consultorio && (consultorio.telefone || consultorio.endereco) && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-3">
              {consultorio.telefone && (
                <span className="flex items-center gap-1.5 text-[11.5px] text-neutro-400">
                  <Phone size={11} strokeWidth={2} /> {consultorio.telefone}
                </span>
              )}
              {consultorio.endereco && (
                <span className="flex items-center gap-1.5 text-[11.5px] text-neutro-400">
                  <MapPin size={11} strokeWidth={2} /> {consultorio.endereco}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 py-6 space-y-5">
        {!consultorio ? (
          <div className="space-y-4">
            <div className="esqueleto h-[120px]" />
            <div className="esqueleto h-[90px]" />
          </div>
        ) : consultorio.profissionais.length === 0 ? (
          <div className="cartao p-8 text-center">
            <AlertCircle size={22} className="text-amber-500 mx-auto mb-3" strokeWidth={1.9} />
            <p className="text-[14px] font-medium mb-1">Agenda ainda não liberada</p>
            <p className="text-[12.5px] text-neutro-500">
              Este consultório ainda não definiu quem atende pelo link. Entre em
              contato pelo telefone acima.
            </p>
          </div>
        ) : (
          <>
            {/* 1 — Profissional */}
            {consultorio.profissionais.length > 1 && (
              <Passo numero={1} titulo="Com quem você quer se consultar?" icone={UserRound}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {consultorio.profissionais.map((p: any) => {
                    const ativo = profissional?.id === p.id
                    return (
                      <button key={p.id}
                        onClick={() => { setProfissional(p); setDia(null); setEscolhido(null) }}
                        className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border transition-all duration-200 active:scale-[0.98] ${
                          ativo
                            ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/20 ring-1 ring-brand-500'
                            : 'border-neutro-200 dark:border-neutro-700 hover:border-brand-300'
                        }`}>
                        <Avatar nome={p.nome} fotoUrl={p.fotoUrl} tamanho={48} />
                        <span className="text-[12px] font-medium text-center leading-tight">
                          {p.nome}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Passo>
            )}

            {/* 2 — Dia */}
            <AnimatePresence>
              {profissional && (
                <Passo numero={consultorio.profissionais.length > 1 ? 2 : 1}
                  titulo="Escolha o dia" icone={CalendarDays}>
                  <CalendarioPublico
                    mes={mes} aoMudarMes={setMes}
                    dias={diasDoMes} selecionado={dia}
                    aoEscolher={(d) => { setDia(d); setEscolhido(null) }}
                  />
                </Passo>
              )}
            </AnimatePresence>

            {/* 3 — Horário */}
            <AnimatePresence>
              {profissional && dia && (
                <Passo numero={consultorio.profissionais.length > 1 ? 3 : 2}
                  titulo="Escolha o horário" icone={Clock}
                  legenda={`${fmtData(dia)} · ${consultorio.duracaoConsultaMin} min por consulta`}>
                  {carregandoHorarios ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {Array.from({ length: 8 }, (_, i) => <div key={i} className="esqueleto h-10" />)}
                    </div>
                  ) : livres.length === 0 ? (
                    <p className="text-[13px] text-neutro-400 text-center py-6">
                      Nenhum horário livre neste dia. Tente outra data.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {livres.map((h) => (
                        <button key={h.dataHora} onClick={() => setEscolhido(h.dataHora)}
                          className={`py-2.5 rounded-lg border text-[13px] font-medium numerico transition-all duration-150 active:scale-[0.97] ${
                            escolhido === h.dataHora
                              ? 'bg-brand-600 border-brand-600 text-white shadow-suave'
                              : 'border-neutro-200 dark:border-neutro-700 hover:border-brand-400 hover:text-brand-600'
                          }`}>
                          {hora(h.dataHora)}
                        </button>
                      ))}
                    </div>
                  )}
                </Passo>
              )}
            </AnimatePresence>

            {/* 4 — Dados */}
            <AnimatePresence>
              {escolhido && (
                <Passo numero={consultorio.profissionais.length > 1 ? 4 : 3}
                  titulo="Seus dados" icone={UserRound}>
                  <div className="space-y-3.5">
                    <div>
                      <label className="rotulo">Nome completo</label>
                      <input className="campo" value={nome} autoComplete="name"
                        onChange={(e) => setNome(e.target.value)} placeholder="Como podemos te chamar" />
                    </div>
                    <div>
                      <label className="rotulo">Telefone / WhatsApp</label>
                      <input className="campo" value={telefone} type="tel" autoComplete="tel"
                        onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                    </div>
                    {consultorio.vendedoras?.length > 0 && (
                      <div>
                        <label className="rotulo">Vendedora responsável</label>
                        <select className="campo" value={vendedora}
                          onChange={(e) => setVendedora(e.target.value)}>
                          <option value="">Sem preferência</option>
                          {consultorio.vendedoras.map((v: string) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </Passo>
              )}
            </AnimatePresence>

            {erro && (
              <div className="flex items-start gap-2.5 text-[12.5px] text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3">
                <AlertCircle size={15} className="shrink-0 mt-0.5" strokeWidth={2} /> {erro}
              </div>
            )}
          </>
        )}
      </main>

      {/* Barra de confirmação: fixa no celular, no fluxo no desktop */}
      <AnimatePresence>
        {escolhido && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-0 inset-x-0 sm:static bg-white/95 dark:bg-neutro-900/95 backdrop-blur-xl border-t sm:border-0 border-neutro-200 dark:border-neutro-800 px-5 py-3.5 sm:py-0 z-40">
            <div className="max-w-xl mx-auto flex items-center gap-3">
              <div className="min-w-0 flex-1 sm:hidden">
                <p className="text-[12px] font-medium truncate">
                  {fmtData(dia!)} às {hora(escolhido)}
                </p>
                <p className="text-[11px] text-neutro-400 truncate">{profissional?.nome}</p>
              </div>
              <button onClick={confirmar} disabled={!podeConfirmar || enviando}
                className="btn-marca flex-1 sm:w-full !py-3 disabled:opacity-50">
                {enviando ? (
                  <><Loader2 size={16} className="animate-spin" /> Confirmando…</>
                ) : (
                  <>Confirmar agendamento <ArrowRight size={16} strokeWidth={2.2} /></>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Bloco numerado de uma etapa. */
function Passo({
  numero, titulo, icone: Icone, legenda, children,
}: {
  numero: number
  titulo: string
  icone: any
  legenda?: string
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="cartao p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-6 h-6 rounded-full bg-neutro-900 dark:bg-white text-white dark:text-neutro-900 text-[11px] font-semibold numerico flex items-center justify-center shrink-0">
          {numero}
        </span>
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold leading-tight flex items-center gap-1.5">
            <Icone size={14} className="text-neutro-400" strokeWidth={2} /> {titulo}
          </h2>
          {legenda && <p className="text-[11.5px] text-neutro-400 mt-0.5">{legenda}</p>}
        </div>
      </div>
      {children}
    </motion.section>
  )
}

/** Calendário mensal público — feito para o polegar, sem informações de outros pacientes. */
function CalendarioPublico({
  mes, aoMudarMes, dias, selecionado, aoEscolher,
}: {
  mes: Date
  aoMudarMes: (d: Date) => void
  dias: { data: Date; doMes: boolean; aberto: boolean }[]
  selecionado: Date | null
  aoEscolher: (d: Date) => void
}) {
  const cabecalho = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

  return (
    <div className="space-y-3">
      {/* Navegação de mês */}
      <div className="flex items-center justify-between">
        <button onClick={() => aoMudarMes(addMonths(mes, -1))}
          className="btn-icone !w-8 !h-8">
          <ChevronLeft size={16} />
        </button>
        <p className="text-[13px] font-semibold capitalize">
          {format(mes, 'MMMM yyyy', { locale: ptBR })}
        </p>
        <button onClick={() => aoMudarMes(addMonths(mes, 1))}
          className="btn-icone !w-8 !h-8">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7">
        {cabecalho.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-neutro-400 py-1.5">
            {d}
          </div>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-1">
        {dias.map(({ data: d, doMes, aberto }) => {
          const ativo = selecionado && isSameDay(d, selecionado)
          const hoje = isToday(d)
          return (
            <button key={d.toISOString()} disabled={!aberto} onClick={() => aoEscolher(d)}
              title={aberto ? undefined : 'Fechado neste dia'}
              className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-[13px] transition-all duration-150 active:scale-[0.95] ${
                ativo
                  ? 'bg-brand-600 text-white font-semibold shadow-suave'
                  : aberto
                  ? doMes
                    ? 'hover:bg-neutro-100 dark:hover:bg-neutro-800 font-medium'
                    : 'text-neutro-400 hover:bg-neutro-100 dark:hover:bg-neutro-800'
                  : doMes
                  ? 'text-neutro-300 dark:text-neutro-700 cursor-not-allowed'
                  : 'text-neutro-200 dark:text-neutro-800 cursor-not-allowed'
              } ${hoje && !ativo ? 'text-brand-600 dark:text-brand-400 font-semibold' : ''}`}>
              <span className="numerico leading-none">{format(d, 'd')}</span>
              {/* Pontinho verde nos dias com atendimento possível */}
              {aberto && doMes && !ativo && (
                <span className="absolute bottom-[5px] w-1 h-1 rounded-full bg-brand-400/60" />
              )}
              {hoje && !ativo && (
                <span className="absolute inset-0 rounded-xl ring-1 ring-brand-400/40" />
              )}
            </button>
          )
        })}
      </div>

      {selecionado && (
        <p className="text-[11.5px] text-neutro-400 text-center pt-1">
          {format(selecionado, "EEEE, d 'de' MMMM", { locale: ptBR })} selecionado
        </p>
      )}
    </div>
  )
}

/** Tela final. É o que a pessoa mostra na recepção — precisa ser clara. */
function TelaConfirmada({ dados, consultorio }: { dados: any; consultorio: any }) {
  const quando = new Date(dados.dataHora)

  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="cartao p-8 max-w-sm w-full text-center">

        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ delay: 0.12, type: 'spring', stiffness: 220, damping: 16 }}
          className="w-16 h-16 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center mx-auto mb-5">
          <motion.span
            initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.28, type: 'spring', stiffness: 260, damping: 14 }}>
            <Check size={32} strokeWidth={2.6} />
          </motion.span>
        </motion.div>

        <h2 className="text-[18px] font-semibold tracking-apertado mb-1.5">
          Seu horário foi agendado com sucesso
        </h2>
        <p className="text-[13px] text-neutro-500 mb-6">
          {consultorio?.nome} confirmará pelo telefone informado.
        </p>

        <div className="rounded-xl bg-neutro-50 dark:bg-neutro-950/40 border border-neutro-200/70 dark:border-neutro-800 px-4 py-4 space-y-2.5 text-left">
          <Linha icone={CalendarDays} rotulo="Data" valor={fmtData(quando)} />
          <Linha icone={Clock} rotulo="Horário" valor={hora(quando)} />
          {dados.profissional && (
            <Linha icone={UserRound} rotulo="Profissional" valor={dados.profissional} />
          )}
        </div>

        <p className="text-[11.5px] text-neutro-400 mt-5">
          Chegue com alguns minutos de antecedência. Para remarcar, fale com o
          consultório pelo telefone.
        </p>
      </motion.div>
    </div>
  )
}

function Linha({ icone: Icone, rotulo, valor }: { icone: any; rotulo: string; valor: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icone size={14} className="text-neutro-400 shrink-0" strokeWidth={2} />
      <span className="text-[12px] text-neutro-500 flex-1">{rotulo}</span>
      <span className="text-[13px] font-semibold">{valor}</span>
    </div>
  )
}
