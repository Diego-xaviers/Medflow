'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Loader2, ShieldCheck, Stethoscope, CalendarDays, Eye, Ban,
  UserMinus, RotateCcw, Trash2, LayoutGrid, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { TELAS_CONFIGURAVEIS, telasPadrao } from '@/lib/permissoes'
import Avatar from '@/components/Avatar'
import { fetcher, enviar } from '@/lib/fetcher'

const vazio = { nome: '', email: '', senha: '', papel: 'ATENDENTE', atendePacientes: false }

const rotuloPapel: Record<string, string> = {
  DONO: 'Dono', ATENDENTE: 'Atendente', VENDEDORA: 'Vendedora',
}

/** O que cada papel enxerga. Escrito aqui porque é a dúvida de quem cadastra. */
const alcance: Record<string, string> = {
  DONO: 'Vê e edita tudo, inclusive equipe, configurações e relatórios.',
  ATENDENTE: 'Toca a operação inteira: agenda, pacientes, prontuários, receitas e financeiro. Não administra a equipe.',
  VENDEDORA: 'Vê apenas a agenda — quem vem, quando e com quem. Não abre prontuário, receita nem financeiro.',
}

export default function EquipePage() {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ajustando, setAjustando] = useState<string | null>(null)
  const [editandoTelas, setEditandoTelas] = useState<any | null>(null)

  const { data: usuarios, isLoading, mutate } = useSWR('/api/usuarios', fetcher)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null)
    try {
      await enviar('/api/usuarios', 'POST', form)
      setModal(false); setForm(vazio); mutate()
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  async function alternarAtendimento(u: any) {
    setAjustando(u.id)
    try {
      await enviar(`/api/usuarios/${u.id}`, 'PATCH', { atendePacientes: !u.atendePacientes })
      mutate()
    } catch (e: any) { setErro(e.message) } finally { setAjustando(null) }
  }

  /** Tira o acesso sem apagar o histórico — é o "retirar licença". */
  async function desativar(u: any) {
    if (!confirm(
      `Desativar o acesso de ${u.nome}?\n\n` +
      'A pessoa deixa de entrar no sistema na hora. Os atendimentos, prontuários ' +
      'e receitas que ela registrou continuam guardados, e o acesso pode ser ' +
      'reativado quando você quiser.'
    )) return

    setAjustando(u.id)
    try {
      await enviar(`/api/usuarios/${u.id}`, 'DELETE')
      mutate()
    } catch (e: any) { setErro(e.message) } finally { setAjustando(null) }
  }

  async function reativar(u: any) {
    setAjustando(u.id)
    try {
      await enviar(`/api/usuarios/${u.id}`, 'PATCH', { ativo: true })
      mutate()
    } catch (e: any) { setErro(e.message) } finally { setAjustando(null) }
  }

  /** Apaga de vez. Só passa para quem nunca atendeu — o servidor confere. */
  async function apagar(u: any) {
    if (!confirm(
      `Apagar ${u.nome} definitivamente?\n\n` +
      'Some do sistema sem deixar rastro. Só funciona para quem nunca registrou ' +
      'atendimento — nesse caso, use "Desativar" para preservar o histórico.'
    )) return

    setAjustando(u.id)
    try {
      await enviar(`/api/usuarios/${u.id}?definitivo=1`, 'DELETE')
      mutate()
    } catch (e: any) { setErro(e.message) } finally { setAjustando(null) }
  }

  return (
    <div className="p-4 sm:p-7 max-w-[1000px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="titulo-pagina">Equipe</h1>
          <p className="subtitulo">Quem tem acesso ao seu consultório, e até onde</p>
        </div>
        <button onClick={() => { setForm(vazio); setModal(true) }} className="btn-primario">
          <Plus size={16} /> Novo usuário
        </button>
      </div>

      {erro && !modal && <p className="text-[12px] text-red-600 mb-4">{erro}</p>}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="esqueleto h-[76px]" />)}
        </div>
      ) : (
        <div className="space-y-2.5">
          {usuarios?.map((u: any) => (
            <div key={u.id} className="cartao px-5 py-4 flex flex-wrap items-center gap-4">
              <Avatar nome={u.nome} fotoUrl={u.fotoUrl} tamanho={40} />

              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{u.nome}</p>
                  {u.papel === 'DONO' && (
                    <ShieldCheck size={13} className="text-brand-600 shrink-0" strokeWidth={2.2} />
                  )}
                  {!u.ativo && (
                    <span className="etiqueta bg-neutro-100 text-neutro-500 dark:bg-neutro-800">
                      <Ban size={10} strokeWidth={2} /> Inativo
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutro-400 truncate">{u.email}</p>
                <p className="text-[11px] text-neutro-400 mt-1 max-w-[520px]">
                  {u.telas?.length
                    ? `Acesso personalizado: ${TELAS_CONFIGURAVEIS.filter((t) => u.telas.includes(t.href)).map((t) => t.rotulo).join(', ')}.`
                    : alcance[u.papel]}
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span className="etiqueta bg-neutro-100 text-neutro-600 dark:bg-neutro-800 dark:text-neutro-400">
                  {u.papel === 'VENDEDORA' ? <CalendarDays size={11} strokeWidth={2} /> : <Eye size={11} strokeWidth={2} />}
                  {rotuloPapel[u.papel]}
                </span>

                {/* Atender pacientes é atribuição, não nível de acesso: quem
                    estiver marcado aparece no link público de agendamento. */}
                <button onClick={() => alternarAtendimento(u)} disabled={ajustando === u.id}
                  title={u.atendePacientes
                    ? 'Aparece como profissional no link público'
                    : 'Marcar como profissional que atende'}
                  className={`etiqueta transition-colors disabled:opacity-50 ${
                    u.atendePacientes
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                      : 'bg-neutro-100 text-neutro-400 dark:bg-neutro-800 hover:text-neutro-600'
                  }`}>
                  {ajustando === u.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : <Stethoscope size={11} strokeWidth={2} />}
                  {u.atendePacientes ? 'Atende' : 'Não atende'}
                </button>

                {u.papel !== 'DONO' && u.ativo && (
                  <button onClick={() => setEditandoTelas(u)}
                    title="Escolher as telas que esta pessoa acessa"
                    className={`etiqueta transition-colors ${
                      u.telas?.length
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                        : 'bg-neutro-100 text-neutro-500 dark:bg-neutro-800 hover:text-neutro-700'
                    }`}>
                    <LayoutGrid size={11} strokeWidth={2} /> Telas
                  </button>
                )}

                {/* Retirar a licença: desativa e preserva o histórico. Apagar
                    de vez só aparece para quem nunca atendeu. */}
                {u.papel !== 'DONO' && (
                  u.ativo ? (
                    <button onClick={() => desativar(u)} disabled={ajustando === u.id}
                      title="Tirar o acesso, mantendo o histórico"
                      className="btn-icone !w-8 !h-8 hover:!text-amber-600 hover:!bg-amber-50 dark:hover:!bg-amber-950/40">
                      <UserMinus size={15} strokeWidth={2} />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => reativar(u)} disabled={ajustando === u.id}
                        title="Devolver o acesso"
                        className="btn-icone !w-8 !h-8 hover:!text-brand-600 hover:!bg-brand-50 dark:hover:!bg-brand-900/30">
                        <RotateCcw size={15} strokeWidth={2} />
                      </button>
                      <button onClick={() => apagar(u)} disabled={ajustando === u.id}
                        title="Apagar definitivamente"
                        className="btn-icone !w-8 !h-8 hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950/40">
                        <Trash2 size={15} strokeWidth={2} />
                      </button>
                    </>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-neutro-400 mt-6">
        Vendedoras aparecem como opção de responsável no link público. Quem está
        marcado como <strong className="font-medium">Atende</strong> aparece como
        profissional escolhível pelo paciente.
      </p>

      <ModalTelas usuario={editandoTelas} aoFechar={() => setEditandoTelas(null)}
        aoSalvar={() => { setEditandoTelas(null); mutate() }} />

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <motion.form onSubmit={salvar}
              initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.2 }}
              className="cartao w-full max-w-md p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold">Novo usuário</h2>
                <button type="button" onClick={() => setModal(false)} className="btn-icone !w-8 !h-8">
                  <X size={18} />
                </button>
              </div>

              <div>
                <label className="rotulo">Nome</label>
                <input className="campo" required value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <label className="rotulo">E-mail</label>
                <input type="email" className="campo" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="rotulo">Senha provisória</label>
                <input type="text" className="campo" required minLength={8} value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  placeholder="Mínimo 8 caracteres" />
                <p className="text-[11px] text-neutro-400 mt-1.5">
                  A pessoa troca por uma senha própria em Perfil, no primeiro acesso.
                </p>
              </div>
              <div>
                <label className="rotulo">Papel</label>
                <select className="campo" value={form.papel}
                  onChange={(e) => setForm({ ...form, papel: e.target.value })}>
                  <option value="ATENDENTE">Atendente</option>
                  <option value="VENDEDORA">Vendedora</option>
                </select>
                <p className="text-[11px] text-neutro-400 mt-1.5">{alcance[form.papel]}</p>
              </div>

              <label className="flex items-start gap-2.5 text-[13px] cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={form.atendePacientes}
                  onChange={(e) => setForm({ ...form, atendePacientes: e.target.checked })} />
                <span>
                  Atende pacientes
                  <span className="block text-[11px] text-neutro-400">
                    Passa a aparecer como profissional escolhível no agendamento online.
                  </span>
                </span>
              </label>

              {erro && <p className="text-xs text-red-600">{erro}</p>}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModal(false)}
                  className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} className="btn-primario">
                  {salvando && <Loader2 size={14} className="animate-spin" />} Criar
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** O dono liga e desliga as telas de uma pessoa da equipe. */
function ModalTelas({ usuario, aoFechar, aoSalvar }: { usuario: any; aoFechar: () => void; aoSalvar: () => void }) {
  const [marcadas, setMarcadas] = useState<string[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (usuario) {
      setMarcadas(usuario.telas?.length ? usuario.telas : telasPadrao(usuario.papel))
      setErro(null)
    }
  }, [usuario])

  const alternar = (href: string) =>
    setMarcadas((m) => (m.includes(href) ? m.filter((x) => x !== href) : [...m, href]))
  // Telas fora do teto do gestor da rede não podem ser liberadas aqui.
  const bloqueadas: string[] = usuario?.teto ? TELAS_CONFIGURAVEIS.map((t) => t.href).filter((h) => !usuario.teto.includes(h)) : []

  async function salvar(telas: string[]) {
    setSalvando(true); setErro(null)
    try {
      await enviar(`/api/usuarios/${usuario.id}`, 'PATCH', { telas })
      aoSalvar()
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  // Igual ao padrão do papel = guarda vazio, para seguir o papel se ele mudar.
  const padrao = usuario ? telasPadrao(usuario.papel) : []
  const ehPadrao = marcadas.length === padrao.length && padrao.every((t) => marcadas.includes(t))

  return (
    <AnimatePresence>
      {usuario && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.2 }}
            className="cartao w-full max-w-md p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold">Acesso de {usuario.nome}</h2>
                <p className="text-[12px] text-neutro-400 mt-0.5">Marque as telas que esta pessoa pode abrir.</p>
              </div>
              <button type="button" onClick={aoFechar} className="btn-icone !w-8 !h-8"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {TELAS_CONFIGURAVEIS.map((t) => {
                const travada = bloqueadas.includes(t.href)
                const ligada = !travada && marcadas.includes(t.href)
                return (
                  <button key={t.href} type="button" onClick={() => alternar(t.href)} disabled={travada}
                    title={travada ? 'Bloqueada pelo gestor da rede' : undefined}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-[13px] font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
                      ligada
                        ? 'border-brand-400 bg-brand-50 text-brand-800 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-700'
                        : 'border-neutro-200 dark:border-neutro-700 text-neutro-500'
                    }`}>
                    {t.rotulo}
                    {ligada
                      ? <ToggleRight size={18} className="text-brand-500 shrink-0" strokeWidth={2} />
                      : <ToggleLeft size={18} className="shrink-0" strokeWidth={2} />}
                  </button>
                )
              })}
            </div>

            <p className="text-[11px] text-neutro-400">
              {bloqueadas.length > 0 && 'Telas apagadas foram bloqueadas pelo gestor da rede. '}
              Perfil e Suporte ficam sempre liberados. Equipe, Configurações e Cobrança seguem o papel.
              A mudança vale em até um minuto, sem a pessoa precisar sair do sistema.
            </p>

            {erro && <p className="text-xs text-red-600">{erro}</p>}

            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => salvar([])} disabled={salvando || !usuario.telas?.length}
                className="text-[12px] text-neutro-400 hover:text-neutro-600 disabled:opacity-40 flex items-center gap-1">
                <RotateCcw size={12} strokeWidth={2} /> Padrão do papel
              </button>
              <button type="button" onClick={() => salvar(ehPadrao ? [] : marcadas.filter((m) => !bloqueadas.includes(m)))}
                disabled={salvando || marcadas.length === 0} className="btn-primario">
                {salvando && <Loader2 size={14} className="animate-spin" />} Salvar acesso
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
