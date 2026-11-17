'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { Lock, Wallet, ArrowRight } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { liberadaNoBloqueio } from '@/lib/cobranca'
import { moeda } from '@/lib/formato'
import { appUrl, telaDaUrl } from '@/lib/rotas'

/**
 * A trava de inadimplência, do lado da tela.
 *
 * O bloqueio de verdade está no servidor — `exigirSessao()` recusa as rotas
 * com 402, então nenhum dado sai daqui mesmo que alguém contorne a interface.
 * Este componente existe para a pessoa entender o que houve, em vez de ver
 * telas quebrando com erro.
 *
 * Repare no que continua liberado: Cobrança, Perfil e Suporte. Trancar a
 * própria tela de pagamento seria trancar a saída, e tirar o suporte deixaria
 * quem tem um problema de cobrança sem ninguém para falar.
 */
export default function PortaoDeAcesso({ children }: { children: React.ReactNode }) {
  const caminho = telaDaUrl(usePathname())

  // Esta rota responde mesmo com a conta bloqueada — é por ela que a tela
  // descobre a situação.
  const { data } = useSWR('/api/cobranca', fetcher, { refreshInterval: 60_000 })
  const situacao = data?.situacao

  if (!situacao?.bloqueado || liberadaNoBloqueio(caminho)) return <>{children}</>

  return (
    <div className="p-4 sm:p-7 flex justify-center">
      <div className="cartao p-6 sm:p-8 max-w-md w-full text-center mt-6 sm:mt-12">
        <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <Lock size={26} strokeWidth={1.9} />
        </div>

        <h1 className="text-[18px] font-semibold tracking-apertado mb-2">
          {situacao.primeiroPagamentoPendente
            ? 'Falta ativar sua assinatura'
            : 'Acesso pausado por pendência'}
        </h1>
        <p className="text-[13px] text-neutro-500 leading-relaxed">
          {situacao.primeiroPagamentoPendente ? (
            <>
              Sua conta está criada e o consultório já existe. As telas abrem
              assim que a primeira mensalidade for confirmada — escolhe PIX ou
              cartão em Cobrança e leva menos de um minuto.
            </>
          ) : (
            <>
              Sua mensalidade está em aberto há{' '}
              <span className="font-semibold">{situacao.diasDeAtraso} dias</span>. As telas
              voltam assim que o pagamento for confirmado — seus dados continuam
              todos aqui, nada foi apagado.
            </>
          )}
        </p>

        {situacao.valorEmAberto > 0 && (
          <div className="rounded-lg bg-neutro-50 dark:bg-neutro-950/40 border border-neutro-200/70 dark:border-neutro-800 px-4 py-3 mt-5">
            <p className="text-[11px] text-neutro-400 uppercase tracking-wide">Em aberto</p>
            <p className="numero-destaque mt-1">{moeda(situacao.valorEmAberto)}</p>
          </div>
        )}

        <Link href={appUrl("/cobranca")} className="btn-primario w-full mt-5">
          <Wallet size={16} strokeWidth={2.2} />
          {situacao.primeiroPagamentoPendente ? 'Ativar assinatura' : 'Ver como pagar'}
          <ArrowRight size={15} strokeWidth={2.2} />
        </Link>

        <p className="text-[11.5px] text-neutro-400 mt-4">
          Continuam abertos: Cobrança, Perfil e Suporte. Se acha que houve
          engano, fale com a gente pelo Suporte.
        </p>
      </div>
    </div>
  )
}
