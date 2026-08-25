'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Loader2, ShieldCheck, Stethoscope, CalendarDays, Eye, Ban,
} from 'lucide-react'
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

  return (
    <div className="p-7 max-w-[1000px]">
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
                  {alcance[u.papel]}
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

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <motion.form onSubmit={salvar}
              initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.2 }}
              className="cartao w-full max-w-md p-6 space-y-4">
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
