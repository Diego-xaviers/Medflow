'use client'

import Link from 'next/link'
import { Sparkles, Check } from 'lucide-react'
import { appUrl } from '@/lib/rotas'
import { PAINEL_IA_EXEMPLO } from '@/lib/ia-exemplo'
import PainelIA from './PainelIA'

const VANTAGENS = [
  'Análise do consultório escrita pela IA',
  'Lotes de pacientes para reativar, prontos para aprovar',
  'Mensagem de WhatsApp escrita para cada paciente',
  'Envio automático pelo WhatsApp da clínica, só com a sua autorização',
]

/**
 * O que Básico e Pro veem: o Assistente funcionando com dados de exemplo,
 * desfocado, e o convite para o Ultra por cima. Nada aqui chama a IA.
 */
export default function PreviaUltra() {
  return (
    <div className="relative">
      <div aria-hidden className="blur-[3px] opacity-70 pointer-events-none select-none max-h-[720px] overflow-hidden">
        <PainelIA painel={PAINEL_IA_EXEMPLO} aoMudar={() => {}} aoAtualizarAnalise={() => {}} />
      </div>
      <div className="absolute inset-0 flex items-start justify-center pt-10 sm:pt-20 px-2">
        <div className="w-full max-w-md cartao p-6 shadow-2xl">
          <div className="w-11 h-11 rounded-xl bg-brand-500 text-brand-950 flex items-center justify-center mb-4">
            <Sparkles size={20} strokeWidth={2.2} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-600 mb-1">Plano Ultra</p>
          <h2 className="text-[20px] font-semibold tracking-apertado leading-tight">
            A IA que traz seus pacientes de volta
          </h2>
          <p className="text-[13px] text-neutro-500 mt-2">
            Ela lê o consultório, separa quem está com o exame vencido e escreve a mensagem certa para cada um.
          </p>
          <ul className="mt-4 space-y-2">
            {VANTAGENS.map((v) => (
              <li key={v} className="flex gap-2 text-[13px]">
                <Check size={15} className="text-brand-600 shrink-0 mt-0.5" strokeWidth={2.6} /> {v}
              </li>
            ))}
          </ul>
          <Link href={appUrl('/cobranca')} className="btn-marca w-full mt-5">Quero o Ultra</Link>
        </div>
      </div>
    </div>
  )
}
