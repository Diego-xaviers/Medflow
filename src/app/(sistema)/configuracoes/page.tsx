'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  Building2, Clock, Link2, Check, Loader2, Lock, CalendarDays, Globe,
} from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'
import { FUSOS_BR } from '@/lib/agenda'

const DIAS = [
  { valor: 1, curto: 'Seg' }, { valor: 2, curto: 'Ter' }, { valor: 3, curto: 'Qua' },
  { valor: 4, curto: 'Qui' }, { valor: 5, curto: 'Sex' }, { valor: 6, curto: 'Sáb' },
  { valor: 0, curto: 'Dom' },
]

const vazio = {
  nome: '', telefone: '', endereco: '',
  horaAbertura: 8, horaFechamento: 18, duracaoConsultaMin: 30, fusoHorario: 'America/Sao_Paulo',
  diasAtendimento: [1, 2, 3, 4, 5] as number[],
}

export default function ConfiguracoesPage() {
  const { data: sessao, update } = useSession()
  const podeEditar = sessao?.user?.papel === 'DONO'

  const { data: consultorio, isLoading, mutate } = useSWR('/api/consultorio', fetcher)

  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    if (consultorio) {
      setForm({
        nome: consultorio.nome ?? '',
        telefone: consultorio.telefone ?? '',
        endereco: consultorio.endereco ?? '',
        horaAbertura: consultorio.horaAbertura,
        horaFechamento: consultorio.horaFechamento,
        duracaoConsultaMin: consultorio.duracaoConsultaMin,
        fusoHorario: consultorio.fusoHorario ?? 'America/Sao_Paulo',
        diasAtendimento: consultorio.diasAtendimento ?? [],
      })
    }
  }, [consultorio])

  function alternarDia(valor: number) {
    if (!podeEditar) return
    setForm((f) => ({
      ...f,
      diasAtendimento: f.diasAtendimento.includes(valor)
        ? f.diasAtendimento.filter((d) => d !== valor)
        : [...f.diasAtendimento, valor],
    }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null); setPronto(false)
    try {
      await enviar('/api/consultorio', 'PATCH', form)
      await mutate()
      // O nome do consultório aparece na barra lateral, que lê da sessão.
      await update()
      setPronto(true)
      setTimeout(() => setPronto(false), 2500)
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  // Quantos atendimentos cabem num dia, com a janela e a duração escolhidas.
  const vagasPorDia = Math.max(
    0,
    Math.floor(((form.horaFechamento - form.horaAbertura) * 60) / (form.duracaoConsultaMin || 1))
  )

  return (
    <div className="p-7 max-w-[900px]">
      <div className="mb-7">
        <h1 className="titulo-pagina">Configurações</h1>
        <p className="subtitulo mt-1">Dados do consultório e regras da agenda</p>
      </div>

      {isLoading ? (
        <div className="space-y-5">
          <div className="esqueleto h-[200px]" />
          <div className="esqueleto h-[260px]" />
        </div>
      ) : (
        <form onSubmit={salvar} className="space-y-5">
          {!podeEditar && (
            <div className="cartao px-5 py-3.5 flex items-center gap-2.5 text-[12px] text-neutro-500">
              <Lock size={14} className="text-neutro-400 shrink-0" strokeWidth={2} />
              Só o dono do consultório altera estas configurações. Você está vendo em modo leitura.
            </div>
          )}

          <LinkPublico slug={consultorio?.slug} />

          <section className="cartao p-6">
            <div className="flex items-center gap-2 mb-5">
              <Building2 size={16} className="text-neutro-400" strokeWidth={2} />
              <h2 className="titulo-secao">Dados do consultório</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="rotulo">Nome</label>
                <input className="campo" required minLength={2} disabled={!podeEditar}
                  value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <label className="rotulo">Telefone</label>
                <input className="campo" disabled={!podeEditar} placeholder="(00) 00000-0000"
                  value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
              <div>
                <label className="rotulo">Endereço</label>
                <input className="campo" disabled={!podeEditar} placeholder="Rua, número — bairro"
                  value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
              </div>
            </div>

            <p className="text-[11px] text-neutro-400 mt-3">
              Nome, telefone e endereço aparecem na página pública de agendamento.
            </p>
          </section>

          <section className="cartao p-6">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className="text-neutro-400" strokeWidth={2} />
              <h2 className="titulo-secao">Expediente</h2>
            </div>
            <p className="text-[12px] text-neutro-400 mb-5">
              Define os horários que o link público oferece ao paciente.
            </p>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="rotulo">Abre às</label>
                <select className="campo" disabled={!podeEditar} value={form.horaAbertura}
                  onChange={(e) => setForm({ ...form, horaAbertura: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="rotulo">Fecha às</label>
                <select className="campo" disabled={!podeEditar} value={form.horaFechamento}
                  onChange={(e) => setForm({ ...form, horaFechamento: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="rotulo">Duração da consulta</label>
                <select className="campo" disabled={!podeEditar} value={form.duracaoConsultaMin}
                  onChange={(e) => setForm({ ...form, duracaoConsultaMin: Number(e.target.value) })}>
                  {[15, 20, 30, 40, 45, 60, 90].map((m) => (
                    <option key={m} value={m}>{m} minutos</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="rotulo flex items-center gap-1.5">
                <Globe size={13} strokeWidth={2} /> Fuso horário da clínica
              </label>
              <select className="campo" disabled={!podeEditar} value={form.fusoHorario}
                onChange={(e) => setForm({ ...form, fusoHorario: e.target.value })}>
                {FUSOS_BR.map((f) => (
                  <option key={f.valor} value={f.valor}>{f.rotulo}</option>
                ))}
              </select>
              <p className="text-[11px] text-neutro-400 mt-1.5">
                É o que faz &quot;abre às 8h&quot; significar 8h aqui. O servidor roda em
                UTC, então sem isto o horário sairia deslocado no link público.
              </p>
            </div>

            <div className="mt-5">
              <label className="rotulo flex items-center gap-1.5">
                <CalendarDays size={13} strokeWidth={2} /> Dias de atendimento
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DIAS.map((d) => {
                  const ativo = form.diasAtendimento.includes(d.valor)
                  return (
                    <button key={d.valor} type="button" onClick={() => alternarDia(d.valor)}
                      disabled={!podeEditar}
                      className={`px-3.5 py-2 rounded-lg text-[12px] font-medium border transition-all duration-200 active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none ${
                        ativo
                          ? 'bg-neutro-900 dark:bg-white text-white dark:text-neutro-900 border-neutro-900 dark:border-white'
                          : 'border-neutro-200 dark:border-neutro-700 text-neutro-500 hover:border-neutro-300 dark:hover:border-neutro-600'
                      }`}>
                      {d.curto}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-neutro-50 dark:bg-neutro-950/40 border border-neutro-200/70 dark:border-neutro-800 px-4 py-3">
              <p className="text-[12px] text-neutro-500">
                Nessa configuração, cada dia aberto oferece{' '}
                <span className="font-medium numerico text-neutro-900 dark:text-neutro-100">
                  {vagasPorDia}
                </span>{' '}
                horários — {form.diasAtendimento.length} dia
                {form.diasAtendimento.length === 1 ? '' : 's'} por semana.
              </p>
            </div>
          </section>

          {erro && <p className="text-[12px] text-red-600">{erro}</p>}

          {podeEditar && (
            <div className="flex items-center justify-end gap-3">
              {pronto && (
                <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-1.5 text-[12px] text-brand-600">
                  <Check size={14} strokeWidth={2.4} /> Configurações salvas
                </motion.span>
              )}
              <button type="submit" disabled={salvando} className="btn-primario">
                {salvando && <Loader2 size={14} className="animate-spin" />} Salvar configurações
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  )
}

/** O link que o consultório divulga para receber agendamentos. */
function LinkPublico({ slug }: { slug?: string }) {
  const [copiado, setCopiado] = useState(false)
  const [url, setUrl] = useState('')

  // A origem só existe no navegador — montar antes disso quebraria a hidratação.
  useEffect(() => {
    if (slug) setUrl(`${window.location.origin}/agendar/${slug}`)
  }, [slug])

  function copiar() {
    navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <section className="cartao p-6">
      <div className="flex items-center gap-2 mb-1">
        <Link2 size={16} className="text-neutro-400" strokeWidth={2} />
        <h2 className="titulo-secao">Link público de agendamento</h2>
      </div>
      <p className="text-[12px] text-neutro-400 mb-4">
        Mande no WhatsApp ou coloque na bio do Instagram. Quem abrir escolhe um
        horário livre sem precisar de login.
      </p>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <input readOnly value={url} className="campo !mt-0 font-mono text-[12px]" />
        <button type="button" onClick={copiar} className="btn-suave shrink-0">
          {copiado ? <Check size={15} className="text-brand-600" /> : <Link2 size={15} />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
        <a href={url || '#'} target="_blank" rel="noreferrer" className="btn-suave shrink-0">
          Abrir
        </a>
      </div>
    </section>
  )
}
