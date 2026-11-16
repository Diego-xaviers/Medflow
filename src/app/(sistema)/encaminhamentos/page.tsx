'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Send, Trash2, X, Loader2, Printer, Pencil } from 'lucide-react'
import CampoBusca, { contem } from '@/components/CampoBusca'
import { fetcher, enviar } from '@/lib/fetcher'
import { data } from '@/lib/formato'

const vazio = { titulo: 'Encaminhamento', pacienteNome: '', texto: '' }

/** Sugestões para o nome do documento; o profissional pode digitar qualquer outro. */
const TITULOS = ['Encaminhamento', 'Atestado', 'Declaração', 'Laudo', 'Relatório', 'Solicitação de exame']

/** "CBOO 12345", ou nada quando o registro não foi preenchido no Perfil. */
const registro = (p: any) =>
  [p?.conselhoProfissional, p?.registroProfissional].filter(Boolean).join(' ')

export default function EncaminhamentosPage() {
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(vazio)
  /** Id do encaminhamento aberto no lápis; nulo quando é um novo. */
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { data: encaminhamentos, isLoading, mutate } = useSWR('/api/encaminhamentos', fetcher)
  const [busca, setBusca] = useState('')
  const filtrados = encaminhamentos?.filter((e: any) =>
    contem(busca, e.titulo, e.pacienteNome, e.texto, e.profissional?.nome, data(e.dataEmissao)))
  const { data: pacientes } = useSWR('/api/pacientes', fetcher)
  // Os dados de quem assina vêm prontos do Perfil — o profissional só escreve.
  const { data: perfil } = useSWR('/api/perfil', fetcher)
  const { data: consultorio } = useSWR('/api/consultorio', fetcher)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      if (editandoId) {
        // Corrigir não é emitir de novo: fica na lista, e a impressão está
        // a um clique no ícone da impressora.
        await enviar(`/api/encaminhamentos/${editandoId}`, 'PUT', form)
        setModal(false)
        setEditandoId(null)
        setForm(vazio)
        mutate()
        return
      }
      const novo = await enviar('/api/encaminhamentos', 'POST', form)
      setModal(false)
      setForm(vazio)
      mutate()
      router.push(`/encaminhamentos/${novo.id}/imprimir`)
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este encaminhamento?')) return
    await enviar(`/api/encaminhamentos/${id}`, 'DELETE')
    mutate()
  }

  return (
    <div className="p-4 sm:p-7 max-w-[1500px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="titulo-pagina">Encaminhamentos</h1>
          <p className="subtitulo">Encaminhamentos emitidos</p>
        </div>
        <button onClick={() => { setEditandoId(null); setForm(vazio); setErro(null); setModal(true) }} className="btn-primario">
          <Plus size={16} /> Novo encaminhamento
        </button>
      </div>

      <div className="mb-5">
        <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar por paciente, texto ou data..." />
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-neutro-300" /></div>
      ) : (
        <div className="space-y-3">
          {filtrados?.length === 0 && (
            <p className="text-sm text-neutro-400 text-center py-12">
              {busca ? 'Nenhum encaminhamento encontrado.' : 'Nenhum encaminhamento emitido ainda.'}
            </p>
          )}
          {filtrados?.map((e: any) => (
            <div key={e.id} className="cartao px-5 py-4 flex items-center gap-4 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-700/20 text-brand-600 flex items-center justify-center shrink-0">
                <Send size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {e.pacienteNome}
                  <span className="ml-2 text-[10.5px] font-medium text-neutro-500 bg-neutro-100 dark:bg-neutro-800 px-1.5 py-0.5 rounded align-middle">
                    {e.titulo}
                  </span>
                </p>
                <p className="text-xs text-neutro-400 truncate">{e.texto}</p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-xs text-neutro-400">Emitido {data(e.dataEmissao)}</p>
                {e.profissional?.nome && <p className="text-[11px] text-neutro-400">{e.profissional.nome}</p>}
              </div>
              <Link href={`/encaminhamentos/${e.id}/imprimir`} target="_blank"
                title="Imprimir ou salvar em PDF"
                className="btn-icone !w-8 !h-8 hover:!text-neutro-700 dark:hover:!text-neutro-200 shrink-0">
                <Printer size={16} strokeWidth={2} />
              </Link>
              <button title="Editar documento"
                onClick={() => {
                  setEditandoId(e.id)
                  setForm({ titulo: e.titulo || vazio.titulo, pacienteNome: e.pacienteNome, texto: e.texto })
                  setErro(null)
                  setModal(true)
                }}
                className="btn-icone !w-8 !h-8 hover:!text-brand-600 hover:!bg-brand-50 dark:hover:!bg-brand-900/30 shrink-0">
                <Pencil size={15} strokeWidth={2} />
              </button>
              <button onClick={() => excluir(e.id)} title="Excluir encaminhamento"
                className="btn-icone !w-8 !h-8 hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950/40 shrink-0">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
            <motion.form onSubmit={salvar}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="cartao w-full max-w-2xl p-5 sm:p-6 space-y-4 my-auto">

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send size={18} className="text-brand-500" />
                  <h2 className="text-[16px] font-semibold">{editandoId ? 'Editar documento' : 'Novo documento'}</h2>
                </div>
                <button type="button" onClick={() => setModal(false)} className="text-neutro-400 hover:text-neutro-600"><X size={20} /></button>
              </div>

              {/* Profissional — preenchido a partir do Perfil */}
              <div className="rounded-lg bg-neutro-50 dark:bg-neutro-950/40 border border-neutro-200/70 dark:border-neutro-800 px-3.5 py-2.5">
                <p className="text-[10.5px] font-medium tracking-wide text-neutro-400 uppercase mb-1">Profissional</p>
                <p className="text-[13px] font-medium">{perfil?.nome ?? '…'}</p>
                <p className="text-[11.5px] text-neutro-500">
                  {[registro(perfil), consultorio?.nome].filter(Boolean).join(' · ')}
                </p>
                {perfil && !perfil.registroProfissional && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    Registro profissional não preenchido. <Link href="/perfil" className="underline">Informe em Perfil</Link>.
                  </p>
                )}
              </div>

              <div>
                <label className="rotulo">Nome do documento</label>
                <input className="campo" required list="titulos-documento" maxLength={80}
                  placeholder="Encaminhamento, Atestado..."
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                <datalist id="titulos-documento">
                  {TITULOS.map((t) => <option key={t} value={t} />)}
                </datalist>
              </div>

              <div>
                <label className="rotulo">Paciente</label>
                <input className="campo" required list="pacientes-encaminhamento"
                  placeholder="Nome do paciente" autoFocus
                  value={form.pacienteNome}
                  onChange={(e) => setForm({ ...form, pacienteNome: e.target.value })} />
                <datalist id="pacientes-encaminhamento">
                  {pacientes?.map((p: any) => <option key={p.id} value={p.nome} />)}
                </datalist>
              </div>

              <div>
                <label className="rotulo">Texto</label>
                <textarea className="campo min-h-[260px] leading-relaxed" required
                  placeholder={'Ao(À) Dr(a). ...\n\nEncaminho o(a) paciente para avaliação de ...'}
                  value={form.texto}
                  onChange={(e) => setForm({ ...form, texto: e.target.value })} />
              </div>

              {/* Rodapé como sai no papel: linha de assinatura e os dados abaixo */}
              <div className="flex justify-center pt-4">
                <div className="text-center w-72 border-t border-neutro-300 dark:border-neutro-700 pt-2">
                  <p className="text-[12.5px] font-semibold">{perfil?.nome}</p>
                  {registro(perfil) && <p className="text-[11.5px] text-neutro-500">{registro(perfil)}</p>}
                  <p className="text-[11px] text-neutro-400">{consultorio?.nome}</p>
                </div>
              </div>

              {erro && <p className="text-xs text-red-600">{erro}</p>}

              <div className="flex justify-end gap-3 pt-2 border-t border-neutro-100 dark:border-neutro-800">
                <button type="button" onClick={() => setModal(false)}
                  className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="btn-primario">
                  {salvando && <Loader2 size={14} className="animate-spin" />}
                  {editandoId ? 'Salvar alterações' : 'Emitir e imprimir'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
