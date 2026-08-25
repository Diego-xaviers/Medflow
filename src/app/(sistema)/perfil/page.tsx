'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  Check, Loader2, Lock, UserRound, Building2, ShieldCheck,
  Camera, Trash2, Stethoscope,
} from 'lucide-react'
import Avatar from '@/components/Avatar'
import { fetcher, enviar } from '@/lib/fetcher'
import { data } from '@/lib/formato'

/** Lado da foto depois de reduzida, em pixels. */
const LADO = 256

/**
 * Recorta no centro, reduz para 256px e devolve um data URI.
 *
 * O corte acontece aqui, no navegador, de propósito: a foto de perfil de um
 * celular moderno passa de 4 MB, e mandar isso para o banco a cada troca seria
 * desperdício em cima de desperdício. Depois desta função, sobra algo em torno
 * de 20 KB — que cabe numa coluna de texto sem incomodar ninguém.
 */
function reduzirImagem(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo'))
    leitor.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Arquivo de imagem inválido'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = LADO
        canvas.height = LADO
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Seu navegador não suporta o recorte'))

        // Recorte quadrado pelo menor lado, centralizado — é um rosto.
        const lado = Math.min(img.width, img.height)
        const sx = (img.width - lado) / 2
        const sy = (img.height - lado) / 2
        ctx.drawImage(img, sx, sy, lado, lado, 0, 0, LADO, LADO)

        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = leitor.result as string
    }
    leitor.readAsDataURL(arquivo)
  })
}

const rotuloPapel: Record<string, string> = {
  SUPER_ADMIN: 'Administrador', DONO: 'Optometrista responsável',
  ATENDENTE: 'Atendente', VENDEDORA: 'Vendedora',
}

export default function PerfilPage() {
  const { update } = useSession()
  const { data: perfil, isLoading, mutate } = useSWR('/api/perfil', fetcher)

  return (
    <div className="p-7 max-w-[900px]">
      <div className="mb-7">
        <h1 className="titulo-pagina">Perfil</h1>
        <p className="subtitulo mt-1">Seus dados de acesso ao Medflow</p>
      </div>

      {isLoading ? (
        <div className="space-y-5">
          <div className="esqueleto h-[120px]" />
          <div className="esqueleto h-[240px]" />
        </div>
      ) : (
        <div className="space-y-5">
          <Cabecalho perfil={perfil} aoTrocarFoto={() => mutate()} />
          <FormDados perfil={perfil} aoSalvar={async () => { await mutate(); await update() }} />
          <FormSenha />
        </div>
      )}
    </div>
  )
}

function Cabecalho({ perfil, aoTrocarFoto }: any) {
  const entrada = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    // Limpa já: sem isto, escolher o mesmo arquivo duas vezes seguidas não
    // dispara o evento de novo e a tela parece travada.
    e.target.value = ''
    if (!arquivo) return

    setEnviando(true); setErro(null)
    try {
      const foto = await reduzirImagem(arquivo)
      await enviar('/api/perfil/foto', 'PATCH', { foto })
      await aoTrocarFoto()
    } catch (e: any) { setErro(e.message) } finally { setEnviando(false) }
  }

  async function remover() {
    setEnviando(true); setErro(null)
    try {
      await enviar('/api/perfil/foto', 'DELETE')
      await aoTrocarFoto()
    } catch (e: any) { setErro(e.message) } finally { setEnviando(false) }
  }

  return (
    <div className="cartao p-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <div className="relative shrink-0">
          <Avatar nome={perfil?.nome} fotoUrl={perfil?.fotoUrl} tamanho={80} />
          <button onClick={() => entrada.current?.click()} disabled={enviando}
            title="Trocar foto"
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-neutro-900 dark:bg-white text-white dark:text-neutro-900 flex items-center justify-center shadow-media transition-transform duration-200 hover:scale-105 active:scale-95 disabled:opacity-60">
            {enviando ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} strokeWidth={2.2} />}
          </button>
          <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp"
            className="hidden" onChange={escolherArquivo} />
        </div>

        <div className="min-w-0 text-center sm:text-left flex-1">
          <p className="text-[17px] font-semibold truncate">{perfil?.nome}</p>
          <p className="text-[13px] text-neutro-400 truncate">{perfil?.email}</p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5">
            <span className="etiqueta bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
              <ShieldCheck size={12} strokeWidth={2.2} /> {rotuloPapel[perfil?.papel] ?? perfil?.papel}
            </span>
            {perfil?.atendePacientes && (
              <span className="etiqueta bg-neutro-100 text-neutro-600 dark:bg-neutro-800 dark:text-neutro-400">
                <Stethoscope size={12} strokeWidth={2} /> Atende pacientes
              </span>
            )}
            {perfil?.consultorio?.nome && (
              <span className="etiqueta bg-neutro-100 text-neutro-600 dark:bg-neutro-800 dark:text-neutro-400">
                <Building2 size={12} strokeWidth={2} /> {perfil.consultorio.nome}
              </span>
            )}
            {perfil?.criadoEm && (
              <span className="text-[11px] text-neutro-400">
                Na equipe desde {data(perfil.criadoEm)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-3 mt-3">
            <button onClick={() => entrada.current?.click()} disabled={enviando}
              className="text-[12px] font-medium text-neutro-500 hover:text-brand-600 transition-colors disabled:opacity-50">
              {perfil?.fotoUrl ? 'Trocar foto' : 'Enviar foto'}
            </button>
            {perfil?.fotoUrl && (
              <button onClick={remover} disabled={enviando}
                className="flex items-center gap-1 text-[12px] font-medium text-neutro-400 hover:text-red-500 transition-colors disabled:opacity-50">
                <Trash2 size={12} strokeWidth={2} /> Remover
              </button>
            )}
          </div>

          {erro && <p className="text-[12px] text-red-600 mt-2">{erro}</p>}
          <p className="text-[11px] text-neutro-400 mt-2">
            A imagem é recortada no quadrado e reduzida para {LADO}px antes de subir.
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Nome e e-mail. Salvar aqui também renova a sessão: sem isso, o cabeçalho e
 * a barra lateral seguiriam mostrando o nome antigo até o próximo login.
 */
function FormDados({ perfil, aoSalvar }: any) {
  const [form, setForm] = useState({ nome: '', email: '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)
  const campoNome = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (perfil) setForm({ nome: perfil.nome ?? '', email: perfil.email ?? '' })
  }, [perfil])

  // "Editar perfil" no menu do topo chega com ?editar=1: rolamos até o
  // formulário e deixamos o cursor no primeiro campo, para o clique terminar
  // onde o nome do item prometeu.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).get('editar')) return
    campoNome.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    campoNome.current?.focus({ preventScroll: true })
    window.history.replaceState({}, '', '/perfil')
  }, [])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro(null); setPronto(false)
    try {
      await enviar('/api/perfil', 'PATCH', form)
      await aoSalvar()
      setPronto(true)
      setTimeout(() => setPronto(false), 2500)
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  return (
    <form onSubmit={salvar} className="cartao p-6">
      <div className="flex items-center gap-2 mb-5">
        <UserRound size={16} className="text-neutro-400" strokeWidth={2} />
        <h2 className="titulo-secao">Dados pessoais</h2>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="rotulo">Nome</label>
          <input ref={campoNome} className="campo" required minLength={2} value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </div>
        <div>
          <label className="rotulo">E-mail de acesso</label>
          <input type="email" className="campo" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>

      <p className="text-[11px] text-neutro-400 mt-3">
        O e-mail é o seu login. Trocando aqui, o próximo acesso já usa o novo.
      </p>

      {erro && <p className="text-[12px] text-red-600 mt-3">{erro}</p>}

      <div className="flex items-center justify-end gap-3 mt-5">
        {pronto && (
          <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 text-[12px] text-brand-600">
            <Check size={14} strokeWidth={2.4} /> Salvo
          </motion.span>
        )}
        <button type="submit" disabled={salvando} className="btn-primario">
          {salvando && <Loader2 size={14} className="animate-spin" />} Salvar alterações
        </button>
      </div>
    </form>
  )
}

function FormSenha() {
  const vazio = { senhaAtual: '', novaSenha: '', confirmacao: '' }
  const [form, setForm] = useState(vazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (form.novaSenha !== form.confirmacao) {
      setErro('A confirmação não confere com a nova senha')
      return
    }
    setSalvando(true); setErro(null); setPronto(false)
    try {
      await enviar('/api/perfil/senha', 'PATCH', {
        senhaAtual: form.senhaAtual, novaSenha: form.novaSenha,
      })
      setForm(vazio)
      setPronto(true)
      setTimeout(() => setPronto(false), 2500)
    } catch (e: any) { setErro(e.message) } finally { setSalvando(false) }
  }

  return (
    <form onSubmit={salvar} className="cartao p-6">
      <div className="flex items-center gap-2 mb-1">
        <Lock size={16} className="text-neutro-400" strokeWidth={2} />
        <h2 className="titulo-secao">Trocar senha</h2>
      </div>
      <p className="text-[12px] text-neutro-400 mb-5">
        Pedimos a senha atual de propósito: assim ninguém troca sua senha numa
        tela que você deixou aberta.
      </p>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="rotulo">Senha atual</label>
          <input type="password" className="campo" required autoComplete="current-password"
            value={form.senhaAtual}
            onChange={(e) => setForm({ ...form, senhaAtual: e.target.value })} />
        </div>
        <div>
          <label className="rotulo">Nova senha</label>
          <input type="password" className="campo" required minLength={8} autoComplete="new-password"
            placeholder="Mínimo 8 caracteres" value={form.novaSenha}
            onChange={(e) => setForm({ ...form, novaSenha: e.target.value })} />
        </div>
        <div>
          <label className="rotulo">Confirmar nova senha</label>
          <input type="password" className="campo" required minLength={8} autoComplete="new-password"
            value={form.confirmacao}
            onChange={(e) => setForm({ ...form, confirmacao: e.target.value })} />
        </div>
      </div>

      {erro && <p className="text-[12px] text-red-600 mt-3">{erro}</p>}

      <div className="flex items-center justify-end gap-3 mt-5">
        {pronto && (
          <motion.span initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 text-[12px] text-brand-600">
            <Check size={14} strokeWidth={2.4} /> Senha atualizada
          </motion.span>
        )}
        <button type="submit" disabled={salvando} className="btn-suave">
          {salvando && <Loader2 size={14} className="animate-spin" />} Trocar senha
        </button>
      </div>
    </form>
  )
}
