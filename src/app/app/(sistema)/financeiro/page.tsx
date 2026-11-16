'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, X, Loader2, ArrowUpRight, ArrowDownRight, Check } from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'
import { moeda, data } from '@/lib/formato'

const vazio: any = {
  descricao: '', valor: '', tipo: 'RECEITA', status: 'PENDENTE',
  data: new Date().toISOString().slice(0, 10), pacienteId: '',
}

export default function FinanceiroPage() {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { data: lancamentos, isLoading, mutate } = useSWR('/api/financeiro', fetcher)
  const { data: pacientes } = useSWR('/api/pacientes', fetcher)

  const receitas = lancamentos?.filter((l: any) => l.tipo === 'RECEITA')
    .reduce((s: number, l: any) => s + Number(l.valor), 0) ?? 0
  const despesas = lancamentos?.filter((l: any) => l.tipo === 'DESPESA')
    .reduce((s: number, l: any) => s + Number(l.valor), 0) ?? 0

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null)
    try {
      await enviar('/api/financeiro', 'POST', { ...form, pacienteId: form.pacienteId || null })
      setModal(false); setForm(vazio); mutate()
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  async function alternarStatus(l: any) {
    await enviar(`/api/financeiro/${l.id}`, 'PATCH', { status: l.status === 'PAGO' ? 'PENDENTE' : 'PAGO' })
    mutate()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await enviar(`/api/financeiro/${id}`, 'DELETE'); mutate()
  }

  return (
    <div className="p-4 sm:p-7 max-w-[1500px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="titulo-pagina">Financeiro</h1>
          <p className="subtitulo">Receitas e despesas do consultório</p>
        </div>
        <button onClick={() => { setForm(vazio); setModal(true) }}
          className="btn-primario">
          <Plus size={16} /> Novo lançamento
        </button>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="cartao p-5">
          <p className="rotulo-kpi mb-1">TOTAL DE RECEITAS</p>
          <p className="titulo-pagina text-brand-600">{moeda(receitas)}</p>
        </div>
        <div className="cartao p-5">
          <p className="rotulo-kpi mb-1">TOTAL DE DESPESAS</p>
          <p className="titulo-pagina text-red-500">{moeda(despesas)}</p>
        </div>
        <div className="cartao p-5">
          <p className="rotulo-kpi mb-1">SALDO</p>
          <p className={`titulo-pagina ${receitas - despesas >= 0 ? 'text-brand-600' : 'text-red-500'}`}>
            {moeda(receitas - despesas)}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-neutro-300" /></div>
      ) : (
        <div className="space-y-2.5">
          {lancamentos?.length === 0 && (
            <p className="text-sm text-neutro-400 text-center py-12">Nenhum lançamento registrado.</p>
          )}
          {lancamentos?.map((l: any) => (
            <div key={l.id} className="cartao px-5 py-3.5 flex items-center gap-4">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                l.tipo === 'RECEITA'
                  ? 'bg-brand-50 dark:bg-brand-700/20 text-brand-600'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-500'}`}>
                {l.tipo === 'RECEITA' ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{l.descricao}</p>
                <p className="text-xs text-neutro-400">{data(l.data)}{l.paciente && ` · ${l.paciente.nome}`}</p>
              </div>
              <p className={`font-semibold text-sm ${l.tipo === 'RECEITA' ? 'text-brand-600' : 'text-red-500'}`}>
                {l.tipo === 'RECEITA' ? '+' : '−'} {moeda(Number(l.valor))}
              </p>
              <button onClick={() => alternarStatus(l)}
                className={`transition-all active:scale-[0.98] text-[11px] font-medium px-2.5 py-1 rounded-full ${
                  l.status === 'PAGO'
                    ? 'bg-brand-50 dark:bg-brand-700/20 text-brand-600'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600'}`}>
                {l.status === 'PAGO' ? 'Pago' : 'Pendente'}
              </button>
              <button onClick={() => excluir(l.id)}
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
            className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <motion.form onSubmit={salvar}
              initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.2 }}
              className="cartao w-full max-w-md p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold">Novo lançamento</h2>
                <button type="button" onClick={() => setModal(false)} className="text-neutro-400"><X size={20} /></button>
              </div>

              <div>
                <label className="rotulo">Descrição</label>
                <input className="campo" required value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Consulta, aluguel..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="rotulo">Valor</label>
                  <input type="number" step="0.01" className="campo" required value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" />
                </div>
                <div>
                  <label className="rotulo">Data</label>
                  <input type="date" className="campo" required value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="rotulo">Tipo</label>
                  <select className="campo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    <option value="RECEITA">Receita</option>
                    <option value="DESPESA">Despesa</option>
                  </select>
                </div>
                <div>
                  <label className="rotulo">Status</label>
                  <select className="campo" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="PENDENTE">Pendente</option>
                    <option value="PAGO">Pago</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="rotulo">Paciente (opcional)</label>
                <select className="campo" value={form.pacienteId}
                  onChange={(e) => setForm({ ...form, pacienteId: e.target.value })}>
                  <option value="">Sem vínculo</option>
                  {pacientes?.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>

              {erro && <p className="text-xs text-red-600">{erro}</p>}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModal(false)}
                  className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  className="btn-primario">
                  {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
