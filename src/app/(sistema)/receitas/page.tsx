'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Receipt, Trash2, X, Loader2, Glasses, FileText, Wand2, Link2,
} from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'
import { data } from '@/lib/formato'
import { herdarDoProntuario, resumoRefracao } from '@/lib/prescricao'

/** Validade padrão: 1 ano a partir de hoje, que é a prática usual. */
function daquiUmAno() {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

const vazio: any = {
  pacienteId: '', prontuarioId: '', validadeAte: daquiUmAno(),
  longeEsfericoOD: '', longeCilindricoOD: '', longeEixoOD: '',
  longeEsfericoOE: '', longeCilindricoOE: '', longeEixoOE: '',
  adicaoOD: '', adicaoOE: '',
  dpLongeOD: '', dpLongeOE: '', dpPerto: '', alturaOD: '', alturaOE: '',
  prismaOD: '', baseprismaOD: '', prismaOE: '', baseprismaOE: '',
  tipoLente: 'MONOFOCAL', materialLente: '', tratamentos: '', orientacoesUso: '',
}

const tiposLente = [
  ['MONOFOCAL', 'Monofocal'],
  ['BIFOCAL', 'Bifocal'],
  ['MULTIFOCAL', 'Multifocal'],
  ['OCUPACIONAL', 'Ocupacional'],
  ['CONTATO', 'Lente de contato'],
]

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold tracking-wider text-brand-600 dark:text-brand-400 pt-2">{titulo}</p>
      {children}
    </div>
  )
}

function ParOlhos({ rotulo, campoOD, campoOE, form, setForm, placeholder, herdados = [] }: any) {
  /** Campo que veio do exame ganha borda de marca até alguém mexer nele. */
  const classe = (campo: string) =>
    `campo !mt-0 ${herdados.includes(campo) ? '!border-brand-400 bg-brand-50/40 dark:bg-brand-900/10' : ''}`

  return (
    <div>
      <label className="rotulo">{rotulo}</label>
      <div className="grid grid-cols-2 gap-3 mt-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-neutro-400 w-6">OD</span>
          <input className={classe(campoOD)} placeholder={placeholder}
            value={form[campoOD]} onChange={(e) => setForm({ ...form, [campoOD]: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-neutro-400 w-6">OE</span>
          <input className={classe(campoOE)} placeholder={placeholder}
            value={form[campoOE]} onChange={(e) => setForm({ ...form, [campoOE]: e.target.value })} />
        </div>
      </div>
    </div>
  )
}

export default function ReceitasPage() {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(vazio)
  const [herdados, setHerdados] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { data: receitas, isLoading, mutate } = useSWR('/api/receitas', fetcher)
  const { data: pacientes } = useSWR('/api/pacientes', fetcher)

  // Puxa os prontuários do paciente escolhido, pra amarrar a receita ao exame
  const { data: prontuarios } = useSWR(
    form.pacienteId ? `/api/prontuarios?pacienteId=${form.pacienteId}` : null,
    fetcher
  )

  const prontuarioAtual = prontuarios?.find((p: any) => p.id === form.prontuarioId)

  // Vindo de "Emitir receita" na tela de Prontuários: já abre o formulário
  // com o paciente e o exame escolhidos.
  useEffect(() => {
    const busca = new URLSearchParams(window.location.search)
    const paciente = busca.get('paciente')
    const prontuario = busca.get('prontuario')
    if (!paciente) return

    setForm({ ...vazio, pacienteId: paciente, prontuarioId: prontuario ?? '' })
    setModal(true)
    window.history.replaceState({}, '', '/receitas')
  }, [])

  /**
   * Traz o grau do exame para a receita. Por padrão só preenche o que está
   * vazio; o botão "Copiar do exame" chama com sobrescrever para quem quiser
   * descartar os ajustes e recomeçar do que foi medido.
   */
  function aplicarProntuario(prontuario: any, sobrescrever = false) {
    if (!prontuario) return
    const { valores, herdados: campos } = herdarDoProntuario(prontuario, form, { sobrescrever })
    if (campos.length === 0) return
    setForm((f: any) => ({ ...f, ...valores }))
    setHerdados((atuais) => Array.from(new Set([...atuais, ...campos])))
  }

  // Assim que o prontuário vinculado é conhecido, o grau encontrado entra
  // como ponto de partida da prescrição.
  useEffect(() => {
    if (prontuarioAtual) aplicarProntuario(prontuarioAtual)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prontuarioAtual?.id])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      await enviar('/api/receitas', 'POST', { ...form, prontuarioId: form.prontuarioId || null })
      setModal(false)
      setForm(vazio); setHerdados([])
      mutate()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta receita?')) return
    await enviar(`/api/receitas/${id}`, 'DELETE')
    mutate()
  }

  const campo = (nome: string, rotulo: string, placeholder = '') => (
    <div>
      <label className="rotulo">{rotulo}</label>
      <input className="campo" placeholder={placeholder}
        value={form[nome]} onChange={(e) => setForm({ ...form, [nome]: e.target.value })} />
    </div>
  )

  const vencida = (iso: string) => new Date(iso) < new Date()

  return (
    <div className="p-7 max-w-[1500px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="titulo-pagina">Receitas</h1>
          <p className="subtitulo">Prescrições emitidas</p>
        </div>
        <button onClick={() => { setForm(vazio); setHerdados([]); setModal(true) }}
          className="btn-primario">
          <Plus size={16} /> Nova receita
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-neutro-300" /></div>
      ) : (
        <div className="space-y-3">
          {receitas?.length === 0 && (
            <p className="text-sm text-neutro-400 text-center py-12">Nenhuma receita emitida ainda.</p>
          )}
          {receitas?.map((r: any) => (
            <div key={r.id} className="cartao px-5 py-4 flex items-center gap-4 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-700/20 text-brand-600 flex items-center justify-center shrink-0">
                <Receipt size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.paciente.nome}</p>
                <p className="text-xs text-neutro-400">
                  {tiposLente.find(([v]) => v === r.tipoLente)?.[1]}
                  {r.materialLente && ` · ${r.materialLente}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-neutro-400">Emitida {data(r.dataEmissao)}</p>
                <p className={`text-[11px] font-medium ${vencida(r.validadeAte) ? 'text-amber-600' : 'text-neutro-400'}`}>
                  {vencida(r.validadeAte) ? 'Vencida' : `Válida até ${data(r.validadeAte)}`}
                </p>
              </div>
              <button onClick={() => excluir(r.id)}
                className="btn-icone !w-8 !h-8 hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950/40">
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
              className="cartao w-full max-w-2xl p-6 space-y-4 my-auto">

              <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-neutro-900 pb-2">
                <div className="flex items-center gap-2">
                  <Glasses size={18} className="text-brand-500" />
                  <h2 className="text-[16px] font-semibold">Nova receita</h2>
                </div>
                <button type="button" onClick={() => setModal(false)} className="text-neutro-400 hover:text-neutro-600"><X size={20} /></button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="rotulo">Paciente</label>
                  <select className="campo" required value={form.pacienteId}
                    onChange={(e) => { setForm({ ...form, pacienteId: e.target.value, prontuarioId: '' }); setHerdados([]) }}>
                    <option value="">Selecione</option>
                    {pacientes?.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="rotulo">Válida até</label>
                  <input type="date" className="campo" required value={form.validadeAte}
                    onChange={(e) => setForm({ ...form, validadeAte: e.target.value })} />
                </div>
              </div>

              {form.pacienteId && (
                <div>
                  <label className="rotulo flex items-center gap-1.5">
                    <FileText size={13} strokeWidth={2} /> Exame de origem
                  </label>
                  {prontuarios?.length > 0 ? (
                    <select className="campo" value={form.prontuarioId}
                      onChange={(e) => setForm({ ...form, prontuarioId: e.target.value })}>
                      <option value="">Não vincular a nenhum exame</option>
                      {prontuarios.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          Exame de {data(p.dataExame)} — {resumoRefracao(p)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[12px] text-neutro-400 mt-1.5">
                      Este paciente ainda não tem prontuário. Registre o exame antes
                      para não precisar digitar o grau duas vezes.
                    </p>
                  )}
                </div>
              )}

              {/* O que foi medido no exame, à vista enquanto se prescreve.
                  Prescrever é ajustar este número — não redigitá-lo. */}
              {prontuarioAtual && (
                <div className="rounded-lg border border-brand-200 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-900/10 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-brand-700 dark:text-brand-400 flex items-center gap-1.5">
                        <Link2 size={12} strokeWidth={2.2} />
                        Vinculada ao exame de {data(prontuarioAtual.dataExame)}
                      </p>
                      <p className="text-[11.5px] text-neutro-500 mt-1">
                        Refração encontrada: {resumoRefracao(prontuarioAtual)}
                      </p>
                      {prontuarioAtual.diagnostico && (
                        <p className="text-[11.5px] text-neutro-500 mt-0.5 truncate">
                          Diagnóstico: {prontuarioAtual.diagnostico}
                        </p>
                      )}
                    </div>
                    <button type="button" onClick={() => aplicarProntuario(prontuarioAtual, true)}
                      title="Descarta os ajustes e volta ao grau medido no exame"
                      className="btn-suave !py-1.5 !px-2.5 !text-[11.5px] shrink-0">
                      <Wand2 size={13} strokeWidth={2} /> Copiar do exame
                    </button>
                  </div>
                </div>
              )}

              <Secao titulo="GRAU PARA LONGE">
                {herdados.length > 0 && (
                  <p className="text-[11px] text-neutro-400 -mt-1">
                    Os campos destacados vieram do exame. Ajuste à vontade — o
                    prontuário não muda.
                  </p>
                )}
                <ParOlhos rotulo="Esférico" campoOD="longeEsfericoOD" campoOE="longeEsfericoOE"
                  form={form} setForm={setForm} placeholder="-1.75" herdados={herdados} />
                <ParOlhos rotulo="Cilíndrico" campoOD="longeCilindricoOD" campoOE="longeCilindricoOE"
                  form={form} setForm={setForm} placeholder="-0.50" herdados={herdados} />
                <ParOlhos rotulo="Eixo" campoOD="longeEixoOD" campoOE="longeEixoOE"
                  form={form} setForm={setForm} placeholder="180" herdados={herdados} />
              </Secao>

              <Secao titulo="ADIÇÃO (PRESBIOPIA)">
                <ParOlhos rotulo="Adição" campoOD="adicaoOD" campoOE="adicaoOE"
                  form={form} setForm={setForm} placeholder="+2.00" />
              </Secao>

              <Secao titulo="MEDIDAS DE MONTAGEM">
                <ParOlhos rotulo="DP para longe (mm)" campoOD="dpLongeOD" campoOE="dpLongeOE"
                  form={form} setForm={setForm} placeholder="32" />
                <ParOlhos rotulo="Altura (mm)" campoOD="alturaOD" campoOE="alturaOE"
                  form={form} setForm={setForm} placeholder="22" />
                <div className="w-1/2">{campo('dpPerto', 'DP para perto (mm)', '60')}</div>
              </Secao>

              <Secao titulo="PRISMA (SE INDICADO)">
                <ParOlhos rotulo="Prisma" campoOD="prismaOD" campoOE="prismaOE"
                  form={form} setForm={setForm} placeholder="2Δ" />
                <ParOlhos rotulo="Base" campoOD="baseprismaOD" campoOE="baseprismaOE"
                  form={form} setForm={setForm} placeholder="Nasal" />
              </Secao>

              <Secao titulo="INDICAÇÃO DA LENTE">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="rotulo">Tipo de lente</label>
                    <select className="campo" value={form.tipoLente}
                      onChange={(e) => setForm({ ...form, tipoLente: e.target.value })}>
                      {tiposLente.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  {campo('materialLente', 'Material', 'Policarbonato, resina...')}
                </div>
                {campo('tratamentos', 'Tratamentos', 'Antirreflexo, filtro azul, fotossensível...')}
                {campo('orientacoesUso', 'Orientações de uso', 'Uso contínuo, só para leitura...')}
              </Secao>

              {erro && <p className="text-xs text-red-600">{erro}</p>}

              <div className="flex justify-end gap-3 pt-2 border-t border-neutro-100 dark:border-neutro-800">
                <button type="button" onClick={() => setModal(false)}
                  className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  className="btn-primario">
                  {salvando && <Loader2 size={14} className="animate-spin" />} Emitir receita
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
