'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Loader2, ShieldCheck, LayoutGrid, UserMinus, RotateCcw, Ban, Lock,
  ToggleLeft, ToggleRight, Building2, Stethoscope,
} from 'lucide-react'
import Avatar from '@/components/Avatar'
import FiltroRede, { useFiltroRede } from '@/components/FiltroRede'
import { fetcher, enviar } from '@/lib/fetcher'
import { TELAS_CONFIGURAVEIS, telasPadrao, type PapelUsuario } from '@/lib/permissoes'

const PAPEIS = [['ATENDENTE', 'Atendente'], ['VENDEDORA', 'Vendedora']] as const
const rotuloPapel: Record<string, string> = { DONO: 'Dono', ATENDENTE: 'Atendente', VENDEDORA: 'Vendedora' }
const rotuloTela = (href: string) => TELAS_CONFIGURAVEIS.find((t) => t.href === href)?.rotulo ?? href

/**
 * Equipe de todas as unidades da rede. O gestor define o TETO de cada papel
 * por unidade (o máximo que pode ser liberado), cadastra e desativa pessoas.
 * Dentro do teto, o dono da clínica continua ajustando pessoa por pessoa.
 */
export default function EquipeRedePage() {
  const { filtro, setFiltro, consulta, pronto } = useFiltroRede(false)
  const { data: rede } = useSWR('/api/gestor', fetcher)
  const { data, isLoading, mutate } = useSWR(pronto ? `/api/gestor/equipe?${consulta}` : null, fetcher)
  const [editandoTeto, setEditandoTeto] = useState<{ papel: string; unidades: string[] } | null>(null)
  const [editandoPessoa, setEditandoPessoa] = useState<any | null>(null)
  const [novo, setNovo] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const todasUnidades: { id: string; nome: string }[] = rede?.unidades ?? []
  const unidades = filtro.unidades.length ? todasUnidades.filter((u) => filtro.unidades.includes(u.id)) : todasUnidades
  const usuarios: any[] = data?.usuarios ?? []
  const tetos: any[] = data?.tetos ?? []
  const tetoDe = (consultorioId: string, papel: string): string[] | null =>
    tetos.find((t) => t.consultorioId === consultorioId && t.papel === papel)?.telas ?? null

  async function ajustar(u: any, dados: any) {
    setOcupado(u.id); setErro(null)
    try {
      await enviar(`/api/gestor/equipe/${u.id}`, 'PATCH', dados)
      await mutate()
    } catch (e: any) { setErro(e.message) } finally { setOcupado(null) }
  }

  return (
    <div className="p-4 sm:p-7 max-w-[1200px]">
      <div className="flex items-end justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="titulo-pagina">Equipe da rede</h1>
          <p className="subtitulo mt-1">Quem trabalha em cada unidade, e até onde cada papel pode ver</p>
        </div>
        <button onClick={() => setNovo(true)} className="btn-primario">
          <Plus size={16} /> Novo funcionário
        </button>
      </div>

      <FiltroRede filtro={filtro} aoMudar={setFiltro} comPeriodo={false} />
      {erro && <p className="text-[12px] text-red-600 mb-4">{erro}</p>}

      {/* Teto por papel e unidade */}
      <section className="cartao overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-neutro-100 dark:border-neutro-800 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="titulo-secao flex items-center gap-2"><Lock size={14} className="text-brand-600" /> Teto de acesso</h2>
            <p className="text-[11.5px] text-neutro-400 mt-0.5 max-w-xl">
              O máximo de telas que cada papel pode abrir na unidade. O dono da clínica só libera dentro deste limite.
            </p>
          </div>
          <div className="flex gap-2">
            {PAPEIS.map(([papel, rotulo]) => (
              <button key={papel} onClick={() => setEditandoTeto({ papel, unidades: unidades.map((u) => u.id) })}
                className="btn-suave !text-[12px] !py-1.5">
                <LayoutGrid size={13} /> {rotulo}s em lote
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[560px]">
            <thead>
              <tr className="text-left border-b border-neutro-100 dark:border-neutro-800">
                <th className="rotulo-kpi font-medium px-5 py-2.5">Unidade</th>
                {PAPEIS.map(([, r]) => <th key={r} className="rotulo-kpi font-medium px-5 py-2.5">{r}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutro-100 dark:divide-neutro-800">
              {unidades.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3 font-medium">{u.nome}</td>
                  {PAPEIS.map(([papel]) => {
                    const teto = tetoDe(u.id, papel)
                    return (
                      <td key={papel} className="px-5 py-3">
                        <button onClick={() => setEditandoTeto({ papel, unidades: [u.id] })}
                          title={teto ? teto.map(rotuloTela).join(', ') : 'Sem limite do gestor'}
                          className={`etiqueta transition-colors ${
                            teto
                              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                              : 'bg-neutro-100 text-neutro-500 dark:bg-neutro-800 hover:text-neutro-700'
                          }`}>
                          {teto ? `${teto.length} de ${TELAS_CONFIGURAVEIS.length} telas` : 'Sem teto'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pessoas, por unidade */}
      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="esqueleto h-[70px]" />)}</div>
      ) : (
        <div className="space-y-5">
          {unidades.map((un) => {
            const daUnidade = usuarios.filter((u) => u.consultorioId === un.id)
            return (
              <section key={un.id}>
                <h3 className="flex items-center gap-2 text-[12px] font-semibold tracking-wider uppercase text-neutro-500 mb-2">
                  <Building2 size={13} /> {un.nome}
                  <span className="text-neutro-400 font-medium normal-case tracking-normal">· {daUnidade.length}</span>
                </h3>
                <div className="space-y-2">
                  {daUnidade.length === 0 && <p className="text-[12px] text-neutro-400">Ninguém cadastrado.</p>}
                  {daUnidade.map((u) => (
                    <div key={u.id} className="cartao px-4 py-3 flex flex-wrap items-center gap-3">
                      <Avatar nome={u.nome} fotoUrl={u.fotoUrl} tamanho={36} />
                      <div className="flex-1 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <p className="text-[13.5px] font-medium truncate">{u.nome}</p>
                          {u.papel === 'DONO' && <ShieldCheck size={13} className="text-brand-600" strokeWidth={2.2} />}
                          {!u.ativo && (
                            <span className="etiqueta bg-neutro-100 text-neutro-500 dark:bg-neutro-800"><Ban size={10} /> Inativo</span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-neutro-400 truncate">{u.email}</p>
                      </div>
                      <span className="etiqueta bg-neutro-100 text-neutro-600 dark:bg-neutro-800 dark:text-neutro-400">
                        {rotuloPapel[u.papel] ?? u.papel}
                      </span>
                      {u.papel !== 'DONO' && (
                        <>
                          <button onClick={() => ajustar(u, { atendePacientes: !u.atendePacientes })} disabled={ocupado === u.id}
                            className={`etiqueta transition-colors ${u.atendePacientes
                              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                              : 'bg-neutro-100 text-neutro-400 dark:bg-neutro-800'}`}>
                            <Stethoscope size={11} /> {u.atendePacientes ? 'Atende' : 'Não atende'}
                          </button>
                          {u.ativo && (
                            <button onClick={() => setEditandoPessoa(u)}
                              className={`etiqueta transition-colors ${u.telas?.length
                                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                                : 'bg-neutro-100 text-neutro-500 dark:bg-neutro-800 hover:text-neutro-700'}`}>
                              <LayoutGrid size={11} /> Telas
                            </button>
                          )}
                          {u.ativo ? (
                            <button onClick={() => confirm(`Desativar o acesso de ${u.nome}? O histórico é preservado.`) && ajustar(u, { ativo: false })}
                              disabled={ocupado === u.id} title="Desativar acesso"
                              className="btn-icone !w-8 !h-8 hover:!text-amber-600 hover:!bg-amber-50 dark:hover:!bg-amber-950/40">
                              {ocupado === u.id ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={15} />}
                            </button>
                          ) : (
                            <button onClick={() => ajustar(u, { ativo: true })} disabled={ocupado === u.id} title="Reativar acesso"
                              className="btn-icone !w-8 !h-8 hover:!text-brand-600 hover:!bg-brand-50 dark:hover:!bg-brand-900/30">
                              <RotateCcw size={15} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <ModalTeto alvo={editandoTeto} unidades={todasUnidades} tetos={tetos}
        aoFechar={() => setEditandoTeto(null)} aoSalvar={() => { setEditandoTeto(null); mutate() }} />
      <ModalTelasPessoa usuario={editandoPessoa} teto={editandoPessoa ? tetoDe(editandoPessoa.consultorioId, editandoPessoa.papel) : null}
        aoFechar={() => setEditandoPessoa(null)} aoSalvar={() => { setEditandoPessoa(null); mutate() }} />
      <ModalNovo aberto={novo} unidades={todasUnidades} aoFechar={() => setNovo(false)}
        aoSalvar={() => { setNovo(false); mutate() }} />
    </div>
  )
}

/* ─────────── Modais ─────────── */

function Moldura({ aberto, titulo, subtitulo, aoFechar, children }: any) {
  return (
    <AnimatePresence>
      {aberto && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.2 }}
            className="cartao w-full max-w-lg p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold">{titulo}</h2>
                {subtitulo && <p className="text-[12px] text-neutro-400 mt-0.5">{subtitulo}</p>}
              </div>
              <button type="button" onClick={aoFechar} className="btn-icone !w-8 !h-8 shrink-0"><X size={18} /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function GradeTelas({ marcadas, alternar, bloqueadas = [] }: { marcadas: string[]; alternar: (h: string) => void; bloqueadas?: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TELAS_CONFIGURAVEIS.map((t) => {
        const travada = bloqueadas.includes(t.href)
        const ligada = !travada && marcadas.includes(t.href)
        return (
          <button key={t.href} type="button" disabled={travada} onClick={() => alternar(t.href)}
            title={travada ? 'Fora do teto definido para este papel' : undefined}
            className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-[13px] font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
              ligada
                ? 'border-brand-400 bg-brand-50 text-brand-800 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-700'
                : 'border-neutro-200 dark:border-neutro-700 text-neutro-500'
            }`}>
            {t.rotulo}
            {travada ? <Lock size={14} className="shrink-0" /> : ligada
              ? <ToggleRight size={18} className="text-brand-500 shrink-0" strokeWidth={2} />
              : <ToggleLeft size={18} className="shrink-0" strokeWidth={2} />}
          </button>
        )
      })}
    </div>
  )
}

function ModalTeto({ alvo, unidades, tetos, aoFechar, aoSalvar }: any) {
  const [escolhidas, setEscolhidas] = useState<string[]>([])
  const [telas, setTelas] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!alvo) return
    setEscolhidas(alvo.unidades)
    // Ponto de partida: o teto atual da primeira unidade, ou o padrão do papel.
    const atual = tetos.find((t: any) => t.consultorioId === alvo.unidades[0] && t.papel === alvo.papel)?.telas
    setTelas(atual ?? telasPadrao(alvo.papel as PapelUsuario))
    setErro(null)
  }, [alvo, tetos])

  async function salvar(valor: string[] | null) {
    setSalvando(true); setErro(null)
    try {
      await enviar('/api/gestor/tetos', 'PUT', { consultorioIds: escolhidas, papel: alvo.papel, telas: valor })
      aoSalvar()
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  const alternar = (lista: string[], x: string) => lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x]

  return (
    <Moldura aberto={!!alvo} aoFechar={aoFechar}
      titulo={`Teto · ${alvo ? rotuloPapel[alvo.papel] : ''}`}
      subtitulo="O máximo que este papel pode abrir nas unidades marcadas.">
      <div>
        <p className="rotulo mb-1.5">Unidades</p>
        <div className="flex flex-wrap gap-1.5">
          {unidades.map((u: any) => {
            const marcada = escolhidas.includes(u.id)
            return (
              <button key={u.id} type="button" onClick={() => setEscolhidas((e) => alternar(e, u.id))}
                className={`px-2.5 py-1.5 rounded-lg border text-[12px] font-medium transition-colors ${
                  marcada ? 'border-brand-400 bg-brand-50 text-brand-800 dark:bg-brand-900/20 dark:text-brand-300' : 'border-neutro-200 dark:border-neutro-700 text-neutro-500'
                }`}>
                {u.nome}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <p className="rotulo mb-1.5">Telas permitidas</p>
        <GradeTelas marcadas={telas} alternar={(h) => setTelas((t) => alternar(t, h))} />
      </div>
      <p className="text-[11px] text-neutro-400">Vale em até um minuto, sem ninguém precisar sair do sistema.</p>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => salvar(null)} disabled={salvando || escolhidas.length === 0}
          className="text-[12px] text-neutro-400 hover:text-neutro-600 disabled:opacity-40 flex items-center gap-1">
          <RotateCcw size={12} /> Remover teto
        </button>
        <button type="button" onClick={() => salvar(telas)} disabled={salvando || escolhidas.length === 0} className="btn-primario">
          {salvando && <Loader2 size={14} className="animate-spin" />} Aplicar em {escolhidas.length} unidade{escolhidas.length === 1 ? '' : 's'}
        </button>
      </div>
    </Moldura>
  )
}

function ModalTelasPessoa({ usuario, teto, aoFechar, aoSalvar }: any) {
  const [marcadas, setMarcadas] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (usuario) { setMarcadas(usuario.telas?.length ? usuario.telas : telasPadrao(usuario.papel)); setErro(null) }
  }, [usuario])

  const bloqueadas = teto ? TELAS_CONFIGURAVEIS.map((t) => t.href).filter((h) => !teto.includes(h)) : []

  async function salvar(telas: string[]) {
    setSalvando(true); setErro(null)
    try {
      await enviar(`/api/gestor/equipe/${usuario.id}`, 'PATCH', { telas })
      aoSalvar()
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  return (
    <Moldura aberto={!!usuario} aoFechar={aoFechar} titulo={`Acesso de ${usuario?.nome ?? ''}`}
      subtitulo={teto ? 'Telas com cadeado estão fora do teto deste papel.' : 'Sem teto para este papel nesta unidade.'}>
      <GradeTelas marcadas={marcadas} bloqueadas={bloqueadas}
        alternar={(h) => setMarcadas((m) => m.includes(h) ? m.filter((x) => x !== h) : [...m, h])} />
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => salvar([])} disabled={salvando}
          className="text-[12px] text-neutro-400 hover:text-neutro-600 flex items-center gap-1">
          <RotateCcw size={12} /> Padrão do papel
        </button>
        <button type="button" onClick={() => salvar(marcadas.filter((m) => !bloqueadas.includes(m)))}
          disabled={salvando} className="btn-primario">
          {salvando && <Loader2 size={14} className="animate-spin" />} Salvar acesso
        </button>
      </div>
    </Moldura>
  )
}

function gerarSenha() {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => letras[b % letras.length]).join('')
}

function ModalNovo({ aberto, unidades, aoFechar, aoSalvar }: any) {
  const vazio = { consultorioId: '', nome: '', email: '', senha: '', papel: 'ATENDENTE', atendePacientes: false }
  const [form, setForm] = useState<any>(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [criado, setCriado] = useState<{ email: string; senha: string } | null>(null)

  useEffect(() => {
    if (aberto) { setForm({ ...vazio, consultorioId: unidades[0]?.id ?? '', senha: gerarSenha() }); setErro(null); setCriado(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null)
    try {
      await enviar('/api/gestor/equipe', 'POST', form)
      setCriado({ email: form.email, senha: form.senha })
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  if (criado) {
    return (
      <Moldura aberto={aberto} aoFechar={aoSalvar} titulo="Acesso criado" subtitulo="Envie estes dados à pessoa. A senha não aparece de novo.">
        <div className="rounded-lg bg-neutro-50 dark:bg-neutro-950/40 border border-neutro-200 dark:border-neutro-800 px-4 py-3 text-[13px] space-y-1">
          <p><span className="text-neutro-400">E-mail:</span> {criado.email}</p>
          <p><span className="text-neutro-400">Senha provisória:</span> <span className="font-mono">{criado.senha}</span></p>
        </div>
        <button onClick={aoSalvar} className="btn-primario w-full justify-center">Pronto</button>
      </Moldura>
    )
  }

  return (
    <Moldura aberto={aberto} aoFechar={aoFechar} titulo="Novo funcionário">
      <form onSubmit={salvar} className="space-y-3">
        <div>
          <label className="rotulo">Unidade</label>
          <select className="campo" required value={form.consultorioId}
            onChange={(e) => setForm({ ...form, consultorioId: e.target.value })}>
            {unidades.map((u: any) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="rotulo">Nome</label>
            <input className="campo" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <label className="rotulo">E-mail</label>
            <input type="email" className="campo" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="rotulo">Papel</label>
            <select className="campo" value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value })}>
              {PAPEIS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo">Senha provisória</label>
            <input className="campo font-mono" required minLength={8} value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2.5 text-[13px] cursor-pointer">
          <input type="checkbox" checked={form.atendePacientes} onChange={(e) => setForm({ ...form, atendePacientes: e.target.checked })} />
          Atende pacientes
        </label>
        {erro && <p className="text-xs text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={aoFechar} className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn-primario">
            {salvando && <Loader2 size={14} className="animate-spin" />} Criar acesso
          </button>
        </div>
      </form>
    </Moldura>
  )
}
