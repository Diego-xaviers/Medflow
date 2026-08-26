'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import {
  LayoutGrid, CalendarDays, Users, FileText, Receipt, Wallet,
  Bell, BarChart3, LifeBuoy, Settings, UserCircle, Eye, UsersRound, Building2,
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
          className="absolute inset-0 bg-white dark:bg-neutro-800 rounded-lg shadow-suave"
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
            ? 'text-neutro-900 dark:text-white font-medium'
            : 'text-neutro-500 dark:text-neutro-400 font-normal hover:text-neutro-900 dark:hover:text-neutro-200'
        }`}
      >
        <Icon
          size={17}
          strokeWidth={ativo ? 2.1 : 1.8}
          className={`transition-all duration-200 ${
            ativo ? 'text-brand-600 dark:text-brand-400' : 'group-hover:scale-105'
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
        <p className="px-3 mb-1.5 text-[10px] font-medium tracking-wider text-neutro-400 uppercase">
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
 *  separa as duas instâncias que existem ao mesmo tempo: a fixa do
 * desktop e a da gaveta no celular. Sem isso os dois compartilhavam o mesmo
 * , o framer-motion tratava as duas como o MESMO elemento, e a
 * gaveta ficava travada fora da tela ao abrir.
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
    <aside className="w-[236px] shrink-0 border-r border-neutro-200/70 dark:border-neutro-800 bg-neutro-100/50 dark:bg-neutro-900/40 h-screen sticky top-0 flex flex-col">
      <div className="flex items-center gap-2.5 px-5 h-[65px] border-b border-neutro-200/70 dark:border-neutro-800">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-suave">
          <Eye size={17} strokeWidth={2.2} />
        </div>
        <div>
          <p className="text-[15px] font-semibold leading-none tracking-apertado">Medflow</p>
          <p className="text-[9px] font-medium tracking-wider text-neutro-400 mt-1">
            GESTÃO CLÍNICA
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
        {principaisVisiveis.length > 0 && <Grupo itens={principaisVisiveis} aoNavegar={aoNavegar} variante={variante} />}
        {operacaoVisiveis.length > 0 && <Grupo titulo="Operação" itens={operacaoVisiveis} aoNavegar={aoNavegar} variante={variante} />}
        {adminVisiveis.length > 0 && <Grupo titulo="Admin" itens={adminVisiveis} aoNavegar={aoNavegar} variante={variante} />}
      </nav>

      <div className="px-3 pb-4">
        {/* O super admin não pertence a consultório: mostrar "—" aqui pareceria
            dado faltando, quando na verdade é o normal para a conta dele. */}
        <div className="rounded-lg bg-white dark:bg-neutro-800/60 border border-neutro-200/70 dark:border-neutro-800 px-3 py-2.5">
          <p className="text-[10px] font-medium tracking-wider text-neutro-400 uppercase">
            {papel === 'SUPER_ADMIN' ? 'Conta' : 'Consultório'}
          </p>
          <p className="text-[13px] font-medium truncate mt-0.5">
            {papel === 'SUPER_ADMIN'
              ? 'Administração Medflow'
              : sessao?.user?.consultorioNome ?? '—'}
          </p>
        </div>
      </div>
    </aside>
  )
}
