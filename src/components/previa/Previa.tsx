'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import {
  ORDEM_PLANOS,
  RECURSOS,
  ROTULO,
  planoLibera,
  planoNecessario,
  type PlanoNome,
} from '@/lib/planos'
import { TELAS_PREVIA } from './telas'

/**
 * A prévia do sistema na página de apresentação.
 *
 * Existe no lugar do teste grátis. Conta grátis com IA ligada é prejuízo
 * direto — um e-mail descartável queimaria crédito de IA e iria embora. Então
 * em vez de dar o produto para experimentar, a vitrine o mostra funcionando, e
 * a pessoa escolhe o plano vendo exatamente o que muda de um para o outro.
 *
 * O ponto que sustenta isso: quem decide o que está travado é o `planos.ts`,
 * pelas mesmas funções que o middleware chama (`planoLibera`,
 * `planoNecessario`, `RECURSOS`). A prévia não tem tabela própria. Se tivesse,
 * ela envelheceria — e uma vitrine que promete o que o plano não entrega é
 * reclamação no primeiro dia de uso, não venda.
 */
export default function Previa({ plano, aoTrocarPlano }: {
  plano: PlanoNome
  aoTrocarPlano: (p: PlanoNome) => void
}) {
  const [telaAtiva, setTelaAtiva] = useState(TELAS_PREVIA[0].chave)

  const tela = TELAS_PREVIA.find((t) => t.chave === telaAtiva) ?? TELAS_PREVIA[0]
  const liberada = planoLibera(plano, tela.chave)
  const minimo = planoNecessario(tela.chave)
  const recursos = RECURSOS[plano]

  return (
    <div>
      {/* ── Seletor de plano ── */}
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Escolha o plano para ver o que ele inclui"
          className="inline-flex gap-1 p-1 rounded-xl bg-neutro-100 dark:bg-neutro-900 border border-neutro-200/70 dark:border-neutro-800"
        >
          {ORDEM_PLANOS.map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={p === plano}
              onClick={() => aoTrocarPlano(p)}
              className={`text-[13px] font-medium px-4 py-2 rounded-lg transition-colors duration-200 ${
                p === plano
                  ? 'bg-white dark:bg-neutro-800 shadow-suave text-neutro-900 dark:text-white'
                  : 'text-neutro-500 hover:text-neutro-800 dark:hover:text-neutro-200'
              }`}
            >
              {ROTULO[p]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Abas de tela ── */}
      <div className="flex gap-1.5 overflow-x-auto mt-6 pb-1 -mx-1 px-1">
        {TELAS_PREVIA.map((t) => {
          const abre = planoLibera(plano, t.chave)
          return (
            <button
              key={t.chave}
              onClick={() => setTelaAtiva(t.chave)}
              aria-current={t.chave === telaAtiva}
              className={`shrink-0 inline-flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 rounded-lg border transition-colors duration-200 ${
                t.chave === telaAtiva
                  ? 'border-neutro-900 dark:border-white text-neutro-900 dark:text-white'
                  : 'border-neutro-200 dark:border-neutro-800 text-neutro-500 hover:text-neutro-800 dark:hover:text-neutro-200'
              }`}
            >
              {/* Cadeado na própria aba: a pessoa vê o que falta antes de
                  clicar, em vez de descobrir batendo na trava. */}
              {!abre && <Lock size={11} strokeWidth={2.4} className="text-neutro-400" />}
              {t.rotulo}
            </button>
          )
        })}
      </div>

      {/* ── A tela ── */}
      <div className="relative mt-3">
        <div className={liberada ? '' : 'opacity-40 blur-[2px] pointer-events-none select-none'}>
          <tela.Componente />
        </div>

        {!liberada && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="cartao px-5 py-4 text-center max-w-[260px]">
              <Lock size={18} className="mx-auto text-neutro-400 mb-2" strokeWidth={2} />
              <p className="text-[13px] font-semibold">
                {tela.rotulo} faz parte do plano {minimo ? ROTULO[minimo] : 'superior'}
              </p>
              <button
                onClick={() => minimo && aoTrocarPlano(minimo)}
                className="btn-suave w-full mt-3 text-[12.5px] py-2"
              >
                Ver no plano {minimo ? ROTULO[minimo] : 'superior'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Recursos que não são tela ──
          Sem isto, Pro e Ultra pareceriam idênticos na prévia: o que separa os
          dois não é tela nenhuma, é IA, CRM e análise de crescimento. */}
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-6">
        {[
          ['Agendamento público (link e QR)', recursos.agendamentoPublico],
          ['Pós-venda com IA', recursos.iaPosVenda],
          ['CRM integrado', recursos.crm],
          ['Análise de crescimento', recursos.analiseCrescimento],
        ].map(([rotulo, tem]) => (
          <div key={rotulo as string} className="flex items-center gap-2 text-[12.5px]">
            <span
              className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold ${
                tem
                  ? 'bg-brand-500 text-brand-950'
                  : 'bg-neutro-200 dark:bg-neutro-800 text-neutro-400'
              }`}
            >
              {tem ? '✓' : '—'}
            </span>
            <span className={tem ? 'text-neutro-700 dark:text-neutro-200' : 'text-neutro-400'}>
              {rotulo}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
