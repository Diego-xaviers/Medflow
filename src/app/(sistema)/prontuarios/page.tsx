'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Plus, FileText, Trash2, X, Loader2, Eye, ChevronRight, Receipt, Stethoscope, Pencil,
} from 'lucide-react'
import CampoBusca, { contem } from '@/components/CampoBusca'
import { fetcher, enviar } from '@/lib/fetcher'
import { data, dataHora } from '@/lib/formato'
import { resumoRefracao } from '@/lib/prescricao'
import TagsInput from '@/components/TagsInput'
import BuscaPaciente from '@/components/BuscaPaciente'
import {
  QUEIXA_PRINCIPAL, HISTORICO_OCULAR, HISTORICO_SISTEMICO,
  MEDICAMENTOS, TEMPO_ULTIMO_EXAME,
} from '@/lib/opcoesClinicas'

const vazio: any = {
  pacienteId: '',
  queixaPrincipal: '', historicoOcular: '', historicoSistemico: '',
  medicamentosEmUso: '', usaCorrecaoAtual: false, tempoUltimoExame: '',
  avSemCorrecaoOD: '', avSemCorrecaoOE: '', avComCorrecaoOD: '', avComCorrecaoOE: '',
  refracaoEsfericoOD: '', refracaoCilindricoOD: '', refracaoEixoOD: '',
  refracaoEsfericoOE: '', refracaoCilindricoOE: '', refracaoEixoOE: '',
  adicaoOD: '', adicaoOE: '',
  biomicroscopia: '', tonometriaOD: '', tonometriaOE: '', fundoscopia: '',
  motilidadeOcular: '', testeCobertura: '', reflexosPupilares: '', visaoCores: '',
  diagnostico: '', conduta: '', observacoes: '',
}

function formDoProntuario(p: any): any {
  return {
    pacienteId: p.pacienteId ?? '',
    consultaId: p.consultaId ?? '',
    queixaPrincipal: p.queixaPrincipal ?? '',
    historicoOcular: p.historicoOcular ?? '',
    historicoSistemico: p.historicoSistemico ?? '',
    medicamentosEmUso: p.medicamentosEmUso ?? '',
    usaCorrecaoAtual: p.usaCorrecaoAtual ?? false,
    tempoUltimoExame: p.tempoUltimoExame ?? '',
    avSemCorrecaoOD: p.avSemCorrecaoOD ?? '',
    avSemCorrecaoOE: p.avSemCorrecaoOE ?? '',
    avComCorrecaoOD: p.avComCorrecaoOD ?? '',
    avComCorrecaoOE: p.avComCorrecaoOE ?? '',
    refracaoEsfericoOD: p.refracaoEsfericoOD ?? '',
    refracaoCilindricoOD: p.refracaoCilindricoOD ?? '',
    refracaoEixoOD: p.refracaoEixoOD ?? '',
    refracaoEsfericoOE: p.refracaoEsfericoOE ?? '',
    refracaoCilindricoOE: p.refracaoCilindricoOE ?? '',
    refracaoEixoOE: p.refracaoEixoOE ?? '',
    adicaoOD: p.adicaoOD ?? '',
    adicaoOE: p.adicaoOE ?? '',
    biomicroscopia: p.biomicroscopia ?? '',
    tonometriaOD: p.tonometriaOD ?? '',
    tonometriaOE: p.tonometriaOE ?? '',
    fundoscopia: p.fundoscopia ?? '',
    motilidadeOcular: p.motilidadeOcular ?? '',
    testeCobertura: p.testeCobertura ?? '',
    reflexosPupilares: p.reflexosPupilares ?? '',
    visaoCores: p.visaoCores ?? '',
    diagnostico: p.diagnostico ?? '',
    conduta: p.conduta ?? '',
    observacoes: p.observacoes ?? '',
  }
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold tracking-wider text-brand-600 dark:text-brand-400 pt-2">
        {titulo}
      </p>
      {children}
    </div>
  )
}

function ParOlhos({ rotulo, campoOD, campoOE, form, setForm, placeholder }: any) {
  return (
    <div>
      <label className="rotulo">{rotulo}</label>
      <div className="grid grid-cols-2 gap-3 mt-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-neutro-400 w-6">OD</span>
          <input className="campo !mt-0" placeholder={placeholder}
            value={form[campoOD]} onChange={(e) => setForm({ ...form, [campoOD]: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-neutro-400 w-6">OE</span>
          <input className="campo !mt-0" placeholder={placeholder}
            value={form[campoOE]} onChange={(e) => setForm({ ...form, [campoOE]: e.target.value })} />
        </div>
      </div>
    </div>
  )
}

export default function ProntuariosPage() {
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [detalheId, setDetalheId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { data: prontuarios, isLoading, mutate } = useSWR('/api/prontuarios', fetcher)
  const [busca, setBusca] = useState('')
  const filtrados = prontuarios?.filter((p: any) =>
    contem(busca, p.paciente?.nome, p.diagnostico, data(p.dataExame)))
  const { data: pacientes } = useSWR('/api/pacientes', fetcher)

  function abrirNovo() {
    setForm(vazio)
    setEditandoId(null)
    setModal(true)
  }

  function abrirEditar(p: any) {
    setForm(formDoProntuario(p))
    setEditandoId(p.id)
    setDetalheId(null)
    setModal(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.pacienteId) { setErro('Selecione o paciente'); return }
    setSalvando(true)
    setErro(null)
    try {
      if (editandoId) {
        await enviar(`/api/prontuarios/${editandoId}`, 'PUT', form)
      } else {
        await enviar('/api/prontuarios', 'POST', form)
      }
      setModal(false)
      setForm(vazio)
      setEditandoId(null)
      mutate()
    } catch (e: any) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este prontuário?')) return
    await enviar(`/api/prontuarios/${id}`, 'DELETE')
    mutate()
  }

  const campo = (nome: string, rotulo: string, placeholder = '') => (
    <div>
      <label className="rotulo">{rotulo}</label>
      <input className="campo" placeholder={placeholder}
        value={form[nome]} onChange={(e) => setForm({ ...form, [nome]: e.target.value })} />
    </div>
  )

  const area = (nome: string, rotulo: string, placeholder = '') => (
    <div>
      <label className="rotulo">{rotulo}</label>
      <textarea rows={2} className="campo resize-none" placeholder={placeholder}
        value={form[nome]} onChange={(e) => setForm({ ...form, [nome]: e.target.value })} />
    </div>
  )

  return (
    <div className="p-4 sm:p-7 max-w-[1500px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="titulo-pagina">Prontuários</h1>
          <p className="subtitulo">Registro dos exames realizados</p>
        </div>
        <button onClick={abrirNovo} className="btn-primario">
          <Plus size={16} /> Novo prontuário
        </button>
      </div>

      <div className="mb-5">
        <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Buscar por paciente, diagnóstico ou data..." />
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-neutro-300" /></div>
      ) : (
        <div className="space-y-3">
          {filtrados?.length === 0 && (
            <p className="text-sm text-neutro-400 text-center py-12">
              {busca ? 'Nenhum prontuário encontrado.' : 'Nenhum prontuário registrado ainda.'}
            </p>
          )}
          {filtrados?.map((p: any) => (
            <div key={p.id} className="cartao-interativo px-5 py-4 flex items-center gap-4 group">
              <button onClick={() => setDetalheId(p.id)}
                className="flex items-center gap-4 flex-1 min-w-0 text-left">
                <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-700/20 text-brand-600 flex items-center justify-center shrink-0">
                  <FileText size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.paciente.nome}</p>
                  <p className="text-xs text-neutro-400 truncate">
                    {p.diagnostico || 'Sem diagnóstico registrado'}
                  </p>
                  <p className="text-[11px] text-neutro-400 truncate mt-0.5 numerico">
                    {resumoRefracao(p)}
                  </p>
                </div>
              </button>

              <p className="text-xs text-neutro-400 shrink-0">{data(p.dataExame)}</p>

              <Link href={`/receitas?paciente=${p.paciente.id}&prontuario=${p.id}`}
                title="Emitir receita a partir deste exame"
                className="btn-suave !py-1.5 !px-2.5 !text-[11.5px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Receipt size={13} strokeWidth={2} /> Emitir receita
              </Link>

              <button onClick={() => excluir(p.id)}
                className="btn-icone !w-8 !h-8 hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950/40 shrink-0">
                <Trash2 size={16} />
              </button>
              <ChevronRight size={15} className="text-neutro-300 dark:text-neutro-700 shrink-0" />
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

              <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-neutro-900 pb-2">
                <div className="flex items-center gap-2">
                  <Eye size={18} className="text-brand-500" />
                  <h2 className="text-[16px] font-semibold">
                    {editandoId ? 'Editar prontuário' : 'Novo prontuário'}
                  </h2>
                </div>
                <button type="button" onClick={() => setModal(false)} className="text-neutro-400 hover:text-neutro-600"><X size={20} /></button>
              </div>

              <div>
                <label className="rotulo">Paciente</label>
                <BuscaPaciente
                  pacientes={pacientes ?? []}
                  valor={form.pacienteId}
                  aoMudar={(id) => setForm({ ...form, pacienteId: id })}
                />
              </div>

              <Secao titulo="ANAMNESE">
                <TagsInput
                  rotulo="Queixa principal"
                  sugestoes={QUEIXA_PRINCIPAL}
                  valor={form.queixaPrincipal}
                  aoMudar={(v) => setForm({ ...form, queixaPrincipal: v })}
                  placeholder="Dificuldade para enxergar, dor de cabeça..."
                />
                <TagsInput
                  rotulo="Histórico ocular"
                  sugestoes={HISTORICO_OCULAR}
                  valor={form.historicoOcular}
                  aoMudar={(v) => setForm({ ...form, historicoOcular: v })}
                  placeholder="Glaucoma, cirurgia refrativa..."
                />
                <TagsInput
                  rotulo="Histórico sistêmico"
                  sugestoes={HISTORICO_SISTEMICO}
                  valor={form.historicoSistemico}
                  aoMudar={(v) => setForm({ ...form, historicoSistemico: v })}
                  placeholder="Diabetes, Hipertensão..."
                />
                <TagsInput
                  rotulo="Medicamentos em uso"
                  sugestoes={MEDICAMENTOS}
                  valor={form.medicamentosEmUso}
                  aoMudar={(v) => setForm({ ...form, medicamentosEmUso: v })}
                  placeholder="Colírio, Anti-hipertensivo..."
                />
                <TagsInput
                  rotulo="Último exame de vista"
                  sugestoes={TEMPO_ULTIMO_EXAME}
                  valor={form.tempoUltimoExame}
                  aoMudar={(v) => setForm({ ...form, tempoUltimoExame: v })}
                  placeholder="Primeira consulta, há 1 ano..."
                />
                <label className="flex items-center gap-2 text-sm text-neutro-600 dark:text-neutro-400">
                  <input type="checkbox" checked={form.usaCorrecaoAtual}
                    onChange={(e) => setForm({ ...form, usaCorrecaoAtual: e.target.checked })} />
                  Já usa correção
                </label>
              </Secao>

              <Secao titulo="ACUIDADE VISUAL">
                <ParOlhos rotulo="Sem correção" campoOD="avSemCorrecaoOD" campoOE="avSemCorrecaoOE"
                  form={form} setForm={setForm} placeholder="20/20" />
                <ParOlhos rotulo="Com correção atual" campoOD="avComCorrecaoOD" campoOE="avComCorrecaoOE"
                  form={form} setForm={setForm} placeholder="20/20" />
              </Secao>

              <Secao titulo="REFRAÇÃO ENCONTRADA">
                <ParOlhos rotulo="Esférico" campoOD="refracaoEsfericoOD" campoOE="refracaoEsfericoOE"
                  form={form} setForm={setForm} placeholder="-1.75" />
                <ParOlhos rotulo="Cilíndrico" campoOD="refracaoCilindricoOD" campoOE="refracaoCilindricoOE"
                  form={form} setForm={setForm} placeholder="-0.50" />
                <ParOlhos rotulo="Eixo" campoOD="refracaoEixoOD" campoOE="refracaoEixoOE"
                  form={form} setForm={setForm} placeholder="180" />
                <ParOlhos rotulo="Adição" campoOD="adicaoOD" campoOE="adicaoOE"
                  form={form} setForm={setForm} placeholder="+2.00" />
              </Secao>

              <Secao titulo="EXAMES COMPLEMENTARES">
                <ParOlhos rotulo="Tonometria (PIO)" campoOD="tonometriaOD" campoOE="tonometriaOE"
                  form={form} setForm={setForm} placeholder="14 mmHg" />
                <div className="grid grid-cols-2 gap-3">
                  {campo('biomicroscopia', 'Biomicroscopia', 'Segmento anterior')}
                  {campo('fundoscopia', 'Fundoscopia', 'Papila, mácula, vasos')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {campo('motilidadeOcular', 'Motilidade ocular')}
                  {campo('testeCobertura', 'Teste de cobertura', 'Cover test')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {campo('reflexosPupilares', 'Reflexos pupilares')}
                  {campo('visaoCores', 'Visão de cores', 'Ishihara')}
                </div>
              </Secao>

              <Secao titulo="CONCLUSÃO">
                {area('diagnostico', 'Diagnóstico')}
                {area('conduta', 'Conduta')}
                {area('observacoes', 'Observações')}
              </Secao>

              {erro && <p className="text-xs text-red-600">{erro}</p>}

              <div className="flex justify-end gap-3 pt-2 border-t border-neutro-100 dark:border-neutro-800">
                <button type="button" onClick={() => setModal(false)}
                  className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="btn-primario">
                  {salvando && <Loader2 size={14} className="animate-spin" />}
                  {editandoId ? 'Salvar alterações' : 'Salvar prontuário'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <PainelExame id={detalheId} aoFechar={() => setDetalheId(null)} aoEditar={abrirEditar} />
    </div>
  )
}

function PainelExame({ id, aoFechar, aoEditar }: { id: string | null; aoFechar: () => void; aoEditar: (p: any) => void }) {
  const { data: p, isLoading } = useSWR(id ? `/api/prontuarios/${id}` : null, fetcher)

  return (
    <AnimatePresence>
      {id && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={aoFechar}
          className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm z-50 flex justify-end">
          <motion.aside onClick={(e) => e.stopPropagation()}
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 30, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg h-full bg-white dark:bg-neutro-900 border-l border-neutro-200 dark:border-neutro-800 overflow-y-auto">

            {isLoading || !p ? (
              <div className="p-4 sm:p-7 space-y-4">
                <div className="esqueleto h-6 w-48" />
                <div className="esqueleto h-24" />
                <div className="esqueleto h-40" />
              </div>
            ) : (
              <>
                <div className="sticky top-0 bg-white/95 dark:bg-neutro-900/95 backdrop-blur-xl border-b border-neutro-100 dark:border-neutro-800 px-6 py-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-semibold truncate">{p.paciente?.nome}</h2>
                    <p className="text-[12px] text-neutro-400">
                      Exame de {dataHora(p.dataExame)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => aoEditar(p)}
                      className="btn-suave !py-2 !px-3 !text-[12px]">
                      <Pencil size={13} strokeWidth={2} /> Editar
                    </button>
                    <Link href={`/receitas?paciente=${p.paciente?.id}&prontuario=${p.id}`}
                      className="btn-primario !py-2 !px-3 !text-[12px]">
                      <Receipt size={13} strokeWidth={2.2} /> Emitir receita
                    </Link>
                    <button onClick={aoFechar} className="btn-icone !w-8 !h-8"><X size={17} /></button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <BlocoResumo p={p} />

                  <Grupo titulo="Anamnese" itens={[
                    ['Queixa principal', p.queixaPrincipal],
                    ['Histórico ocular', p.historicoOcular],
                    ['Histórico sistêmico', p.historicoSistemico],
                    ['Medicamentos em uso', p.medicamentosEmUso],
                    ['Último exame', p.tempoUltimoExame],
                    ['Já usa correção', p.usaCorrecaoAtual ? 'Sim' : 'Não'],
                  ]} />

                  <Grupo titulo="Acuidade visual" itens={[
                    ['Sem correção — OD', p.avSemCorrecaoOD],
                    ['Sem correção — OE', p.avSemCorrecaoOE],
                    ['Com correção — OD', p.avComCorrecaoOD],
                    ['Com correção — OE', p.avComCorrecaoOE],
                  ]} />

                  <Grupo titulo="Refração encontrada" itens={[
                    ['Esférico — OD', p.refracaoEsfericoOD],
                    ['Cilíndrico — OD', p.refracaoCilindricoOD],
                    ['Eixo — OD', p.refracaoEixoOD],
                    ['Esférico — OE', p.refracaoEsfericoOE],
                    ['Cilíndrico — OE', p.refracaoCilindricoOE],
                    ['Eixo — OE', p.refracaoEixoOE],
                    ['Adição — OD', p.adicaoOD],
                    ['Adição — OE', p.adicaoOE],
                  ]} />

                  <Grupo titulo="Exames complementares" itens={[
                    ['Tonometria — OD', p.tonometriaOD],
                    ['Tonometria — OE', p.tonometriaOE],
                    ['Biomicroscopia', p.biomicroscopia],
                    ['Fundoscopia', p.fundoscopia],
                    ['Motilidade ocular', p.motilidadeOcular],
                    ['Teste de cobertura', p.testeCobertura],
                    ['Reflexos pupilares', p.reflexosPupilares],
                    ['Visão de cores', p.visaoCores],
                  ]} />

                  <Grupo titulo="Conclusão" itens={[
                    ['Diagnóstico', p.diagnostico],
                    ['Conduta', p.conduta],
                    ['Observações', p.observacoes],
                  ]} />

                  {p.receitas?.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold tracking-wider text-brand-600 dark:text-brand-400 mb-3">
                        RECEITAS GERADAS
                      </p>
                      <div className="space-y-2">
                        {p.receitas.map((r: any) => (
                          <div key={r.id}
                            className="flex items-center gap-2.5 text-[12.5px] rounded-lg border border-neutro-200/70 dark:border-neutro-800 px-3 py-2.5">
                            <Receipt size={14} className="text-neutro-400 shrink-0" strokeWidth={2} />
                            <span className="flex-1">Emitida em {data(r.dataEmissao)}</span>
                            <span className="text-[11px] text-neutro-400">
                              válida até {data(r.validadeAte)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function BlocoResumo({ p }: { p: any }) {
  return (
    <div className="rounded-xl bg-neutro-50 dark:bg-neutro-950/40 border border-neutro-200/70 dark:border-neutro-800 p-4">
      <p className="text-[11px] font-medium tracking-wide text-neutro-400 uppercase mb-2">
        Refração encontrada
      </p>
      <p className="text-[14px] font-semibold numerico">{resumoRefracao(p)}</p>
      {p.diagnostico && (
        <p className="text-[12.5px] text-neutro-500 mt-2 flex items-start gap-1.5">
          <Stethoscope size={13} className="shrink-0 mt-0.5 text-neutro-400" strokeWidth={2} />
          {p.diagnostico}
        </p>
      )}
    </div>
  )
}

function Grupo({ titulo, itens }: { titulo: string; itens: [string, any][] }) {
  const preenchidos = itens.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
  if (preenchidos.length === 0) return null

  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wider text-brand-600 dark:text-brand-400 mb-3">
        {titulo.toUpperCase()}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {preenchidos.map(([rotulo, valor]) => (
          <div key={rotulo} className="min-w-0">
            <dt className="text-[11px] text-neutro-400">{rotulo}</dt>
            <dd className="text-[12.5px] leading-snug">{String(valor)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
