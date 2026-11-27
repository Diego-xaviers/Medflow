import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight, MessagesSquare, Send, Users } from 'lucide-react'
import { appUrl } from '@/lib/rotas'
import type { Painel } from '@/lib/lotesServidor'
import { Contador } from './CarregandoIA'

type PainelLiberado = Extract<Painel, { liberado: true }>

/** Os números do dia no topo do Assistente: o que pede atenção agora. */
export default function ResumoIA({ painel }: { painel: PainelLiberado }) {
  const { whatsapp } = painel
  const paraReativar = painel.propostos.reduce((s, l) => s + l.total, 0)
  const pctEnvio = whatsapp.limite ? Math.min(100, Math.round((whatsapp.enviadasHoje / whatsapp.limite) * 100)) : 0

  const cartoes = [
    {
      rotulo: 'Aguardando a equipe', icone: MessagesSquare, destaque: painel.aguardandoEquipe > 0,
      valor: <Contador alvo={painel.aguardandoEquipe} />, rodape: 'Abrir conversas', href: '/conversas',
    },
    {
      rotulo: 'Enviadas hoje', icone: Send,
      valor: <><Contador alvo={whatsapp.enviadasHoje} /><span className="text-[13px] sm:text-[15px] text-neutro-400 font-medium">/{whatsapp.limite}</span></>,
      barra: pctEnvio,
    },
    {
      rotulo: 'Pacientes para reativar', icone: Users,
      valor: <Contador alvo={paraReativar} />,
      rodape: `${painel.propostos.length} ${painel.propostos.length === 1 ? 'lote sugerido' : 'lotes sugeridos'}`,
    },
  ]

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
      {cartoes.map((c, i) => {
        const Icone = c.icone
        const corpo = (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[11px] sm:text-[12px] font-medium leading-tight text-neutro-500">{c.rotulo}</p>
              <span className={`hidden sm:grid h-7 w-7 place-items-center rounded-lg ${c.destaque
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'}`}>
                <Icone size={14} />
              </span>
            </div>
            <p className="mt-2 text-[22px] sm:text-[28px] font-semibold leading-none numerico">{c.valor}</p>
            {c.barra !== undefined ? (
              <div className="mt-3 h-1.5 rounded-full bg-neutro-100 dark:bg-neutro-800 overflow-hidden">
                <motion.div className="h-full rounded-full bg-brand-500" initial={{ width: 0 }} animate={{ width: `${c.barra}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }} />
              </div>
            ) : (
              <p className="mt-3 hidden sm:flex items-center gap-1 text-[11.5px] text-neutro-400">
                {c.rodape}{c.href && <ArrowUpRight size={12} />}
              </p>
            )}
          </>
        )
        return (
          <motion.div key={c.rotulo} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            {c.href ? (
              <Link prefetch={false} href={appUrl(c.href)} className="cartao-interativo block p-3 sm:p-4 h-full">{corpo}</Link>
            ) : (
              <div className="cartao p-3 sm:p-4 h-full">{corpo}</div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
