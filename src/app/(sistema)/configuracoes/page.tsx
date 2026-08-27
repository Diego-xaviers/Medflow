'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  Building2, Clock, Link2, Check, Loader2, Lock, CalendarDays, Globe,
  Upload, Image as ImageIcon,
} from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'
import { FUSOS_BR, type Bloco } from '@/lib/agenda'
import EditorExpediente from '@/components/EditorExpediente'
import RecortadorDeImagem from '@/components/RecortadorDeImagem'

const vazio = {
  nome: '', telefone: '', endereco: '',
  duracaoConsultaMin: 30, fusoHorario: 'America/Sao_Paulo',
  blocos: [] as Bloco[],
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
        duracaoConsultaMin: consultorio.duracaoConsultaMin,
        fusoHorario: consultorio.fusoHorario ?? 'America/Sao_Paulo',
        blocos: (consultorio.blocosExpediente ?? []).map((b: any) => ({
          diaSemana: b.diaSemana, inicioMin: b.inicioMin, fimMin: b.fimMin,
        })),
      })
    }
  }, [consultorio])

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

  // Quantas vagas a semana inteira oferece, com a duração escolhida.
  const vagasPorSemana = form.blocos.reduce(
    (total, b) => total + Math.max(0, Math.floor((b.fimMin - b.inicioMin) / (form.duracaoConsultaMin || 1))),
    0
  )

  return (
    <div className="p-4 sm:p-7 max-w-[900px]">
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

            <LogoDaClinica
              logoUrl={consultorio?.logoUrl}
              podeEditar={podeEditar}
              aoTrocar={() => mutate()}
            />
          </section>

          <section className="cartao p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className="text-neutro-400" strokeWidth={2} />
              <h2 className="titulo-secao">Expediente</h2>
            </div>
            <p className="text-[12px] text-neutro-400 mb-5">
              Cada dia tem os seus horários. É aqui que o sábado até meio-dia, ou
              a parada para o almoço, entram — e é isso que o link público oferece.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="rotulo">Duração da consulta</label>
                <select className="campo" disabled={!podeEditar} value={form.duracaoConsultaMin}
                  onChange={(e) => setForm({ ...form, duracaoConsultaMin: Number(e.target.value) })}>
                  {[15, 20, 30, 40, 45, 60, 90].map((m) => (
                    <option key={m} value={m}>{m} minutos</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="rotulo flex items-center gap-1.5">
                  <Globe size={13} strokeWidth={2} /> Fuso horário
                </label>
                <select className="campo" disabled={!podeEditar} value={form.fusoHorario}
                  onChange={(e) => setForm({ ...form, fusoHorario: e.target.value })}>
                  {FUSOS_BR.map((f) => (
                    <option key={f.valor} value={f.valor}>{f.rotulo}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="rotulo flex items-center gap-1.5 mb-2">
              <CalendarDays size={13} strokeWidth={2} /> Horários por dia
            </label>
            <EditorExpediente
              blocos={form.blocos}
              somenteLeitura={!podeEditar}
              aoMudar={(blocos) => setForm({ ...form, blocos })}
            />

            <div className="mt-4 rounded-lg bg-neutro-50 dark:bg-neutro-950/40 border border-neutro-200/70 dark:border-neutro-800 px-4 py-3">
              <p className="text-[12px] text-neutro-500">
                Com esta grade, a semana oferece{' '}
                <span className="font-semibold numerico text-neutro-900 dark:text-neutro-100">
                  {vagasPorSemana}
                </span>{' '}
                horários por profissional.
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

/**
 * A logo da clínica, que sai no cabeçalho da receita impressa.
 *
 * Fica aqui e não no Perfil de propósito: a logo é do consultório, não da
 * pessoa. No Perfil, cada membro da equipe teria a sua, e a receita mudaria
 * de cara conforme quem apertasse imprimir.
 */
function LogoDaClinica({ logoUrl, podeEditar, aoTrocar }: {
  logoUrl?: string | null
  podeEditar: boolean
  aoTrocar: () => Promise<any> | void
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    // Limpa já: sem isto, escolher o mesmo arquivo duas vezes seguidas não
    // dispara o evento de novo e a tela parece travada.
    e.target.value = ''
    if (f) { setErro(null); setArquivo(f) }
  }

  async function salvar(dataUri: string) {
    setOcupado(true); setErro(null)
    try {
      await enviar('/api/consultorio/logo', 'PATCH', { logo: dataUri })
      await aoTrocar()
      setArquivo(null)
    } catch (e: any) { setErro(e.message); throw e } finally { setOcupado(false) }
  }

  async function remover() {
    if (!confirm('Remover a logo? A receita volta a sair com o símbolo padrão.')) return
    setOcupado(true); setErro(null)
    try {
      await enviar('/api/consultorio/logo', 'DELETE')
      await aoTrocar()
    } catch (e: any) { setErro(e.message) } finally { setOcupado(false) }
  }

  return (
    <div className="mt-5 pt-5 border-t border-neutro-100 dark:border-neutro-800">
      <label className="rotulo flex items-center gap-1.5">
        <ImageIcon size={13} strokeWidth={2} /> Logo da clínica
      </label>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-2">
        {/* Fundo branco na prévia porque é sobre branco que ela vai ser
            impressa — mostrar sobre o tema escuro enganaria. */}
        <div className="w-full sm:w-56 h-20 rounded-lg border border-neutro-200 dark:border-neutro-700 bg-white flex items-center justify-center overflow-hidden shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da clínica" className="max-h-16 max-w-[200px] object-contain" />
          ) : (
            <span className="text-[11.5px] text-neutro-400">Sem logo</span>
          )}
        </div>

        <div className="min-w-0">
          {podeEditar && (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => entrada.current?.click()} disabled={ocupado}
                className="btn-suave !py-2 !text-[12px]">
                {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} strokeWidth={2} />}
                {logoUrl ? 'Trocar logo' : 'Enviar logo'}
              </button>
              {logoUrl && (
                <button type="button" onClick={remover} disabled={ocupado}
                  className="text-[12px] font-medium text-neutro-400 hover:text-red-500 transition-colors disabled:opacity-50">
                  Remover
                </button>
              )}
            </div>
          )}

          <p className="text-[11px] text-neutro-400 mt-2 max-w-sm">
            Sai no cabeçalho da receita impressa. Você enquadra a imagem antes
            de salvar — PNG com fundo transparente fica melhor no papel.
          </p>
          {erro && <p className="text-[12px] text-red-600 mt-1.5">{erro}</p>}
        </div>
      </div>

      <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp"
        className="hidden" onChange={escolher} />

      <RecortadorDeImagem
        arquivo={arquivo}
        aoConfirmar={salvar}
        aoCancelar={() => setArquivo(null)}
      />
    </div>
  )
}
