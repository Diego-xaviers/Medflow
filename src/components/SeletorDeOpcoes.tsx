'use client'

import { useEffect, useState } from 'react'
import { Plus, Check } from 'lucide-react'
import { compor, decompor, OPCAO_NENHUM } from '@/lib/opcoesClinicas'

/**
 * Escolha rápida por toque, com escape para o que a lista não previu.
 *
 * A regra de ouro aqui é não punir o caso raro: toda lista clínica erra em
 * alguma consulta, então "Outro" está sempre à mão e vira texto livre. O
 * profissional que quiser só digitar continua conseguindo.
 *
 * "Nenhum" é exclusivo — marcar "Nenhum" e "Diabetes" ao mesmo tempo seria
 * contradição registrada em prontuário.
 */
export default function SeletorDeOpcoes({
  rotulo, opcoes, valor, aoMudar, permiteNenhum = true, dica,
}: {
  rotulo: string
  opcoes: string[]
  valor: string
  aoMudar: (novo: string) => void
  permiteNenhum?: boolean
  dica?: string
}) {
  const inicial = decompor(valor, opcoes)
  const [marcadas, setMarcadas] = useState<string[]>(inicial.marcadas)
  const [outro, setOutro] = useState(inicial.outro)
  const [mostrarOutro, setMostrarOutro] = useState(Boolean(inicial.outro))

  // O formulário pode ser reaberto com outro registro; ressincroniza quando o
  // valor de fora muda de verdade (e não a cada tecla digitada aqui dentro).
  useEffect(() => {
    const d = decompor(valor, opcoes)
    if (compor(d) === compor({ marcadas, outro })) return
    setMarcadas(d.marcadas)
    setOutro(d.outro)
    setMostrarOutro(Boolean(d.outro))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  function publicar(novasMarcadas: string[], novoOutro: string) {
    setMarcadas(novasMarcadas)
    setOutro(novoOutro)
    aoMudar(compor({ marcadas: novasMarcadas, outro: novoOutro }))
  }

  function alternar(opcao: string) {
    if (opcao === OPCAO_NENHUM) {
      // Exclusiva: marcar "Nenhum" limpa o resto, inclusive o texto livre.
      const jaEstava = marcadas.includes(OPCAO_NENHUM)
      setMostrarOutro(false)
      publicar(jaEstava ? [] : [OPCAO_NENHUM], '')
      return
    }

    const semNenhum = marcadas.filter((m) => m !== OPCAO_NENHUM)
    publicar(
      semNenhum.includes(opcao)
        ? semNenhum.filter((m) => m !== opcao)
        : [...semNenhum, opcao],
      outro
    )
  }

  const lista = permiteNenhum ? [...opcoes, OPCAO_NENHUM] : opcoes

  return (
    <div>
      <label className="rotulo">{rotulo}</label>
      {dica && <p className="text-[11px] text-neutro-400 mb-1.5">{dica}</p>}

      <div className="flex flex-wrap gap-1.5 mt-1">
        {lista.map((opcao) => {
          const ativa = marcadas.includes(opcao)
          const ehNenhum = opcao === OPCAO_NENHUM
          return (
            <button key={opcao} type="button" onClick={() => alternar(opcao)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-all duration-150 active:scale-[0.97] ${
                ativa
                  ? ehNenhum
                    ? 'bg-neutro-700 dark:bg-neutro-300 text-white dark:text-neutro-900 border-neutro-700 dark:border-neutro-300'
                    : 'bg-brand-600 text-white border-brand-600'
                  : 'border-neutro-200 dark:border-neutro-700 text-neutro-600 dark:text-neutro-400 hover:border-brand-400'
              }`}>
              {ativa && <Check size={11} strokeWidth={3} />}
              {opcao}
            </button>
          )
        })}

        {!marcadas.includes(OPCAO_NENHUM) && !mostrarOutro && (
          <button type="button" onClick={() => setMostrarOutro(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-dashed border-neutro-300 dark:border-neutro-600 text-neutro-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
            <Plus size={11} strokeWidth={2.4} /> Outro
          </button>
        )}
      </div>

      {mostrarOutro && (
        <input
          className="campo !mt-2" autoFocus={!outro}
          placeholder="Descreva o que não está na lista"
          value={outro}
          onChange={(e) => publicar(marcadas.filter((m) => m !== OPCAO_NENHUM), e.target.value)}
          onBlur={() => { if (!outro.trim()) setMostrarOutro(false) }}
        />
      )}
    </div>
  )
}
