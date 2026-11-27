'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Plus, X, Loader2, Link2, Check, Users, CalendarCheck2,
  UserRound, KeyRound, Copy, ExternalLink, Settings, Trash2, Wallet,
  LockOpen, Lock, Clock, AlertTriangle,
} from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'
import { data, moeda } from '@/lib/formato'
import RedesAdmin from '@/components/RedesAdmin'
import { prazoDaConfiguracao, textoDoRestante } from '@/lib/whatsappRegras'

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
  const [gerenciando, setGerenciando] = useState<string | null>(null)

  const { data: consultorios, isLoading, mutate } = useSWR('/api/admin/consultorios', fetcher)

  // Link das notificações: /admin?consultorio=<id> abre o detalhe direto.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('consultorio')
    if (id) setGerenciando(id)
  }, [])

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
    <div className="p-4 sm:p-7 max-w-[1100px]">
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="titulo-pagina">Consultórios</h1>
          <p className="subtitulo mt-1">Cada clínica no Medflow, com seus dados isolados</p>
        </div>
        <button onClick={abrir} className="btn-primario">
          <Plus size={16} strokeWidth={2.2} /> Novo consultório
        </button>
      </div>

      <ParametrosPix />

      <FilaInstancias consultorios={consultorios ?? []} aoConfigurar={setGerenciando} />

      <RedesAdmin consultorios={consultorios ?? []} />

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
          {consultorios?.map((c: any) => (
            <Cartao key={c.id} consultorio={c} aoGerenciar={() => setGerenciando(c.id)} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-neutro-900/30 backdrop-blur-sm flex items-start justify-center z-50 px-4 py-8 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.2 }}
              className="cartao w-full max-w-lg p-5 sm:p-6 my-auto">

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

      <PainelDoConsultorio
        id={gerenciando}
        aoFechar={() => setGerenciando(null)}
        aoMudar={() => mutate()}
      />
    </div>
  )
}

/** Um consultório na lista, com o link público pronto para copiar. */
function Cartao({ consultorio: c, aoGerenciar }: { consultorio: any; aoGerenciar: (c: any) => void }) {
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
        <button onClick={() => aoGerenciar(c)} title="Gerenciar consultório"
          className="btn-icone !w-8 !h-8 hover:!text-brand-600">
          <Settings size={15} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

/**
 * Gestão de um consultório: senha, faturas e o botão perigoso.
 *
 * Redefinir senha existe porque o caminho normal — a pessoa trocar sozinha em
 * Perfil — não serve para quem perdeu justamente o acesso. Quem cria o
 * consultório é quem consegue devolvê-lo.
 */
function PainelDoConsultorio({ id, aoFechar, aoMudar }: {
  id: string | null
  aoFechar: () => void
  aoMudar: () => void
}) {
  const { data: c, mutate } = useSWR(id ? `/api/admin/consultorios/${id}` : null, fetcher)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [senhaGerada, setSenhaGerada] = useState<{ nome: string; email: string; senha: string } | null>(null)
  const [confirmacao, setConfirmacao] = useState('')
  const [diaVencimento, setDiaVencimento] = useState<string>('')
  const [salvandoDia, setSalvandoDia] = useState(false)

  // Quando o painel carrega, sincroniza o diaVencimento com o do consultório
  useEffect(() => {
    if (c?.diaVencimento) setDiaVencimento(String(c.diaVencimento))
  }, [c?.diaVencimento])

  async function salvarDiaVencimento() {
    setSalvandoDia(true); setErro(null)
    try {
      const dia = diaVencimento ? parseInt(diaVencimento) : null
      await enviar(`/api/admin/consultorios/${id}`, 'PATCH', { diaVencimento: dia })
      await mutate()
    } catch (e: any) { setErro(e.message) } finally { setSalvandoDia(false) }
  }

  async function alternarAcessoLiberado() {
    setOcupado(true); setErro(null)
    try {
      await enviar(`/api/admin/consultorios/${id}`, 'PATCH', { acessoLiberado: !c.acessoLiberado })
      await mutate(); aoMudar()
    } catch (e: any) { setErro(e.message) } finally { setOcupado(false) }
  }

  async function redefinirSenha(usuario: any) {
    const senha = gerarSenha()
    setOcupado(true); setErro(null)
    try {
      await enviar(`/api/admin/consultorios/${id}`, 'PATCH', {
        redefinirSenha: { usuarioId: usuario.id, novaSenha: senha },
      })
      // Mostrada uma vez só: o banco guarda apenas o hash.
      setSenhaGerada({ nome: usuario.nome, email: usuario.email, senha })
    } catch (e: any) { setErro(e.message) } finally { setOcupado(false) }
  }


  // Plano salva no onChange: o servidor ajusta mensalidade e assinatura no Asaas junto.
  async function trocarPlano(novo: string) {
    setOcupado(true); setErro(null)
    try {
      await enviar(`/api/admin/consultorios/${id}`, 'PATCH', { plano: novo })
      await mutate(); aoMudar()
    } catch (e: any) { setErro(e.message) } finally { setOcupado(false) }
  }

  const [zId, setZId] = useState('')
  const [zToken, setZToken] = useState('')
  const [zLimite, setZLimite] = useState('')
  const [zCopiado, setZCopiado] = useState(false)
  useEffect(() => { setZLimite(c?.whatsapp ? String(c.whatsapp.limiteDiarioEnvios) : '') }, [c?.whatsapp?.limiteDiarioEnvios])

  async function salvarInstancia() {
    setOcupado(true); setErro(null)
    try {
      await enviar(`/api/admin/consultorios/${id}`, 'PATCH', { whatsapp: { instanciaId: zId, instanciaToken: zToken } })
      setZId(''); setZToken('') // o token nunca volta do servidor; limpa o campo
      await mutate(); aoMudar()
    } catch (e: any) { setErro(e.message) } finally { setOcupado(false) }
  }

  async function salvarLimite() {
    setOcupado(true); setErro(null)
    try {
      await enviar(`/api/admin/consultorios/${id}`, 'PATCH', { limiteDiarioEnvios: Number(zLimite) })
      await mutate()
    } catch (e: any) { setErro(e.message) } finally { setOcupado(false) }
  }

  async function copiarUrl() {
    try {
      await navigator.clipboard.writeText(c.whatsapp.urlWebhook)
      setZCopiado(true); setTimeout(() => setZCopiado(false), 2000)
    } catch { /* sem permissão de área de transferência: o campo é selecionável */ }
  }

  async function encerrarAssinatura() {
    if (!confirm('Cancelar a cobrança automática deste consultório no Asaas?\n\nCobranças já pagas continuam registradas.')) return
    setOcupado(true); setErro(null)
    try {
      await enviar(`/api/admin/consultorios/${id}`, 'PATCH', { cancelarAssinatura: true })
      await mutate()
    } catch (e: any) { setErro(e.message) } finally { setOcupado(false) }
  }

  async function alternarAtivo() {
    setOcupado(true); setErro(null)
    try {
      await enviar(`/api/admin/consultorios/${id}`, 'PATCH', { ativo: !c.ativo })
      await mutate(); aoMudar()
    } catch (e: any) { setErro(e.message) } finally { setOcupado(false) }
  }

  async function mudarFatura(faturaId: string, status: string) {
    setOcupado(true); setErro(null)
    try {
      await enviar(`/api/admin/faturas/${faturaId}`, 'PATCH', { status })
      await mutate(); aoMudar()
    } catch (e: any) { setErro(e.message) } finally { setOcupado(false) }
  }

  async function apagar() {
    setOcupado(true); setErro(null)
    try {
      const r = await enviar(
        `/api/admin/consultorios/${id}?confirmacao=${encodeURIComponent(confirmacao)}`,
        'DELETE'
      )
      aoMudar()
      aoFechar()
      alert(
        `"${r.apagado}" foi apagado.\n\n` +
        `Removidos: ${r.registrosRemovidos.pacientes} pacientes, ` +
        `${r.registrosRemovidos.consultas} consultas, ` +
        `${r.registrosRemovidos.prontuarios} prontuários e ` +
        `${r.registrosRemovidos.receitas} receitas.`
      )
    } catch (e: any) { setErro(e.message) } finally { setOcupado(false) }
  }

  return (
    <AnimatePresence>
      {id && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={aoFechar}
          className="fixed inset-0 bg-neutro-900/40 backdrop-blur-sm z-50 flex justify-end">
          <motion.aside onClick={(e) => e.stopPropagation()}
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 30, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg h-full bg-white dark:bg-neutro-900 border-l border-neutro-200 dark:border-neutro-800 overflow-y-auto">

            {!c ? (
              <div className="p-7 space-y-4">
                <div className="esqueleto h-6 w-48" />
                <div className="esqueleto h-32" />
              </div>
            ) : (
              <>
                <div className="sticky top-0 bg-white/95 dark:bg-neutro-900/95 backdrop-blur-xl border-b border-neutro-100 dark:border-neutro-800 px-6 py-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-semibold truncate">{c.nome}</h2>
                    <p className="text-[11.5px] text-neutro-400 font-mono truncate">/agendar/{c.slug}</p>
                  </div>
                  <button onClick={aoFechar} className="btn-icone !w-8 !h-8"><X size={17} /></button>
                </div>

                <div className="p-6 space-y-7">
                  {erro && <p className="text-[12px] text-red-600">{erro}</p>}

                  {/* Acessos */}
                  <section>
                    <h3 className="text-[11px] font-semibold tracking-wider text-brand-600 dark:text-brand-400 mb-3">
                      ACESSOS
                    </h3>
                    {senhaGerada && (
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-4 py-3 mb-3">
                        <p className="text-[12px] font-medium text-amber-800 dark:text-amber-300">
                          Nova senha de {senhaGerada.nome}
                        </p>
                        <p className="text-[13px] font-mono mt-1">{senhaGerada.senha}</p>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5">
                          Anote agora — depois de fechar, só resta gerar outra.
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      {c.usuarios.map((u: any) => (
                        <div key={u.id} className="flex items-center gap-3 rounded-lg border border-neutro-200/70 dark:border-neutro-800 px-3.5 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium truncate">{u.nome}</p>
                            <p className="text-[11.5px] text-neutro-400 truncate">{u.email}</p>
                          </div>
                          <span className="etiqueta bg-neutro-100 dark:bg-neutro-800 text-neutro-500 shrink-0">
                            {u.papel}
                          </span>
                          <button onClick={() => redefinirSenha(u)} disabled={ocupado}
                            title="Gerar nova senha" className="btn-icone !w-8 !h-8 shrink-0 hover:!text-brand-600">
                            <KeyRound size={14} strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Faturas */}
                  <section>
                    <h3 className="text-[11px] font-semibold tracking-wider text-brand-600 dark:text-brand-400 mb-3">
                      FATURAS
                    </h3>

                    {/* Cobrança automática pelo Asaas */}
                    <div className="mb-4 p-3 rounded-lg bg-neutro-50 dark:bg-neutro-950/40 border border-neutro-200/70 dark:border-neutro-800">
                      <label className="rotulo">Plano contratado</label>
                      <select className="campo" value={c.plano ?? 'PRO'} disabled={ocupado}
                        onChange={(e) => trocarPlano(e.target.value)}>
                        <option value="PRO">Pro — R$ 149 de tabela · 5 usuários</option>
                        <option value="ULTRA">Ultra — R$ 697 de tabela · usuários ilimitados</option>
                      </select>
                      <p className="text-[11px] text-neutro-500 mt-2">
                        O plano define o que o consultório enxerga e quanto paga. Trocar o plano
                        reajusta a mensalidade e a assinatura no Asaas automaticamente.
                      </p>
                    </div>

                    {c.plano === 'ULTRA' && c.whatsapp && (
                      <div className="mb-4 p-3 rounded-lg border border-brand-200 dark:border-brand-900 bg-brand-50/40 dark:bg-brand-900/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[12.5px] font-medium">WhatsApp (Z-API)</p>
                          <span className="etiqueta bg-neutro-100 dark:bg-neutro-800 text-neutro-500">
                            {({ SEM_INSTANCIA: 'Sem instância', EM_CONFIGURACAO: 'Em configuração', DESCONECTADO: 'Desconectado', CONECTADO: 'Conectado' } as Record<string, string>)[c.whatsapp.status] ?? c.whatsapp.status}
                            {c.whatsapp.numero ? ` · ${c.whatsapp.numero}` : ''}
                          </span>
                        </div>
                        <PrazoInstancia status={c.whatsapp.status} desde={c.whatsapp.configuracaoDesde} />
                        {!c.whatsapp.configurado && (
                          <ol className="text-[11.5px] text-neutro-600 dark:text-neutro-400 list-decimal list-inside space-y-0.5">
                            <li>
                              No painel da Z-API, crie uma instância com o nome da clínica.{' '}
                              <a href="https://app.z-api.io" target="_blank" rel="noreferrer"
                                className="text-brand-700 dark:text-brand-400 underline inline-flex items-center gap-0.5">
                                Abrir painel <ExternalLink size={10} />
                              </a>
                            </li>
                            <li>Copie o ID da instância e o Token e cole abaixo. Clique em Salvar instância.</li>
                            <li>Copie a URL do webhook que aparece e cole na instância em &quot;Ao receber&quot;, &quot;Ao conectar&quot; e &quot;Ao desconectar&quot;.</li>
                            <li>Pronto: a clínica é avisada e lê o código QR na tela do Assistente IA.</li>
                          </ol>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="rotulo">ID da instância</label>
                            <input className="campo" autoComplete="off" value={zId} onChange={(e) => setZId(e.target.value)}
                              placeholder={c.whatsapp.configurado ? 'Já configurado' : ''} />
                          </div>
                          <div>
                            <label className="rotulo">Token</label>
                            <input type="password" className="campo" autoComplete="new-password" value={zToken}
                              onChange={(e) => setZToken(e.target.value)}
                              placeholder={c.whatsapp.configurado ? 'Já configurado' : ''} />
                          </div>
                        </div>
                        <button type="button" onClick={salvarInstancia} disabled={ocupado || !zId.trim() || !zToken.trim()}
                          className="btn-suave !py-2 !px-3">
                          <Check size={13} /> Salvar instância
                        </button>
                        {c.whatsapp.configurado && (
                          c.whatsapp.urlWebhook ? (
                            <div>
                              <label className="rotulo">URL do webhook (colar em Ao receber, Ao conectar e Ao desconectar)</label>
                              <div className="flex items-center gap-2">
                                <input readOnly className="campo font-mono text-[11px]" value={c.whatsapp.urlWebhook}
                                  onFocus={(e) => e.currentTarget.select()} />
                                <button type="button" onClick={copiarUrl} className="btn-suave !py-2 !px-3 shrink-0">
                                  {zCopiado ? <Check size={13} /> : <Copy size={13} />}
                                  {zCopiado ? 'Copiado' : 'Copiar'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11.5px] text-amber-700 dark:text-amber-400">
                              Instância salva, mas a variável NEXTAUTH_URL não está definida: não dá para montar a URL do webhook.
                            </p>
                          )
                        )}
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="rotulo">Limite diário de envios</label>
                            <input type="number" min={1} max={100} className="campo" value={zLimite}
                              onChange={(e) => setZLimite(e.target.value)} />
                          </div>
                          <button type="button" onClick={salvarLimite} disabled={ocupado || !zLimite}
                            className="btn-suave !py-2 !px-3 shrink-0 mb-1">
                            <Check size={13} /> Salvar
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mb-4 p-3 rounded-lg border border-brand-200 dark:border-brand-900 bg-brand-50/40 dark:bg-brand-900/10">
                      <p className="text-[12.5px] font-medium mb-2">Cobrança automática (Asaas)</p>
                      <p className="text-[13px]">Mensalidade: <strong>{c.valorMensalidade ? moeda(c.valorMensalidade) : '—'}</strong></p>
                      <p className="text-[11px] text-neutro-500 mt-2">
                        {c.asaasAssinaturaId
                          ? `Assinatura ativa · ${c.formaCobranca === 'CREDIT_CARD' ? 'cartão (débito automático)' : 'PIX'}. Trocar o plano reajusta também a cobrança em aberto.`
                          : 'O dono ativa o pagamento em Cobrança, escolhendo PIX ou cartão.'}
                      </p>
                      {c.asaasAssinaturaId && (
                        <button type="button" onClick={encerrarAssinatura} disabled={ocupado}
                          className="text-[11.5px] text-red-600 hover:underline mt-2">
                          Cancelar assinatura
                        </button>
                      )}
                    </div>

                    {/* Configuração do dia de vencimento recorrente */}
                    <div className="flex items-end gap-2 mb-4 p-3 rounded-lg bg-neutro-50 dark:bg-neutro-950/40 border border-neutro-200/70 dark:border-neutro-800">
                      <div className="flex-1">
                        <label className="rotulo">Dia de vencimento mensal</label>
                        <input type="number" min={1} max={28} className="campo" placeholder="Ex: 10"
                          value={diaVencimento}
                          onChange={(e) => setDiaVencimento(e.target.value)} />
                        <p className="text-[11px] text-neutro-400 mt-1">
                          Dia em que a assinatura vence todo mês.
                        </p>
                      </div>
                      <button type="button" onClick={salvarDiaVencimento} disabled={salvandoDia}
                        className="btn-suave !py-2 !px-3 shrink-0 mb-1">
                        {salvandoDia ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        Salvar
                      </button>
                    </div>

                    {/* Liberar acesso manualmente */}
                    <button type="button" onClick={alternarAcessoLiberado} disabled={ocupado}
                      className={`w-full flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 mb-4 text-left transition-colors ${
                        c.acessoLiberado
                          ? 'border-brand-300 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20'
                          : 'border-neutro-200/70 dark:border-neutro-800 hover:bg-neutro-50 dark:hover:bg-neutro-800/40'
                      }`}>
                      {c.acessoLiberado
                        ? <LockOpen size={15} className="text-brand-600 shrink-0" strokeWidth={2} />
                        : <Lock size={15} className="text-neutro-400 shrink-0" strokeWidth={2} />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium">
                          {c.acessoLiberado ? 'Acesso liberado manualmente' : 'Liberar acesso manualmente'}
                        </p>
                        <p className="text-[11px] text-neutro-400">
                          {c.acessoLiberado
                            ? 'Ignorando o bloqueio automático por inadimplência — clique para reverter'
                            : 'Permite uso mesmo com fatura em atraso além da carência'}
                        </p>
                      </div>
                    </button>

                    <div className="space-y-2">
                      {c.faturas.length === 0 && (
                        <p className="text-[12px] text-neutro-400">Nenhuma fatura ainda. Elas aparecem sozinhas quando o Asaas gera a cobrança.</p>
                      )}
                      {c.faturas.map((f: any) => (
                        <div key={f.id} className="flex items-center gap-2.5 rounded-lg border border-neutro-200/70 dark:border-neutro-800 px-3.5 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium">
                              {f.competencia} · {moeda(f.valor)}
                            </p>
                            <p className="text-[11.5px] text-neutro-400">
                              vence {data(f.vencimento)}
                              {f.pagoEm && ` · pago ${data(f.pagoEm)}`}
                            </p>
                          </div>
                          <span className={`etiqueta shrink-0 ${
                            f.status === 'PAGA'
                              ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                              : f.status === 'CANCELADA'
                              ? 'bg-neutro-100 text-neutro-500 dark:bg-neutro-800'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                          }`}>
                            {f.status}
                          </span>
                          {f.status === 'ABERTA' && (
                            <button onClick={() => mudarFatura(f.id, 'PAGA')} disabled={ocupado}
                              title="Confirmar pagamento recebido"
                              className="btn-icone !w-8 !h-8 shrink-0 hover:!text-brand-600">
                              <Check size={15} strokeWidth={2.4} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Zona perigosa */}
                  <section className="rounded-xl border border-red-200 dark:border-red-900 p-4">
                    <h3 className="text-[11px] font-semibold tracking-wider text-red-600 mb-3">
                      ZONA PERIGOSA
                    </h3>

                    <button onClick={alternarAtivo} disabled={ocupado} className="btn-suave w-full !py-2 !text-[12px]">
                      {c.ativo ? 'Suspender consultório' : 'Reativar consultório'}
                    </button>
                    <p className="text-[11px] text-neutro-400 mt-1.5 mb-4">
                      Suspender tira o link público do ar e mantém todos os dados.
                      É o que você quer em 99% dos casos.
                    </p>

                    <label className="rotulo">
                      Para apagar de vez, digite: <span className="font-mono">{c.nome}</span>
                    </label>
                    <input className="campo" value={confirmacao} placeholder="Nome exato do consultório"
                      onChange={(e) => setConfirmacao(e.target.value)} />
                    <button onClick={apagar} disabled={ocupado || confirmacao !== c.nome}
                      className="btn w-full mt-2 !py-2 !text-[12px] bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none">
                      <Trash2 size={14} strokeWidth={2} /> Apagar consultório e todos os dados
                    </button>
                    <p className="text-[11px] text-neutro-400 mt-1.5">
                      Remove {c._count.pacientes} pacientes, {c._count.consultas} consultas,{' '}
                      {c._count.prontuarios} prontuários e {c._count.receitas} receitas.
                      Não há como desfazer.
                    </p>
                  </section>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
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

/**
 * Onde o dinheiro entra.
 *
 * A chave PIX fica no banco, e não numa variável de ambiente, para poder ser
 * trocada sem deploy. Não é segredo: chave PIX existe para ser divulgada —
 * é o que se imprime num QR de balcão.
 *
 * Repare no que NÃO está aqui: nenhum campo de cartão, nenhuma credencial de
 * adquirente, nenhum token de pagamento. O sistema não processa cobrança;
 * gera um código para o cliente pagar pelo banco dele e registra a baixa
 * quando você confirma.
 */
function ParametrosPix() {
  const { data: p, mutate } = useSWR('/api/admin/parametros', fetcher)
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState({
    pixChave: '', pixBeneficiario: '', pixCidade: '', diasCarencia: 5,
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    if (p) {
      setForm({
        pixChave: p.pixChave ?? '',
        pixBeneficiario: p.pixBeneficiario ?? '',
        pixCidade: p.pixCidade ?? '',
        diasCarencia: p.diasCarencia ?? 5,
      })
    }
  }, [p])

  const configurado = Boolean(p?.pixChave && p?.pixBeneficiario && p?.pixCidade)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null); setPronto(false)
    try {
      await enviar('/api/admin/parametros', 'PATCH', form)
      await mutate()
      setPronto(true)
      setTimeout(() => setPronto(false), 2500)
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  return (
    <section className="cartao mb-5 overflow-hidden">
      <button onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-neutro-50 dark:hover:bg-neutro-800/40">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          configurado
            ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600'
            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
        }`}>
          <Wallet size={17} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="titulo-secao">Recebimento por PIX</h2>
          <p className="text-[11.5px] text-neutro-400 truncate">
            {configurado
              ? `${p.pixChave} · carência de ${p.diasCarencia} dias`
              : 'Não configurado — os clientes não conseguem pagar'}
          </p>
        </div>
        <Settings size={15} className="text-neutro-400 shrink-0" strokeWidth={2} />
      </button>

      {aberto && (
        <form onSubmit={salvar} className="px-5 pb-5 pt-1 border-t border-neutro-100 dark:border-neutro-800">
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <div className="sm:col-span-2">
              <label className="rotulo">Chave PIX</label>
              <input className="campo" value={form.pixChave} placeholder="e-mail, CPF/CNPJ, telefone ou aleatória"
                onChange={(e) => setForm({ ...form, pixChave: e.target.value })} />
            </div>
            <div>
              <label className="rotulo">Nome do beneficiário</label>
              <input className="campo" maxLength={25} value={form.pixBeneficiario}
                placeholder="Como aparece no banco"
                onChange={(e) => setForm({ ...form, pixBeneficiario: e.target.value })} />
            </div>
            <div>
              <label className="rotulo">Cidade</label>
              <input className="campo" maxLength={15} value={form.pixCidade} placeholder="Juara"
                onChange={(e) => setForm({ ...form, pixCidade: e.target.value })} />
            </div>
            <div>
              <label className="rotulo">Dias de carência após o vencimento</label>
              <input type="number" min={0} max={60} className="campo" value={form.diasCarencia}
                onChange={(e) => setForm({ ...form, diasCarencia: Number(e.target.value) })} />
              <p className="text-[11px] text-neutro-400 mt-1.5">
                Depois desse prazo, o consultório perde acesso às telas de
                operação — mas continua entrando, com Cobrança, Perfil e
                Suporte abertos.
              </p>
            </div>
          </div>

          {erro && <p className="text-[12px] text-red-600 mt-3">{erro}</p>}

          <div className="flex items-center justify-end gap-3 mt-4">
            {pronto && (
              <span className="flex items-center gap-1.5 text-[12px] text-brand-600">
                <Check size={14} strokeWidth={2.4} /> Salvo
              </span>
            )}
            <button type="submit" disabled={salvando} className="btn-primario">
              {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

/** Ultra pago esperando instância: a clínica tem a promessa de 24 h. */
function FilaInstancias({ consultorios, aoConfigurar }: { consultorios: any[]; aoConfigurar: (id: string) => void }) {
  const fila = consultorios
    .filter((c) => c.plano === 'ULTRA' && (c.whatsappStatus === 'EM_CONFIGURACAO' || c.whatsappStatus === 'SEM_INSTANCIA'))
    .map((c) => ({ c, prazo: prazoDaConfiguracao(c.whatsappConfiguracaoDesde) }))
    .sort((a, b) => (a.prazo?.restanteMs ?? Infinity) - (b.prazo?.restanteMs ?? Infinity))
  if (fila.length === 0) return null
  return (
    <section className="cartao p-4 mb-4 border-brand-200 dark:border-brand-900">
      <div className="flex items-center gap-2 mb-1">
        <Clock size={15} className="text-brand-600 dark:text-brand-400" />
        <h2 className="text-[14px] font-semibold">WhatsApp para configurar ({fila.length})</h2>
      </div>
      <p className="text-[11.5px] text-neutro-500 mb-3">
        Clínicas Ultra esperando a instância. O prazo prometido é de 24 h a partir do pagamento.
      </p>
      <ul className="space-y-1.5">
        {fila.map(({ c, prazo }) => (
          <li key={c.id} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate">{c.nome}</span>
            <span className="flex items-center gap-2 shrink-0">
              <span className={`etiqueta ${prazo?.atrasado
                ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                : 'bg-neutro-100 dark:bg-neutro-800 text-neutro-600 dark:text-neutro-300'}`}>
                {prazo ? textoDoRestante(prazo.restanteMs) : 'sem pagamento confirmado'}
              </span>
              <button type="button" onClick={() => aoConfigurar(c.id)} className="btn-suave !py-1.5 !px-2.5">
                Configurar
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PrazoInstancia({ status, desde }: { status: string; desde: string | null }) {
  if (status !== 'EM_CONFIGURACAO' && status !== 'SEM_INSTANCIA') return null
  const prazo = prazoDaConfiguracao(desde)
  if (!prazo) {
    return <p className="text-[11.5px] text-neutro-500">Sem pagamento do Ultra confirmado: o prazo de 24 h começa no pagamento.</p>
  }
  return (
    <p className={`text-[11.5px] flex items-center gap-1.5 ${prazo.atrasado ? 'text-red-700 dark:text-red-400' : 'text-neutro-600 dark:text-neutro-400'}`}>
      {prazo.atrasado ? <AlertTriangle size={12} /> : <Clock size={12} />}
      Prazo de 24 h: {textoDoRestante(prazo.restanteMs)}
      {' '}({prazo.prazo.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})
    </p>
  )
}
