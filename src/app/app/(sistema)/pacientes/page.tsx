'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Pencil, Trash2, X, Loader2, Phone, Mail, MapPin,
  Cake, IdCard, Briefcase, FileText, Receipt, CalendarDays, ChevronRight,
  ChevronDown, AlertCircle, Zap,
} from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'
import { data, hora } from '@/lib/formato'

/** Campos mínimos que consideramos um cadastro completo. */
function cadastroIncompleto(p: any) {
  return !p.dataNascimento && !p.cpf && !p.email
}

const vazio: any = {
  nome: '', email: '', telefone: '', dataNascimento: '', ativo: true,
  cpf: '', rg: '', sexo: '', profissao: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  convenio: '', observacoesGerais: '', origemContato: '',
}

/** Calcula a idade — o optometrista pensa em idade, não em data de nascimento. */
function idade(nascimento?: string | null) {
  if (!nascimento) return null
  const n = new Date(nascimento)
  const hoje = new Date()
  let anos = hoje.getFullYear() - n.getFullYear()
  const m = hoje.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) anos--
  return anos
}

function iniciais(nome: string) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

export default function PacientesPage() {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'inativo'>('todos')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [detalheId, setDetalheId] = useState<string | null>(null)

  // Permite chegar aqui já com a ficha aberta: /pacientes?paciente=<id>.
  // Lemos da window em vez de useSearchParams para não precisar de <Suspense> só
  // por causa disto — o que quebraria o build da página.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('paciente')
    if (id) setDetalheId(id)
    // Busca do topo escolhendo paciente com esta tela já aberta.
    const abrir = (e: Event) => setDetalheId((e as CustomEvent<string>).detail)
    window.addEventListener('medflow:abrir-paciente', abrir)
    return () => window.removeEventListener('medflow:abrir-paciente', abrir)
  }, [])

  const { data: pacientes, isLoading, mutate } = useSWR(
    `/api/pacientes${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`, fetcher
  )

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null)
    try {
      const corpo = { ...form, dataNascimento: form.dataNascimento || null }
      if (form.id) {
        await enviar(`/api/pacientes/${form.id}`, 'PUT', corpo)
      } else {
        // Sinaliza ao servidor se é cadastro rápido (incompleto), para ele
        // criar a notificação de "faltam dados" automaticamente.
        const incompleto = !form.dataNascimento && !form.cpf && !form.email
        await enviar('/api/pacientes', 'POST', { ...corpo, cadastroRapido: incompleto })
      }
      setModal(false); mutate()
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  async function excluir(id: string) {
    if (!confirm('Remover este paciente? Prontuários e receitas dele também serão apagados.')) return
    await enviar(`/api/pacientes/${id}`, 'DELETE')
    setDetalheId(null)
    mutate()
  }

  function abrirEdicao(p: any) {
    setForm({
      ...vazio, ...p,
      email: p.email ?? '', telefone: p.telefone ?? '',
      dataNascimento: p.dataNascimento ? p.dataNascimento.slice(0, 10) : '',
    })
    setErro(null); setModal(true)
  }

  return (
    <div className="p-4 sm:p-7 max-w-[1500px]">
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="titulo-pagina">Pacientes</h1>
          <p className="subtitulo mt-1">
            {pacientes?.length ?? 0} cadastrado{pacientes?.length === 1 ? '' : 's'} no consultório
          </p>
        </div>
        <button onClick={() => { setForm(vazio); setErro(null); setModal(true) }} className="btn-primario">
          <Zap size={15} strokeWidth={2.2} /> Novo paciente
        </button>
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2.5 flex-1 min-w-[200px] max-w-sm px-3 py-2.5 rounded-lg border border-neutro-200 dark:border-neutro-700 bg-white dark:bg-neutro-900 transition-all focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10">
          <Search size={15} className="text-neutro-400" strokeWidth={2} />
          <input className="w-full bg-transparent outline-none text-[13px] placeholder:text-neutro-400"
            placeholder="Buscar por nome ou e-mail..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          {([
            { rotulo: 'Todos', valor: 'todos' },
            { rotulo: 'Ativos', valor: 'ativo' },
            { rotulo: 'Inativos', valor: 'inativo' },
          ] as const).map((op) => (
            <button key={op.valor} onClick={() => setFiltroStatus(op.valor)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all duration-200 active:scale-[0.98] ${
                filtroStatus === op.valor
                  ? 'bg-neutro-900 dark:bg-white text-white dark:text-neutro-900 border-neutro-900 dark:border-white'
                  : 'border-neutro-200 dark:border-neutro-700 text-neutro-500'
              }`}>
              {op.rotulo}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="esqueleto h-[132px]" />)}
        </div>
      ) : (() => {
        const lista = (pacientes ?? []).filter((p: any) => {
          if (filtroStatus === 'ativo') return p.ativo
          if (filtroStatus === 'inativo') return !p.ativo
          return true
        })
        return lista.length === 0 ? (
          <div className="cartao py-20 flex flex-col items-center">
            <div className="w-11 h-11 rounded-full bg-neutro-100 dark:bg-neutro-800 flex items-center justify-center mb-3">
              <Search size={19} className="text-neutro-400" strokeWidth={1.8} />
            </div>
            <p className="text-[13px] font-medium">Nenhum paciente encontrado</p>
            <p className="text-[12px] text-neutro-400 mt-0.5">Tente outro termo ou cadastre um novo</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {lista.map((p: any, i: number) => (
            <motion.button key={p.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.3 }}
              onClick={() => setDetalheId(p.id)}
              className="cartao-interativo p-5 text-left group">
              <div className="flex items-start gap-3.5 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-[13px] font-medium flex items-center justify-center shrink-0 shadow-suave">
                  {iniciais(p.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[14px] font-medium truncate">{p.nome}</p>
                    {cadastroIncompleto(p) && (
                      <span title="Cadastro incompleto — clique para preencher"
                        className="shrink-0 w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-neutro-400 mt-0.5">
                    {idade(p.dataNascimento) !== null ? `${idade(p.dataNascimento)} anos` : 'Idade não informada'}
                    {p.convenio && ` · ${p.convenio}`}
                  </p>
                </div>
                <span className={`etiqueta shrink-0 ${p.ativo
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                  : 'bg-neutro-100 text-neutro-500 dark:bg-neutro-800'}`}>
                  {p.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div className="space-y-1.5">
                {p.telefone && (
                  <p className="flex items-center gap-2 text-[12px] text-neutro-500">
                    <Phone size={12} strokeWidth={1.9} className="text-neutro-400 shrink-0" />
                    <span className="numerico">{p.telefone}</span>
                  </p>
                )}
                {p.email && (
                  <p className="flex items-center gap-2 text-[12px] text-neutro-500">
                    <Mail size={12} strokeWidth={1.9} className="text-neutro-400 shrink-0" />
                    <span className="truncate">{p.email}</span>
                  </p>
                )}
                {(p.cidade || p.bairro) && (
                  <p className="flex items-center gap-2 text-[12px] text-neutro-500">
                    <MapPin size={12} strokeWidth={1.9} className="text-neutro-400 shrink-0" />
                    <span className="truncate">{[p.bairro, p.cidade].filter(Boolean).join(', ')}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutro-100 dark:border-neutro-800">
                <span className="text-[11px] text-neutro-400">
                  Desde {data(p.criadoEm)}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-medium text-neutro-400 group-hover:text-brand-600 transition-colors">
                  Ver ficha <ChevronRight size={12} strokeWidth={2.4} />
                </span>
              </div>
            </motion.button>
          ))}
        </div>
        )
      })()}

      <PainelDetalhe id={detalheId} aoFechar={() => setDetalheId(null)}
        aoEditar={abrirEdicao} aoExcluir={excluir} />

      <ModalPaciente aberto={modal} form={form} setForm={setForm} erro={erro}
        salvando={salvando} aoFechar={() => setModal(false)} aoSalvar={salvar} />
    </div>
  )
}

/* ─── Painel lateral com a ficha completa ─────────────────── */
function PainelDetalhe({ id, aoFechar, aoEditar, aoExcluir }: any) {
  const { data: p, isLoading } = useSWR(id ? `/api/pacientes/${id}` : null, fetcher)

  const endereco = p && [p.logradouro, p.numero, p.bairro, p.cidade, p.estado]
    .filter(Boolean).join(', ')

  return (
    <AnimatePresence>
      {id && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={aoFechar} className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm z-40" />

          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="fixed right-0 top-0 h-screen w-full max-w-md bg-white dark:bg-neutro-900 border-l border-neutro-200 dark:border-neutro-800 z-50 overflow-y-auto">

            {isLoading || !p ? (
              <div className="p-6 space-y-4">
                <div className="esqueleto h-14 w-14 rounded-full" />
                <div className="esqueleto h-5 w-40" />
                <div className="esqueleto h-24 w-full" />
              </div>
            ) : (
              <>
                <div className="sticky top-0 bg-white/90 dark:bg-neutro-900/90 backdrop-blur-xl border-b border-neutro-200/70 dark:border-neutro-800 px-6 py-4 flex items-center justify-between">
                  <p className="text-[13px] font-semibold">Ficha do paciente</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { aoFechar(); aoEditar(p) }} className="btn-icone !w-8 !h-8" title="Editar">
                      <Pencil size={15} strokeWidth={2} />
                    </button>
                    <button onClick={() => aoExcluir(p.id)}
                      className="btn-icone !w-8 !h-8 hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950/40" title="Excluir">
                      <Trash2 size={15} strokeWidth={2} />
                    </button>
                    <button onClick={aoFechar} className="btn-icone !w-8 !h-8"><X size={17} /></button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-[17px] font-medium flex items-center justify-center shadow-media">
                      {iniciais(p.nome)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[17px] font-semibold tracking-apertado truncate">{p.nome}</p>
                      <p className="text-[12px] text-neutro-400 mt-0.5">
                        {idade(p.dataNascimento) !== null && `${idade(p.dataNascimento)} anos`}
                        {p.sexo && ` · ${p.sexo}`}
                        {p.profissao && ` · ${p.profissao}`}
                      </p>
                    </div>
                  </div>

                  <Bloco titulo="Contato">
                    <Linha icone={Phone} rotulo="Telefone" valor={p.telefone} />
                    <Linha icone={Mail} rotulo="E-mail" valor={p.email} />
                    <Linha icone={MapPin} rotulo="Endereço" valor={endereco} />
                  </Bloco>

                  <Bloco titulo="Documentos">
                    <Linha icone={IdCard} rotulo="CPF" valor={p.cpf} />
                    <Linha icone={IdCard} rotulo="RG" valor={p.rg} />
                    <Linha icone={Cake} rotulo="Nascimento" valor={p.dataNascimento ? data(p.dataNascimento) : null} />
                    <Linha icone={Briefcase} rotulo="Convênio" valor={p.convenio} />
                  </Bloco>

                  {p.observacoesGerais && (
                    <Bloco titulo="Observações">
                      <p className="text-[13px] leading-relaxed text-neutro-600 dark:text-neutro-400">
                        {p.observacoesGerais}
                      </p>
                    </Bloco>
                  )}

                  <Bloco titulo={`Consultas (${p.consultas?.length ?? 0})`}>
                    {p.consultas?.length === 0 && <Vazio texto="Nenhuma consulta registrada" />}
                    {p.consultas?.slice(0, 5).map((c: any) => (
                      <div key={c.id} className="flex items-center gap-3 py-2">
                        <CalendarDays size={14} className="text-neutro-400 shrink-0" strokeWidth={1.9} />
                        <span className="text-[13px] numerico">{data(c.dataHora)} · {hora(c.dataHora)}</span>
                        <span className="text-[11px] text-neutro-400 ml-auto">
                          {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                    ))}
                  </Bloco>

                  <Bloco titulo={`Prontuários (${p.prontuarios?.length ?? 0})`}>
                    {p.prontuarios?.length === 0 && <Vazio texto="Nenhum exame registrado" />}
                    {p.prontuarios?.map((pr: any) => (
                      <div key={pr.id} className="flex items-start gap-3 py-2">
                        <FileText size={14} className="text-neutro-400 shrink-0 mt-0.5" strokeWidth={1.9} />
                        <div className="min-w-0">
                          <p className="text-[13px]">{data(pr.dataExame)}</p>
                          {pr.diagnostico && (
                            <p className="text-[11px] text-neutro-400 truncate">{pr.diagnostico}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </Bloco>

                  <Bloco titulo={`Receitas (${p.receitas?.length ?? 0})`} ultimo>
                    {p.receitas?.length === 0 && <Vazio texto="Nenhuma receita emitida" />}
                    {p.receitas?.map((r: any) => (
                      <div key={r.id} className="flex items-center gap-3 py-2">
                        <Receipt size={14} className="text-neutro-400 shrink-0" strokeWidth={1.9} />
                        <span className="text-[13px]">{data(r.dataEmissao)}</span>
                        <span className="text-[11px] text-neutro-400 ml-auto">
                          {new Date(r.validadeAte) < new Date() ? 'Vencida' : `Válida até ${data(r.validadeAte)}`}
                        </span>
                      </div>
                    ))}
                  </Bloco>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function Bloco({ titulo, children, ultimo }: any) {
  return (
    <div className={`py-4 ${ultimo ? '' : 'border-b border-neutro-100 dark:border-neutro-800'}`}>
      <p className="rotulo-kpi mb-2.5">{titulo}</p>
      {children}
    </div>
  )
}

function Linha({ icone: Icone, rotulo, valor }: any) {
  if (!valor) return null
  return (
    <div className="flex items-start gap-3 py-1.5">
      <Icone size={14} className="text-neutro-400 shrink-0 mt-0.5" strokeWidth={1.9} />
      <div className="min-w-0">
        <p className="text-[11px] text-neutro-400">{rotulo}</p>
        <p className="text-[13px] break-words">{valor}</p>
      </div>
    </div>
  )
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-[12px] text-neutro-400 py-1">{texto}</p>
}

/* ─── Modal de cadastro/edição ────────────────────────────── */
function ModalPaciente({ aberto, form, setForm, erro, salvando, aoFechar, aoSalvar }: any) {
  const edicao = Boolean(form.id)
  // Modo expandido: sempre aberto em edição, ou quando o usuário pede mais campos.
  const [expandido, setExpandido] = useState(edicao)

  // Reseta o modo ao abrir/fechar
  useEffect(() => { setExpandido(edicao) }, [aberto, edicao])

  const campo = (nome: string, rotulo: string, extra: any = {}) => (
    <div>
      <label className="rotulo">{rotulo}</label>
      <input className="campo" value={form[nome] ?? ''} {...extra}
        onChange={(e) => setForm({ ...form, [nome]: e.target.value })} />
    </div>
  )

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
          <motion.form onSubmit={aoSalvar}
            initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="cartao shadow-alta w-full max-w-xl p-5 sm:p-6 space-y-5 my-auto">

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold">
                  {edicao ? 'Editar paciente' : 'Novo paciente'}
                </h2>
                {!edicao && !expandido && (
                  <p className="text-[11.5px] text-neutro-400 mt-0.5">
                    Nome e telefone já permitem agendar. Os demais dados podem ser preenchidos depois.
                  </p>
                )}
              </div>
              <button type="button" onClick={aoFechar} className="btn-icone !w-8 !h-8"><X size={17} /></button>
            </div>

            {/* Campos essenciais — sempre visíveis */}
            <div className="space-y-3">
              <div>
                <label className="rotulo">Nome completo <span className="text-brand-500">*</span></label>
                <input className="campo" required value={form.nome} autoFocus
                  placeholder="Como o paciente será buscado no sistema"
                  onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {campo('telefone', 'Telefone / WhatsApp', { type: 'tel', placeholder: '(00) 00000-0000' })}
                {campo('convenio', 'Convênio', { placeholder: 'Unimed, Bradesco...' })}
              </div>
            </div>

            {/* Expansor: mais dados opcionais */}
            {!edicao && (
              <button type="button" onClick={() => setExpandido((v) => !v)}
                className="flex items-center gap-1.5 text-[12.5px] font-medium text-brand-600 hover:text-brand-700 transition-colors">
                <ChevronDown size={14} strokeWidth={2.5}
                  className={`transition-transform duration-200 ${expandido ? 'rotate-180' : ''}`} />
                {expandido ? 'Menos campos' : 'Adicionar mais dados (nascimento, CPF, endereço…)'}
              </button>
            )}

            <AnimatePresence initial={false}>
              {expandido && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden space-y-5">

                  <Grupo titulo="Dados pessoais">
                    <div className="grid grid-cols-2 gap-3">
                      {campo('dataNascimento', 'Nascimento', { type: 'date' })}
                      <div>
                        <label className="rotulo">Sexo</label>
                        <select className="campo" value={form.sexo ?? ''}
                          onChange={(e) => setForm({ ...form, sexo: e.target.value })}>
                          <option value="">Não informado</option>
                          <option value="Feminino">Feminino</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
                      {campo('cpf', 'CPF')}
                      {campo('rg', 'RG')}
                      {campo('profissao', 'Profissão')}
                      {campo('email', 'E-mail', { type: 'email' })}
                    </div>
                  </Grupo>

                  <Grupo titulo="Endereço">
                    <div className="grid grid-cols-6 gap-3">
                      <div className="col-span-2">{campo('cep', 'CEP')}</div>
                      <div className="col-span-4">{campo('logradouro', 'Logradouro')}</div>
                      <div className="col-span-2">{campo('numero', 'Número')}</div>
                      <div className="col-span-4">{campo('complemento', 'Complemento')}</div>
                      <div className="col-span-2">{campo('bairro', 'Bairro')}</div>
                      <div className="col-span-3">{campo('cidade', 'Cidade')}</div>
                      <div className="col-span-1">{campo('estado', 'UF', { maxLength: 2 })}</div>
                    </div>
                  </Grupo>

                  <Grupo titulo="Outros">
                    {campo('origemContato', 'Como conheceu a clínica')}
                    <div className="mt-3">
                      <label className="rotulo">Observações gerais</label>
                      <textarea rows={2} className="campo resize-none" value={form.observacoesGerais ?? ''}
                        onChange={(e) => setForm({ ...form, observacoesGerais: e.target.value })} />
                    </div>
                    <label className="flex items-center gap-2 text-[13px] text-neutro-600 dark:text-neutro-400 mt-3">
                      <input type="checkbox" checked={form.ativo}
                        onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                      Paciente ativo
                    </label>
                  </Grupo>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Aviso de cadastro incompleto */}
            {!edicao && !expandido && (
              <div className="flex items-start gap-2 text-[11.5px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg px-3.5 py-2.5">
                <AlertCircle size={13} className="shrink-0 mt-0.5" strokeWidth={2} />
                Dados como CPF, nascimento e endereço são solicitados depois por notificação no sistema.
              </div>
            )}

            {erro && <p className="text-[12px] text-red-600">{erro}</p>}

            <div className="flex justify-end gap-2.5 pt-2 border-t border-neutro-100 dark:border-neutro-800">
              <button type="button" onClick={aoFechar}
                className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">
                Cancelar
              </button>
              <button type="submit" disabled={salvando} className="btn-primario">
                {salvando && <Loader2 size={14} className="animate-spin" />}
                {!edicao && !expandido ? 'Cadastrar e agendar' : 'Salvar'}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Grupo({ titulo, children }: any) {
  return (
    <div>
      <p className="rotulo-kpi mb-2.5">{titulo}</p>
      {children}
    </div>
  )
}
