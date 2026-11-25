import { useState } from 'react'
import useSWR from 'swr'
import { BookOpen, Info, Pencil, Plus, Trash2 } from 'lucide-react'
import { enviar, fetcher } from '@/lib/fetcher'

export type ItemConhecimento = { id: string; titulo: string; texto: string; ordem: number }
const SUGESTOES = ['Endereço e como chegar', 'Horário de atendimento', 'Formas de pagamento', 'Convênios', 'Estacionamento']
const ROTA = '/api/ia/conhecimento'

export default function BaseConhecimento({ exemplo }: { exemplo?: ItemConhecimento[] }) {
  const { data, error, mutate } = useSWR<ItemConhecimento[]>(exemplo ? null : ROTA, fetcher)
  const itens = exemplo ?? data
  const [editor, setEditor] = useState<ItemConhecimento | null>(null)
  const [apagar, setApagar] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const editavel = !exemplo
  async function gravar(remover = false) {
    if (!itens || !editavel || ocupado) return
    setOcupado(true)
    setErro('')
    try {
      if (remover && apagar) {
        await enviar(`${ROTA}/${apagar}`, 'DELETE')
        await mutate(lista => lista?.filter(item => item.id !== apagar), { revalidate: false })
        setApagar(null)
      } else if (editor) {
        const { id, titulo, texto, ordem } = editor
        const item: ItemConhecimento = await enviar(id ? `${ROTA}/${id}` : ROTA, id ? 'PATCH' : 'POST', { titulo: titulo.trim(), texto: texto.trim(), ordem })
        await mutate(lista => id ? lista?.map(i => i.id === id ? item : i) : [...(lista ?? []), item], { revalidate: false })
        setEditor(null)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível atualizar a base.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold tracking-apertado">Base de Conhecimento</h2>
          {itens && <p className="text-xs text-neutro-500">{itens.length} de 20 itens</p>}
        </div>
        {editavel && <button className="btn-marca" disabled={!itens || itens.length >= 20 || !!editor || ocupado}
          onClick={() => { setApagar(null); setErro(''); setEditor({ id: '', titulo: '', texto: '', ordem: Math.max(-1, ...(itens ?? []).map(i => i.ordem)) + 1 }) }}>
          <Plus size={15} /> Adicionar item
        </button>}
      </header>
      <p className="flex gap-2 items-start rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-[13px] text-amber-800 dark:text-amber-300">
        <Info size={16} className="mt-0.5 shrink-0" /> A IA não fala de preços, valores, promoções, diagnóstico ou orientação clínica — mesmo que estejam aqui.
      </p>
      {(error || erro) && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{erro || error.message}</p>}
      {!itens && !error && <div className="esqueleto h-28" />}
      {editor && <form className="cartao !rounded-2xl p-5 space-y-4" onSubmit={e => { e.preventDefault(); void gravar() }}>
        <h3 className="titulo-secao">{editor.id ? 'Editar item' : 'Novo item'}</h3>
        {!editor.id && <div className="flex flex-wrap gap-1.5">{SUGESTOES.map(s => <button type="button" key={s} disabled={ocupado}
          onClick={() => setEditor({ ...editor, titulo: s })} className="btn-suave !rounded-full text-xs px-2.5 py-1">{s}</button>)}</div>}
        <label className="rotulo block">Título <span className="float-right text-xs">{editor.titulo.length}/60</span>
          <input required maxLength={60} autoFocus className="campo" value={editor.titulo} disabled={ocupado} onChange={e => setEditor({ ...editor, titulo: e.target.value })} />
        </label>
        <label className="rotulo block">Informações para os agentes <span className="float-right text-xs">{editor.texto.length}/1000</span>
          <textarea rows={5} required maxLength={1000} className="campo resize-y" value={editor.texto} disabled={ocupado} onChange={e => setEditor({ ...editor, texto: e.target.value })} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" disabled={ocupado} className="btn-suave" onClick={() => { setEditor(null); setErro('') }}>Cancelar</button>
          <button disabled={ocupado || !editor.titulo.trim() || !editor.texto.trim()} className="btn-marca">{ocupado ? 'Salvando…' : 'Salvar item'}</button>
        </div>
      </form>}
      {itens?.length === 0 && !editor && <div className="cartao !rounded-2xl text-center px-4 py-12">
        <BookOpen className="mx-auto mb-3 text-brand-600" size={24} /><p className="font-semibold">O que seus pacientes costumam perguntar?</p>
        <p className="text-sm text-neutro-500 mt-1">Adicione informações da clínica para os agentes consultarem durante a conversa.</p>
      </div>}
      <div className="grid sm:grid-cols-2 gap-3">
        {itens?.map(item => <article key={item.id} className="cartao !rounded-2xl p-4 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="titulo-secao break-words min-w-0">{item.titulo}</h3>
            {editavel && <div className="flex shrink-0">
              <button className="btn-icone !w-8 !h-8" disabled={ocupado || !!editor} aria-label={`Editar ${item.titulo}`}
                onClick={() => { setEditor(item); setErro(''); setApagar(null) }}><Pencil size={14} /></button>
              <button className="btn-icone !w-8 !h-8" disabled={ocupado || !!editor} aria-label={`Apagar ${item.titulo}`}
                onClick={() => { setApagar(item.id); setErro('') }}><Trash2 size={14} /></button>
            </div>}
          </div>
          <p className="text-sm text-neutro-500 whitespace-pre-line break-words line-clamp-3">{item.texto}</p>
          {apagar === item.id && <div className="mt-3 flex gap-2 items-center flex-wrap text-sm">
            <span>Apagar este item?</span><button className="btn-suave text-xs" disabled={ocupado} onClick={() => setApagar(null)}>Cancelar</button>
            <button className="btn-primario text-xs" disabled={ocupado} onClick={() => gravar(true)}>Confirmar exclusão</button>
          </div>}
        </article>)}
      </div>
    </section>
  )
}
