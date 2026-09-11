'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import {
  LayoutGrid, CalendarDays, Users, FileText, Receipt, Wallet,
  Bell, BarChart3, LifeBuoy, Settings, UserCircle, UsersRound, Building2,
} from 'lucide-react'
import { podeAbrir, type PapelUsuario } from '@/lib/permissoes'

const principais = [
  { label: 'Dashboard', icon: LayoutGrid, href: '/' },
  { label: 'Agenda', icon: CalendarDays, href: '/agenda' },
  { label: 'Pacientes', icon: Users, href: '/pacientes' },
  { label: 'Prontuários', icon: FileText, href: '/prontuarios' },
  { label: 'Receitas', icon: Receipt, href: '/receitas' },
]

const operacao = [
  { label: 'Financeiro', icon: Wallet, href: '/financeiro' },
  { label: 'Lembretes', icon: Bell, href: '/lembretes' },
  { label: 'Relatórios', icon: BarChart3, href: '/relatorios' },
  { label: 'Suporte', icon: LifeBuoy, href: '/suporte' },
]

const admin = [
  { label: 'Cobrança', icon: Wallet, href: '/cobranca' },
  { label: 'Consultórios', icon: Building2, href: '/admin' },
  { label: 'Equipe', icon: UsersRound, href: '/equipe' },
  { label: 'Configurações', icon: Settings, href: '/configuracoes' },
  { label: 'Perfil', icon: UserCircle, href: '/perfil' },
]

function Item({ label, icon: Icon, href, aoNavegar, variante }: { label: string; icon: any; href: string; aoNavegar?: () => void; variante: string }) {
  const caminho = usePathname()
  const ativo = href === '/' ? caminho === '/' : caminho.startsWith(href)

  return (
    <Link href={href} onClick={aoNavegar} className="relative block group">
      {/* O fundo do item ativo desliza de um item para o outro em vez de
          piscar — é o detalhe que dá sensação de produto polido. */}
      {ativo && (
        <motion.span
          layoutId={`fundoNav-${variante}`}
          className="absolute inset-0 bg-brand-50 dark:bg-brand-950/50 rounded-lg"
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        />
      )}

      {ativo && (
        <motion.span
          layoutId={`barraNav-${variante}`}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-brand-500 rounded-full"
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        />
      )}

      <span
        className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors duration-200 ${
          ativo
            ? 'text-neutro-900 dark:text-white font-semibold'
            : 'text-neutro-500 dark:text-neutro-400 font-normal hover:text-neutro-800 dark:hover:text-neutro-200'
        }`}
      >
        <Icon
          size={16}
          strokeWidth={ativo ? 2.2 : 1.7}
          className={`transition-all duration-200 flex-shrink-0 ${
            ativo ? 'text-brand-500' : 'group-hover:scale-105 group-hover:text-neutro-700 dark:group-hover:text-neutro-300'
          }`}
        />
        {label}
      </span>
    </Link>
  )
}

function Grupo({ titulo, itens, aoNavegar, variante }: { titulo?: string; itens: any[]; aoNavegar?: () => void; variante: string }) {
  return (
    <div>
      {titulo && (
        <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest text-neutro-400 dark:text-neutro-600 uppercase">
          {titulo}
        </p>
      )}
      <div className="space-y-0.5">
        {itens.map((i) => <Item key={i.href} {...i} aoNavegar={aoNavegar} variante={variante} />)}
      </div>
    </div>
  )
}

/**
 * `variante` separa as duas instâncias que existem ao mesmo tempo: a fixa do
 * desktop e a da gaveta no celular. Sem isso as duas compartilhavam o mesmo
 * `layoutId` e o framer-motion as tratava como o MESMO elemento, o que faz a
 * animação do item ativo saltar de uma para a outra.
 */
export default function Sidebar({ aoNavegar, variante = 'fixa' }: { aoNavegar?: () => void; variante?: string } = {}) {
  const { data: sessao } = useSession()
  const papel = sessao?.user?.papel as PapelUsuario | undefined

  // O menu mostra exatamente o que o papel pode abrir — mesma tabela que o
  // middleware consulta, para o menu nunca prometer uma tela que vai barrar.
  const visiveis = (itens: any[]) => itens.filter((i) => podeAbrir(papel, i.href))

  const principaisVisiveis = visiveis(principais)
  const operacaoVisiveis = visiveis(operacao)
  const adminVisiveis = visiveis(admin)

  return (
    <aside className="w-[236px] shrink-0 border-r border-neutro-200 dark:border-neutro-800 bg-white dark:bg-neutro-950 h-screen sticky top-0 flex flex-col">
      <div className="flex items-center gap-2.5 px-4 h-[60px] border-b border-neutro-200 dark:border-neutro-800">
        <div className="w-8 h-8 rounded-[9px] bg-brand-500 flex items-center justify-center shadow-suave flex-shrink-0">
          <span className="text-brand-950 font-black text-[18px] leading-none" style={{ letterSpacing: '-2px', marginRight: '-1px' }}>+</span>
        </div>
        <div>
          <p className="text-[15px] font-bold leading-none" style={{ letterSpacing: '-0.025em' }}>Medflow</p>
          <p className="text-[9px] font-semibold tracking-widest text-neutro-400 dark:text-neutro-600 mt-1 uppercase">
            Gestão Clínica
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {principaisVisiveis.length > 0 && <Grupo itens={principaisVisiveis} aoNavegar={aoNavegar} variante={variante} />}
        {operacaoVisiveis.length > 0 && <Grupo titulo="Operação" itens={operacaoVisiveis} aoNavegar={aoNavegar} variante={variante} />}
        {adminVisiveis.length > 0 && <Grupo titulo="Admin" itens={adminVisiveis} aoNavegar={aoNavegar} variante={variante} />}
      </nav>

      <div className="px-3 pb-4">
        <div className="rounded-lg bg-neutro-50 dark:bg-neutro-900 border border-neutro-200 dark:border-neutro-800 px-3 py-2.5">
          <p className="text-[10px] font-semibold tracking-widest text-neutro-400 dark:text-neutro-600 uppercase mb-0.5">
            {papel === 'SUPER_ADMIN' ? 'Conta' : 'Consultório'}
          </p>
          <p className="text-[13px] font-semibold truncate text-neutro-800 dark:text-neutro-200" style={{ letterSpacing: '-0.01em' }}>
            {papel === 'SUPER_ADMIN'
              ? 'Administração Medflow'
              : sessao?.user?.consultorioNome ?? '—'}
          </p>
        </div>
      </div>
    </aside>
  )
}
