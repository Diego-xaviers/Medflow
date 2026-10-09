'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import { Network, Plus, X, Loader2, Building2, UserRound, ShieldCheck, ChevronDown, Trash2, KeyRound } from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'

/** Senha provisória legível. */
function gerarSenha() {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => letras[b % letras.length]).join('')
}

/**
 * Redes de consultórios, no Admin. Aqui nasce o acesso gestor: você cria a
 * rede, põe as unidades e dá o login do gestor (novo, ou um dono existente).
 */
export default function RedesAdmin({ consultorios }: { consultorios: any[] }) {
  const { data: redes, mutate } = useSWR('/api/admin/redes', fetcher)
  const [nova, setNova] = useState('')
  const [aberta, setAberta] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true); setErro(null)
    try {
      const r = await enviar('/api/admin/redes', 'POST', { nome: nova })
      setNova(''); setAberta(r.id); await mutate()
    } catch (e: any) { setErro(e.message) } finally { setOcupado(false) }
  }

  return (
    <section className="cartao mb-6 overflow-hidden">
      <div className="px-5 py-4 border-b border-neutro-100 dark:border-neutro-800 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="titulo-secao flex items-center gap-2"><Network size={15} className="text-brand-600" /> Redes e gestores</h2>
          <p className="text-[11.5px] text-neutro-400 mt-0.5">
            Agrupe consultórios e dê a um gestor a visão unificada de todos, sem trocar de unidade.
          </p>
        </div>
        <form onSubmit={criar} className="flex gap-2">
          <input className="campo !mt-0 !w-56" required minLength={2} placeholder="Nome da nova rede"
            value={nova} onChange={(e) => setNova(e.target.value)} />
          <button type="submit" disabled={ocupado} className="btn-suave !px-3 shrink-0"><Plus size={14} /> Criar</button>
        </form>
      </div>
      {erro && <p className="px-5 pt-3 text-[12px] text-red-600">{erro}</p>}

      <div className="divide-y divide-neutro-100 dark:divide-neutro-800">
        {redes?.length === 0 && <p className="px-5 py-6 text-[12.5px] text-neutro-400">Nenhuma rede criada.</p>}
        {redes?.map((r: any) => (
          <Rede key={r.id} rede={r} consultorios={consultorios} aberta={aberta === r.id}
            aoAlternar={() => setAberta(aberta === r.id ? null : r.id)} aoMudar={() => mutate()} />
        ))}
      </div>
    </section>
  )
}

function Rede({ rede, consultorios, aberta, aoAlternar, aoMudar }: any) {
  const [unidade, setUnidade] = useState('')
  const [modo, setModo] = useState<'novo' | 'dono'>('novo')
  const [gestor, setGestor] = useState({ nome: '', email: '', senha: gerarSenha() })
  const [emailDono, setEmailDono] = useState('')
  const [criado, setCriado] = useState<{ email: string; senha: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function patch(corpo: any) {
    setOcupado(true); setErro(null)
    try { await enviar(`/api/admin/redes/${rede.id}`, 'PATCH', corpo); aoMudar(); return true }
    catch (e: any) { setErro(e.message); return false }
    finally { setOcupado(false) }
  }

  async function adicionarGestor(e: React.FormEvent) {
    e.preventDefault()
    if (modo === 'novo') {
      if (await patch({ novoGestor: gestor })) {
        setCriado({ email: gestor.email, senha: gestor.senha })
        setGestor({ nome: '', email: '', senha: gerarSenha() })
      }
    } else if (await patch({ donoComoGestor: emailDono })) setEmailDono('')
  }

  async function apagar() {
    if (!confirm(`Desfazer a rede "${rede.nome}"?\n\nAs unidades continuam funcionando normalmente. Gestores sem consultório perdem o acesso.`)) return
    setOcupado(true)
    try { await enviar(`/api/admin/redes/${rede.id}`, 'DELETE'); aoMudar() } finally { setOcupado(false) }
  }

  const disponiveis = consultorios.filter((c: any) => !rede.consultorios.some((u: any) => u.id === c.id))

  return (
    <div>
      <button onClick={aoAlternar} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-neutro-50 dark:hover:bg-neutro-800/40 transition-colors">
        <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center shrink-0">
          <Network size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-medium truncate">{rede.nome}</p>
          <p className="text-[11.5px] text-neutro-400">
            {rede.consultorios.length} unidade{rede.consultorios.length === 1 ? '' : 's'} ·{' '}
            {rede.gestores.length} gestor{rede.gestores.length === 1 ? '' : 'es'}
          </p>
        </div>
        <ChevronDown size={16} className={`text-neutro-400 transition-transform ${aberta ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {aberta && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-1 grid md:grid-cols-2 gap-5">
              {/* Unidades */}
              <div>
                <p className="rotulo-kpi mb-2">Unidades</p>
                <div className="space-y-1.5 mb-2.5">
                  {rede.consultorios.length === 0 && <p className="text-[12px] text-neutro-400">Nenhuma unidade.</p>}
                  {rede.consultorios.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-2 rounded-lg border border-neutro-200/70 dark:border-neutro-800 px-3 py-2">
                      <Building2 size={14} className="text-neutro-400 shrink-0" />
                      <span className="text-[13px] flex-1 truncate">{c.nome}</span>
                      <button onClick={() => patch({ removerConsultorio: c.id })} disabled={ocupado} title="Tirar da rede"
                        className="btn-icone !w-7 !h-7 hover:!text-red-500"><X size={13} /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select className="campo !mt-0" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                    <option value="">Adicionar consultório…</option>
                    {disponiveis.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <button onClick={async () => { if (unidade && await patch({ adicionarConsultorio: unidade })) setUnidade('') }}
                    disabled={!unidade || ocupado} className="btn-suave !px-3 shrink-0"><Plus size={14} /></button>
                </div>
              </div>

              {/* Gestores */}
              <div>
                <p className="rotulo-kpi mb-2">Gestores</p>
                <div className="space-y-1.5 mb-2.5">
                  {rede.gestores.length === 0 && <p className="text-[12px] text-neutro-400">Nenhum gestor.</p>}
                  {rede.gestores.map((g: any) => (
                    <div key={g.id} className="flex items-center gap-2 rounded-lg border border-neutro-200/70 dark:border-neutro-800 px-3 py-2">
                      {g.papel === 'DONO' ? <ShieldCheck size={14} className="text-brand-600 shrink-0" /> : <UserRound size={14} className="text-neutro-400 shrink-0" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] truncate">{g.nome}</span>
                        <span className="block text-[11px] text-neutro-400 truncate">
                          {g.email}{g.papel === 'DONO' ? ' · dono que também gere' : ''}
                        </span>
                      </span>
                      <button onClick={() => confirm(`Tirar ${g.nome} da gestão desta rede?`) && patch({ removerGestor: g.id })}
                        disabled={ocupado} title="Remover gestor" className="btn-icone !w-7 !h-7 hover:!text-red-500"><X size={13} /></button>
                    </div>
                  ))}
                </div>

                {criado && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2.5 mb-2.5 text-[12px]">
                    <p className="font-medium text-amber-800 dark:text-amber-300">Acesso do gestor criado. Anote agora:</p>
                    <p className="mt-1">{criado.email} · <span className="font-mono">{criado.senha}</span></p>
                  </div>
                )}

                <form onSubmit={adicionarGestor} className="space-y-2">
                  <div className="flex p-0.5 rounded-lg bg-neutro-100 dark:bg-neutro-800 w-fit">
                    {([['novo', 'Novo login'], ['dono', 'Dono existente']] as const).map(([v, r]) => (
                      <button key={v} type="button" onClick={() => setModo(v)}
                        className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium ${modo === v ? 'bg-white dark:bg-neutro-900 shadow-suave' : 'text-neutro-500'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                  {modo === 'novo' ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <input className="campo !mt-0" required placeholder="Nome" value={gestor.nome}
                          onChange={(e) => setGestor({ ...gestor, nome: e.target.value })} />
                        <input type="email" className="campo !mt-0" required placeholder="E-mail" value={gestor.email}
                          onChange={(e) => setGestor({ ...gestor, email: e.target.value })} />
                      </div>
                      <div className="flex gap-2">
                        <input className="campo !mt-0 font-mono" required minLength={8} value={gestor.senha}
                          onChange={(e) => setGestor({ ...gestor, senha: e.target.value })} />
                        <button type="button" onClick={() => setGestor({ ...gestor, senha: gerarSenha() })} title="Gerar outra"
                          className="btn-suave !px-3 shrink-0"><KeyRound size={14} /></button>
                      </div>
                    </>
                  ) : (
                    <input type="email" className="campo !mt-0" required placeholder="E-mail do dono"
                      value={emailDono} onChange={(e) => setEmailDono(e.target.value)} />
                  )}
                  <button type="submit" disabled={ocupado} className="btn-suave w-full justify-center !text-[12.5px]">
                    {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Adicionar gestor
                  </button>
                  <p className="text-[11px] text-neutro-400">
                    {modo === 'novo'
                      ? 'Login só de gestor: entra direto no Painel da rede.'
                      : 'O dono mantém a própria clínica e ganha o menu "Rede" com a visão de todas.'}
                  </p>
                </form>
              </div>
            </div>
            {erro && <p className="px-5 pb-3 text-[12px] text-red-600">{erro}</p>}
            <div className="px-5 pb-4">
              <button onClick={apagar} disabled={ocupado} className="text-[11.5px] text-red-600 hover:underline flex items-center gap-1">
                <Trash2 size={12} /> Desfazer rede
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
