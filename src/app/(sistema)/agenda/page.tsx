'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Link2, Check, Trash2, Loader2, Globe, UserRound, Phone,
  CalendarPlus, X, Clock, Stethoscope, ToggleLeft, ToggleRight, MessageCircle, Pencil,
} from 'lucide-react'
import { format, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import CalendarioMes from '@/components/CalendarioMes'
import BuscaPaciente from '@/components/BuscaPaciente'
import { fetcher, enviar } from '@/lib/fetcher'
import { hora, moeda, data as fmtData } from '@/lib/formato'
import { linkWhatsApp } from '@/lib/whatsapp'

const estiloStatus: Record<string, { etiqueta: string; barra: string; texto: string }> = {
  AGENDADA: {
    etiqueta: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
    barra: 'bg-brand-500', texto: 'Agendada',
  },
  CONCLUIDA: {
    etiqueta: 'bg-neutro-100 text-neutro-600 dark:bg-neutro-800 dark:text-neutro-400',
    barra: 'bg-neutro-300 dark:bg-neutro-600', texto: 'Concluída',
  },
  FALTA: {
    etiqueta: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    barra: 'bg-amber-400', texto: 'Falta',
  },
  CANCELADA: {
    etiqueta: 'bg-neutro-100 text-neutro-400 dark:bg-neutro-800 dark:text-neutro-500',
    barra: 'bg-neutro-200 dark:bg-neutro-700', texto: 'Cancelada',
  },
}

export default function AgendaPage() {
  return <AgendaCompleta />
}

function AgendaCompleta() {
  const { data: sessao } = useSession()
  const papel = sessao?.user?.papel
  const ehVendedora = papel === 'VENDEDORA'
  const meuId = sessao?.user?.id
  const meuNome = sessao?.user?.name ?? ''

  const [mesRef, setMesRef] = useState(() => new Date())
  const [dia, setDia] = useState(() => new Date())
  const [copiado, setCopiado] = useState(false)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any | null>(null)
  const [somenteMeus, setSomenteMeus] = useState(false)

  const chaveMes = `/api/consultas?mes=${format(mesRef, 'yyyy-MM')}`
  const { data: doMes, isLoading, mutate } = useSWR(chaveMes, fetcher, {
    refreshInterval: 20_000,
  })

  const { data: config } = useSWR('/api/consultorio', fetcher)
  const duracao = config?.duracaoConsultaMin ?? 30

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('novo')) {
      setModal(true)
      window.history.replaceState({}, '', '/agenda')
    }
  }, [])

  function ehMinha(c: any) {
    return c.criadoPor?.id === meuId || c.vendedoraResponsavel === meuNome
  }

  const doDia = (doMes ?? [])
    .filter((c: any) => isSameDay(new Date(c.dataHora), dia))
    .filter((c: any) => !somenteMeus || ehMinha(c))
    .sort((a: any, b: any) => a.dataHora.localeCompare(b.dataHora))

  async function mudarStatus(id: string, status: string) {
    await enviar(`/api/consultas/${id}`, 'PATCH', { status })
    mutate()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este agendamento?')) return
    await enviar(`/api/consultas/${id}`, 'DELETE')
    mutate()
  }

  function copiarLink() {
    navigator.clipboard.writeText(`${window.location.origin}/agendar/${sessao?.user?.consultorioSlug}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const rotuloDodia = () => {
    const hoje = new Date().toDateString()
    const selec = dia.toDateString()
    if (selec === hoje) return 'Hoje'
    if (selec === new Date(Date.now() + 864e5).toDateString()) return 'Amanhã'
    return format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })
  }

  return (
    <div className="p-4 sm:p-7 max-w-[1500px]">
      <div className="flex items-end justify-between mb-7 gap-3 flex-wrap">
        <div>
          <h1 className="titulo-pagina">Agenda</h1>
          <p className="subtitulo mt-1">
            {ehVendedora ? 'Todos os profissionais · clique num dia para ver os horários' : 'Seus atendimentos, atualizados em tempo real'}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button onClick={copiarLink} className="btn-suave">
            {copiado ? <Check size={16} className="text-brand-600" /> : <Link2 size={16} strokeWidth={2} />}
            {copiado ? 'Link copiado' : 'Link de agendamento'}
          </button>
          <button onClick={() => setModal(true)} className="btn-primario">
            <CalendarPlus size={16} strokeWidth={2.2} /> Novo agendamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-4 xl:col-span-3">
          <CalendarioMes
            mesRef={mesRef} aoMudarMes={setMesRef}
            diaSelecionado={dia} aoSelecionarDia={setDia}
            consultas={doMes ?? []}
          />

          {!ehVendedora && (
            <div className="cartao p-4 mt-5">
              <p className="rotulo-kpi mb-3">Resumo do dia</p>
              <div className="space-y-2.5">
                {[
                  ['Total', doDia.length],
                  ['Agendadas', doDia.filter((c: any) => c.status === 'AGENDADA').length],
                  ['Concluídas', doDia.filter((c: any) => c.status === 'CONCLUIDA').length],
                  ['Faltas', doDia.filter((c: any) => c.status === 'FALTA').length],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo as string} className="flex items-center justify-between">
                    <span className="text-[12px] text-neutro-500">{rotulo}</span>
                    <span className="text-[13px] font-medium numerico">{valor as number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-8 xl:col-span-9">
          {/* Título do dia + filtro "Meus agendamentos" */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-baseline gap-2">
              <h2 className={`text-[15px] font-semibold capitalize ${dia.toDateString() === new Date().toDateString() && ehVendedora ? 'text-brand-600' : ''}`}>
                {rotuloDodia()}
              </h2>
              <span className="text-[12px] text-neutro-400">
                {doDia.length} atendimento{doDia.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Filtro visível para todos, mas especialmente útil para a vendedora */}
            <div className="flex items-center gap-2">
              {[
                { rotulo: 'Todos', valor: false },
                { rotulo: 'Meus agendamentos', valor: true },
              ].map((op) => (
                <button key={op.rotulo} onClick={() => setSomenteMeus(op.valor)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all duration-200 active:scale-[0.98] ${
                    somenteMeus === op.valor
                      ? 'bg-neutro-900 dark:bg-white text-white dark:text-neutro-900 border-neutro-900 dark:border-white'
                      : 'border-neutro-200 dark:border-neutro-700 text-neutro-500'
                  }`}>
                  {op.rotulo}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <div key={i} className="esqueleto h-[74px]" />)}
            </div>
          ) : (
            <div className="space-y-2.5">
              <AnimatePresence mode="popLayout">
                {doDia.length === 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="cartao py-16 flex flex-col items-center">
                    <div className="w-11 h-11 rounded-full bg-neutro-100 dark:bg-neutro-800 flex items-center justify-center mb-3">
                      <Clock size={19} className="text-neutro-400" strokeWidth={1.8} />
                    </div>
                    <p className="text-[13px] font-medium">
                      {somenteMeus ? 'Nenhum agendamento seu neste dia' : 'Nenhum atendimento neste dia'}
                    </p>
                    <p className="text-[12px] text-neutro-400 mt-0.5">
                      {somenteMeus
                        ? 'Agendamentos que você criou aparecem aqui.'
                        : 'Compartilhe seu link para receber agendamentos'}
                    </p>
                  </motion.div>
                )}

                {doDia.map((c: any) => {
                  const estilo = estiloStatus[c.status]
                  const consultaMinha = ehMinha(c)
                  const telefone = c.telefoneContato ?? c.paciente?.telefone
                  const whats = linkWhatsApp(
                    telefone,
                    `Olá, ${c.paciente?.nome}! Confirmando seu atendimento de ${fmtData(c.dataHora)} às ${hora(c.dataHora)}.`
                  )
                  return (
                    <motion.div key={c.id} layout
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -14, transition: { duration: 0.18 } }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className={`cartao-interativo overflow-hidden flex items-stretch group ${consultaMinha && ehVendedora ? 'border-brand-300 dark:border-brand-800' : ''}`}>

                      <div className={`w-1 shrink-0 ${estilo.barra}`} />

                      <div className="flex items-center gap-3 sm:gap-5 px-4 sm:px-5 py-3.5 sm:py-4 flex-1 min-w-0">
                        <div className="text-center shrink-0 w-14 sm:w-16">
                          <p className="text-[16px] sm:text-[17px] font-semibold numerico tracking-apertado leading-none">
                            {hora(c.dataHora)}
                          </p>
                          <p className="text-[10px] text-neutro-400 mt-1">{duracao} min</p>
                        </div>

                        <div className="w-px self-stretch bg-neutro-100 dark:bg-neutro-800" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[14px] font-medium truncate">{c.paciente.nome}</p>
                            {c.origemPublica && (
                              <span title="Agendado pelo link público"
                                className="flex items-center gap-1 text-[10px] font-medium text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded">
                                <Globe size={10} strokeWidth={2.2} /> Online
                              </span>
                            )}
                            {consultaMinha && ehVendedora && (
                              <span className="text-[10px] font-medium text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded">
                                Seu cliente
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {telefone && (
                              <span className="flex items-center gap-1 text-[11px] text-neutro-400">
                                <Phone size={10} strokeWidth={2} /> {telefone}
                              </span>
                            )}
                            {c.profissional && (
                              <span className="flex items-center gap-1 text-[11px] text-neutro-400"
                                title="Profissional que atende">
                                <Stethoscope size={10} strokeWidth={2} /> {c.profissional.nome}
                              </span>
                            )}
                            {/* Quem agendou — visível sempre, especialmente útil no celular */}
                            {c.criadoPor && (
                              <span className="flex items-center gap-1 text-[11px] text-neutro-400"
                                title="Agendado por">
                                <UserRound size={10} strokeWidth={2} /> {c.criadoPor.nome}
                              </span>
                            )}
                            {!c.criadoPor && c.vendedoraResponsavel && (
                              <span className="flex items-center gap-1 text-[11px] text-neutro-400"
                                title="Vendedora responsável">
                                <UserRound size={10} strokeWidth={2} /> {c.vendedoraResponsavel}
                              </span>
                            )}
                          </div>
                        </div>

                        {c.valor && (
                          <p className="text-[13px] font-medium numerico shrink-0 hidden sm:block">
                            {moeda(Number(c.valor))}
                          </p>
                        )}

                        <span className={`etiqueta shrink-0 hidden sm:flex ${estilo.etiqueta}`}>{estilo.texto}</span>

                        {/* Ações: VENDEDORA só vê botões nos próprios agendamentos */}
                        {ehVendedora ? (
                          consultaMinha ? (
                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <button onClick={() => setEditando(c)} title="Editar agendamento"
                                className="btn-icone !w-8 !h-8 hover:!text-brand-600 hover:!bg-brand-50 dark:hover:!bg-brand-900/30">
                                <Pencil size={14} strokeWidth={2} />
                              </button>
                              <button onClick={() => excluir(c.id)} title="Excluir"
                                className="btn-icone !w-8 !h-8 hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950/40">
                                <Trash2 size={15} strokeWidth={2} />
                              </button>
                            </div>
                          ) : (
                            /* Contato rápido para agendamentos de outros */
                            <div className="flex items-center gap-1 shrink-0">
                              {telefone && (
                                <a href={`tel:${telefone.replace(/\D/g, '')}`} title={`Ligar para ${telefone}`}
                                  className="btn-icone !w-8 !h-8">
                                  <Phone size={14} strokeWidth={2} />
                                </a>
                              )}
                              {whats && (
                                <a href={whats} target="_blank" rel="noreferrer" title="Falar no WhatsApp"
                                  className="btn-icone !w-8 !h-8 hover:!text-brand-600 hover:!bg-brand-50 dark:hover:!bg-brand-900/30">
                                  <MessageCircle size={14} strokeWidth={2} />
                                </a>
                              )}
                            </div>
                          )
                        ) : (
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {c.status === 'AGENDADA' && (
                              <>
                                <button onClick={() => mudarStatus(c.id, 'CONCLUIDA')} title="Concluir"
                                  className="btn-icone !w-8 !h-8 hover:!text-brand-600 hover:!bg-brand-50 dark:hover:!bg-brand-900/30">
                                  <Check size={15} strokeWidth={2.2} />
                                </button>
                                <button onClick={() => mudarStatus(c.id, 'FALTA')} title="Marcar falta"
                                  className="btn-icone !w-8 !h-8 hover:!text-amber-600 hover:!bg-amber-50 dark:hover:!bg-amber-950/40">
                                  <X size={15} strokeWidth={2.2} />
                                </button>
                              </>
                            )}
                            <button onClick={() => excluir(c.id)} title="Excluir"
                              className="btn-icone !w-8 !h-8 hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950/40">
                              <Trash2 size={15} strokeWidth={2} />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <ModalNovoAgendamento aberto={modal} aoFechar={() => setModal(false)}
        diaPadrao={dia} duracao={duracao} horaAbertura={config?.horaAbertura ?? 8}
        aoSalvar={() => { setModal(false); mutate() }} />

      <ModalEditarAgendamento consulta={editando} aoFechar={() => setEditando(null)}
        aoSalvar={() => { setEditando(null); mutate() }} />
    </div>
  )
}

function ModalNovoAgendamento({ aberto, aoFechar, diaPadrao, duracao, horaAbertura, aoSalvar }: any) {
  const { data: pacientes } = useSWR(aberto ? '/api/pacientes' : null, fetcher)
  const { data: profissionais } = useSWR(aberto ? '/api/profissionais' : null, fetcher)
  const horarioInicial = `${String(horaAbertura ?? 9).padStart(2, '0')}:00`
  const [avulso, setAvulso] = useState(false)
  const [form, setForm] = useState<any>({
    pacienteId: '', nomeAvulso: '', telefoneAvulso: '',
    profissionalId: '', horario: horarioInicial, valor: '', observacoes: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (profissionais?.length === 1 && !form.profissionalId) {
      setForm((f: any) => ({ ...f, profissionalId: profissionais[0].id }))
    }
  }, [profissionais, form.profissionalId])

  useEffect(() => {
    if (aberto) {
      setAvulso(false)
      setForm({ pacienteId: '', nomeAvulso: '', telefoneAvulso: '', profissionalId: '', horario: horarioInicial, valor: '', observacoes: '' })
      setErro(null)
    }
  }, [aberto, horarioInicial])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null)
    try {
      const dataHora = new Date(diaPadrao)
      const [h, m] = form.horario.split(':')
      dataHora.setHours(Number(h), Number(m), 0, 0)

      let pacienteId = form.pacienteId

      if (avulso) {
        if (!form.nomeAvulso.trim()) { setErro('Informe o nome do paciente'); setSalvando(false); return }
        const novoPaciente = await enviar('/api/pacientes', 'POST', {
          nome: form.nomeAvulso.trim(),
          telefone: form.telefoneAvulso.trim() || undefined,
          cadastroRapido: true,
        })
        pacienteId = novoPaciente.id
      } else {
        if (!pacienteId) { setErro('Selecione o paciente'); setSalvando(false); return }
      }

      await enviar('/api/consultas', 'POST', {
        pacienteId,
        profissionalId: form.profissionalId,
        dataHora: dataHora.toISOString(),
        valor: form.valor ? Number(form.valor) : null,
        observacoes: form.observacoes,
      })

      aoSalvar()
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <motion.form onSubmit={salvar}
            initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="cartao shadow-alta w-full max-w-md p-5 sm:p-6 space-y-4">

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold">Novo agendamento</h2>
                <p className="text-[12px] text-neutro-400 mt-0.5 capitalize">
                  {format(diaPadrao, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
              <button type="button" onClick={aoFechar} className="btn-icone !w-8 !h-8"><X size={17} /></button>
            </div>

            <button type="button"
              onClick={() => { setAvulso(!avulso); setForm((f: any) => ({ ...f, pacienteId: '', nomeAvulso: '', telefoneAvulso: '' })) }}
              className="flex items-center gap-2 text-[12px] text-neutro-500 hover:text-neutro-700 dark:hover:text-neutro-300 transition-colors">
              {avulso
                ? <ToggleRight size={18} className="text-brand-500" strokeWidth={2} />
                : <ToggleLeft size={18} strokeWidth={2} />}
              Paciente sem cadastro
            </button>

            {avulso ? (
              <div className="space-y-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  O cadastro completo deverá ser preenchido antes do atendimento.
                </p>
                <div>
                  <label className="rotulo">Nome do paciente</label>
                  <input className="campo" required={avulso} placeholder="Nome completo"
                    value={form.nomeAvulso}
                    onChange={e => setForm({ ...form, nomeAvulso: e.target.value })} />
                </div>
                <div>
                  <label className="rotulo">Telefone (opcional)</label>
                  <input className="campo" placeholder="(00) 00000-0000"
                    value={form.telefoneAvulso}
                    onChange={e => setForm({ ...form, telefoneAvulso: e.target.value })} />
                </div>
              </div>
            ) : (
              <div>
                <label className="rotulo">Paciente</label>
                <BuscaPaciente
                  pacientes={pacientes ?? []}
                  valor={form.pacienteId}
                  aoMudar={(id) => setForm({ ...form, pacienteId: id })}
                />
              </div>
            )}

            <div>
              <label className="rotulo">Profissional</label>
              <select className="campo" required value={form.profissionalId}
                onChange={(e) => setForm({ ...form, profissionalId: e.target.value })}>
                <option value="">Quem vai atender</option>
                {profissionais?.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              {profissionais?.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1.5">
                  Ninguém está marcado como profissional. Ajuste isso em Equipe.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="rotulo">Horário</label>
                <input type="time" step={(duracao ?? 30) * 60} className="campo" required value={form.horario}
                  onChange={(e) => setForm({ ...form, horario: e.target.value })} />
              </div>
              <div>
                <label className="rotulo">Valor (opcional)</label>
                <input type="number" step="0.01" className="campo" placeholder="0,00" value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="rotulo">Observações</label>
              <textarea rows={2} className="campo resize-none" value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>

            {erro && <p className="text-[12px] text-red-600">{erro}</p>}

            <div className="flex justify-end gap-2.5 pt-1">
              <button type="button" onClick={aoFechar} className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">
                Cancelar
              </button>
              <button type="submit" disabled={salvando} className="btn-primario">
                {salvando && <Loader2 size={14} className="animate-spin" />} Agendar
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ModalEditarAgendamento({ consulta, aoFechar, aoSalvar }: { consulta: any; aoFechar: () => void; aoSalvar: () => void }) {
  const { data: pacientes } = useSWR(consulta ? '/api/pacientes' : null, fetcher)
  const { data: profissionais } = useSWR(consulta ? '/api/profissionais' : null, fetcher)
  const [form, setForm] = useState<any>({
    pacienteId: '', profissionalId: '', data: '', horario: '', valor: '', observacoes: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (consulta) {
      const dt = new Date(consulta.dataHora)
      setForm({
        pacienteId: consulta.pacienteId ?? '',
        profissionalId: consulta.profissionalId ?? '',
        data: format(dt, 'yyyy-MM-dd'),
        horario: format(dt, 'HH:mm'),
        valor: consulta.valor ? String(Number(consulta.valor)) : '',
        observacoes: consulta.observacoes ?? '',
      })
      setErro(null)
    }
  }, [consulta])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null)
    try {
      const dataHora = new Date(`${form.data}T${form.horario}:00`)
      await enviar(`/api/consultas/${consulta.id}`, 'PATCH', {
        dataHora: dataHora.toISOString(),
        pacienteId: form.pacienteId,
        profissionalId: form.profissionalId,
        valor: form.valor ? Number(form.valor) : null,
        observacoes: form.observacoes || null,
      })
      aoSalvar()
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  return (
    <AnimatePresence>
      {consulta && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <motion.form onSubmit={salvar}
            initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="cartao shadow-alta w-full max-w-md p-5 sm:p-6 space-y-4">

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold">Editar agendamento</h2>
                <p className="text-[12px] text-neutro-400 mt-0.5">{consulta?.paciente?.nome}</p>
              </div>
              <button type="button" onClick={aoFechar} className="btn-icone !w-8 !h-8"><X size={17} /></button>
            </div>

            <div>
              <label className="rotulo">Paciente</label>
              <BuscaPaciente
                pacientes={pacientes ?? []}
                valor={form.pacienteId}
                aoMudar={(id) => setForm({ ...form, pacienteId: id })}
              />
            </div>

            <div>
              <label className="rotulo">Profissional</label>
              <select className="campo" required value={form.profissionalId}
                onChange={(e) => setForm({ ...form, profissionalId: e.target.value })}>
                <option value="">Quem vai atender</option>
                {profissionais?.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="rotulo">Data</label>
                <input type="date" className="campo" required value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })} />
              </div>
              <div>
                <label className="rotulo">Horário</label>
                <input type="time" className="campo" required value={form.horario}
                  onChange={(e) => setForm({ ...form, horario: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="rotulo">Valor (opcional)</label>
                <input type="number" step="0.01" className="campo" placeholder="0,00" value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div>
                <label className="rotulo">Observações</label>
                <input className="campo" value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
            </div>

            {erro && <p className="text-[12px] text-red-600">{erro}</p>}

            <div className="flex justify-end gap-2.5 pt-1">
              <button type="button" onClick={aoFechar} className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">
                Cancelar
              </button>
              <button type="submit" disabled={salvando} className="btn-primario">
                {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
