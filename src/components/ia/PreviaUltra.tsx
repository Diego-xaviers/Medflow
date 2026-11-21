import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { appUrl } from '@/lib/rotas'
import { AGENTES_EXEMPLO, CONHECIMENTO_EXEMPLO } from '@/lib/ia-exemplo'
import type { AbaAssistente } from './AbasAssistente'
import CartaoAgente from './CartaoAgente'
import BaseConhecimento from './BaseConhecimento'
import FaixaFluxo from './FaixaFluxo'

export default function PreviaUltra({ aba }: { aba: AbaAssistente }) {
  return <div className="space-y-4">
    <div className="cartao !rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap">
      <div><h2 className="titulo-secao">Prévia do plano Ultra</h2><p className="text-sm text-neutro-500 mt-1">
        Explore os agentes e a base com dados de exemplo. Com o Ultra, sua equipe atende pelo WhatsApp da clínica.
      </p></div>
      <Link href={appUrl('/cobranca')} className="btn-marca">Quero o Ultra <ArrowRight size={15} /></Link>
    </div>
    {aba === 'base' ? <BaseConhecimento exemplo={CONHECIMENTO_EXEMPLO} /> : <>
      <FaixaFluxo ativos={2} />
      <div className="grid gap-4 md:grid-cols-2">
        {AGENTES_EXEMPLO.agentes.map(a => <CartaoAgente key={a.config.tipo} agente={a} ativo conectado />)}
      </div>
      <Link href={appUrl('/conversas')} className="btn-suave">Ver conversas de exemplo <ArrowRight size={15} /></Link>
    </>}
  </div>
}
