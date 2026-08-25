'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Plus, X, Loader2, Link2, Check, Users, CalendarCheck2,
  UserRound, KeyRound, Copy, ExternalLink,
} from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'
import { data } from '@/lib/formato'

const vazio = {
  nomeConsultorio: '', telefone: '', endereco: '',
  nomeDono: '', emailDono: '', senhaDono: '',
}

/** Senha provisória legível: quem recebe vai digitar isso no celular. */
function gerarSenha() {
  const silabas = ['ma', 're', 'lu', 'to', 'sa', 'vi', 'no', 'pe', 'ca', 'de']
  const palavra = Array.from({ length: 3 }, () => silabas[Math.floor(Math.random() * silabas.length)]).join('')
  return `${palavra}${Math.floor(10 + Math.random() * 90)}`
}

/**
 * Área do dono do SaaS.
 *
 * É por aqui que um consultório novo entra no sistema: o cadastro cria a
 * clínica e o acesso do optometrista na mesma transação, porque consultório
 * sem dono seria um registro inacessível.
 */
export default function AdminPage() {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<any>(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [criado, setCriado] = useState<any>(null)

  const { data: consultorios, isLoading, mutate } = useSWR('/api/admin/consultorios', fetcher)

  function abrir() {
    setForm({ ...vazio, senhaDono: gerarSenha() })
    setErro(null)
    setCriado(null)
    setModal(true)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null)
    try {
      const novo = await enviar('/api/admin/consultorios', 'POST', form)
      // Guardamos a senha em memória só para esta tela: depois de fechada,
      // não existe mais como recuperá-la — o banco guarda só o hash.
      setCriado({ ...novo, senha: form.senhaDono, email: form.emailDono })
      mutate()
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  return (
    <div className="p-7 max-w-[1100px]">
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="titulo-pagina">Consultórios</h1>
          <p className="subtitulo mt-1">Cada clínica no Medflow, com seus dados isolados</p>
        </div>
        <button onClick={abrir} className="btn-primario">
          <Plus size={16} strokeWidth={2.2} /> Novo consultório
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => <div key={i} className="esqueleto h-[96px]" />)}
        </div>
      ) : consultorios?.length === 0 ? (
        <div className="cartao py-20 flex flex-col items-center">
          <Building2 size={24} className="text-neutro-300 dark:text-neutro-700 mb-3" strokeWidth={1.7} />
          <p className="text-[14px] font-medium">Nenhum consultório ainda</p>
          <p className="text-[12px] text-neutro-400 mt-1">
            Cadastre o primeiro para liberar o acesso de um profissional.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {consultorios?.map((c: any) => <Cartao key={c.id} consultorio={c} />)}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.2 }}
              className="cartao w-full max-w-lg p-6 my-auto">

              {criado ? (
                <AcessoCriado dados={criado} aoFechar={() => { setModal(false); setCriado(null) }} />
              ) : (
                <form onSubmit={salvar} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[16px] font-semibold">Novo consultório</h2>
                    <button type="button" onClick={() => setModal(false)} className="btn-icone !w-8 !h-8">
                      <X size={18} />
                    </button>
                  </div>

                  <p className="text-[11px] font-semibold tracking-wider text-brand-600 dark:text-brand-400">
                    A CLÍNICA
                  </p>
                  <div>
                    <label className="rotulo">Nome do consultório</label>
                    <input className="campo" required minLength={2} value={form.nomeConsultorio}
                      onChange={(e) => setForm({ ...form, nomeConsultorio: e.target.value })}
                      placeholder="Ótica Central" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="rotulo">Telefone</label>
                      <input className="campo" value={form.telefone}
                        onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                        placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                      <label className="rotulo">Endereço</label>
                      <input className="campo" value={form.endereco}
                        onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                        placeholder="Rua, número — bairro" />
                    </div>
                  </div>

                  <p className="text-[11px] font-semibold tracking-wider text-brand-600 dark:text-brand-400 pt-2">
                    O OPTOMETRISTA RESPONSÁVEL
                  </p>
                  <div>
                    <label className="rotulo">Nome</label>
                    <input className="campo" required minLength={2} value={form.nomeDono}
                      onChange={(e) => setForm({ ...form, nomeDono: e.target.value })} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="rotulo">E-mail de acesso</label>
                      <input type="email" className="campo" required value={form.emailDono}
                        onChange={(e) => setForm({ ...form, emailDono: e.target.value })} />
                    </div>
                    <div>
                      <label className="rotulo">Senha provisória</label>
                      <div className="flex gap-2">
                        <input className="campo" required minLength={8} value={form.senhaDono}
                          onChange={(e) => setForm({ ...form, senhaDono: e.target.value })} />
                        <button type="button" onClick={() => setForm({ ...form, senhaDono: gerarSenha() })}
                          title="Gerar outra" className="btn-suave !px-3 shrink-0 mt-1.5">
                          <KeyRound size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-neutro-400">
                    Ele entra com essa senha e troca por uma própria em Perfil. Já
                    nasce marcado como quem atende, então o link público funciona
                    desde o primeiro minuto.
                  </p>

                  {erro && <p className="text-[12px] text-red-600">{erro}</p>}

                  <div className="flex justify-end gap-3 pt-1">
                    <button type="button" onClick={() => setModal(false)}
                      className="btn text-neutro-500 hover:bg-neutro-100 dark:hover:bg-neutro-800">
                      Cancelar
                    </button>
                    <button type="submit" disabled={salvando} className="btn-primario">
                      {salvando && <Loader2 size={14} className="animate-spin" />} Criar consultório
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Um consultório na lista, com o link público pronto para copiar. */
function Cartao({ consultorio: c }: { consultorio: any }) {
  const [copiado, setCopiado] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/agendar/${c.slug}` : ''

  function copiar() {
    navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="cartao px-5 py-4 flex flex-wrap items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-700/20 text-brand-600 flex items-center justify-center shrink-0">
        <Building2 size={18} strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-[200px]">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{c.nome}</p>
          {!c.ativo && (
            <span className="etiqueta bg-neutro-100 text-neutro-500 dark:bg-neutro-800">Inativo</span>
          )}
        </div>
        <p className="text-[11.5px] text-neutro-400 font-mono truncate">/agendar/{c.slug}</p>
        <p className="text-[11px] text-neutro-400 mt-0.5">Desde {data(c.criadoEm)}</p>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <Metrica icone={UserRound} valor={c._count.usuarios} rotulo="equipe" />
        <Metrica icone={Users} valor={c._count.pacientes} rotulo="pacientes" />
        <Metrica icone={CalendarCheck2} valor={c._count.consultas} rotulo="consultas" />
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={copiar} title="Copiar link público" className="btn-icone !w-8 !h-8">
          {copiado ? <Check size={15} className="text-brand-600" /> : <Link2 size={15} />}
        </button>
        <a href={url} target="_blank" rel="noreferrer" title="Abrir link público"
          className="btn-icone !w-8 !h-8">
          <ExternalLink size={15} />
        </a>
      </div>
    </div>
  )
}

function Metrica({ icone: Icone, valor, rotulo }: { icone: any; valor: number; rotulo: string }) {
  return (
    <div className="text-center">
      <p className="text-[15px] font-semibold numerico leading-none">{valor}</p>
      <p className="text-[10px] text-neutro-400 mt-1 flex items-center gap-1 justify-center">
        <Icone size={9} strokeWidth={2} /> {rotulo}
      </p>
    </div>
  )
}

/**
 * Tela de entrega do acesso.
 *
 * Esta é a única vez que a senha aparece: o banco guarda só o hash. Por isso
 * o bloco é grande, copiável de uma vez e avisa que não haverá segunda chance.
 */
function AcessoCriado({ dados, aoFechar }: { dados: any; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}` : ''

  const recado = [
    `Acesso ao Medflow — ${dados.nome}`,
    '',
    `Endereço: ${url}/login`,
    `E-mail: ${dados.email}`,
    `Senha provisória: ${dados.senha}`,
    '',
    `Link público de agendamento: ${url}/agendar/${dados.slug}`,
    '',
    'Troque a senha no primeiro acesso, em Perfil.',
  ].join('\n')

  function copiar() {
    navigator.clipboard.writeText(recado)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center text-center pt-2">
        <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center mb-3">
          <Check size={24} strokeWidth={2.4} />
        </div>
        <h2 className="text-[16px] font-semibold">{dados.nome} está no ar</h2>
        <p className="text-[12.5px] text-neutro-500 mt-1">
          Copie o recado abaixo e mande para o profissional.
        </p>
      </div>

      <pre className="text-[11.5px] leading-relaxed bg-neutro-50 dark:bg-neutro-950/40 border border-neutro-200/70 dark:border-neutro-800 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
        {recado}
      </pre>

      <div className="flex items-start gap-2 text-[11.5px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-3.5 py-2.5">
        <KeyRound size={14} className="shrink-0 mt-0.5" strokeWidth={2} />
        A senha só aparece agora. Depois de fechar, o sistema guarda apenas o
        hash dela — se perder, o caminho é criar uma nova.
      </div>

      <div className="flex justify-end gap-2.5">
        <button onClick={copiar} className="btn-suave">
          {copiado ? <Check size={14} className="text-brand-600" /> : <Copy size={14} />}
          {copiado ? 'Copiado' : 'Copiar recado'}
        </button>
        <button onClick={aoFechar} className="btn-primario">Concluir</button>
      </div>
    </div>
  )
}
