'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Handshake, ChevronDown, Copy, Check, Loader2, ShoppingBag } from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'
import { moeda, data } from '@/lib/formato'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const mesExtenso = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`

/** Mês atual "AAAA-MM" no fuso do navegador. */
const mesAtual = () => new Date().toLocaleDateString('en-CA').slice(0, 7)

/** Quem deve a quem, em uma frase. */
function titulo(g: any) {
  return g.quemPaga === 'CLINICA_PAGA'
    ? `A pagar a ${g.profissional.nome}`
    : `A receber de ${g.parceiro || 'ótica parceira'} · ${g.profissional.nome}`
}

/** Texto do acerto para mandar por WhatsApp ou e-mail. */
function textoDoAcerto(g: any, mes: string) {
  const linhas = [
    `*Acerto de campanhas — ${mesExtenso(mes)}*`,
    titulo(g),
    '',
    `Consultas de campanha: ${g.consultas}`,
    `Compraram na ótica: ${g.vendas} (${g.conversao.toLocaleString('pt-BR')}%)`,
    `Cobrado nas consultas: ${moeda(g.cobrado)}`,
    `Diferenças devidas: ${moeda(g.diferenca)}`,
    g.pago ? `Já pago: ${moeda(g.pago)}` : null,
    `*Total pendente: ${moeda(g.pendente)}*`,
    '',
    ...g.itens.filter((i: any) => i.vendaFechada).map((i: any) =>
      `${data(i.data)} · ${i.paciente} · ${i.campanha} · ${moeda(i.diferenca)}${i.situacao === 'PAGO' ? ' (pago)' : ''}`),
  ]
  return linhas.filter((l) => l !== null).join('\n')
}

/**
 * Acerto mensal das diferenças de campanha.
 *
 * Campanha com valor de referência (ex.: consulta de 100 vendida a 59,90):
 * quando o paciente fecha compra na ótica, a diferença (40,10) é devida ao
 * optometrista. Aqui ela é somada por optometrista no mês e baixada de uma
 * vez quando o acerto é pago.
 */
export default function AcertoCampanhas({ aoMudar }: { aoMudar: () => void }) {
  const [mes, setMes] = useState(mesAtual)
  const [aberto, setAberto] = useState<string | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [baixando, setBaixando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const { data: acerto, mutate } = useSWR(`/api/financeiro/acerto?mes=${mes}`, fetcher)

  async function registrar(g: any) {
    if (!confirm(`Registrar como pago o acerto de ${moeda(g.pendente)} (${titulo(g)})?`)) return
    setBaixando(g.chave); setErro(null)
    try {
      await enviar('/api/financeiro/acerto', 'POST', { mes, chave: g.chave })
      mutate(); aoMudar()
    } catch (e: any) { setErro(e.message) } finally { setBaixando(null) }
  }

  async function copiar(g: any) {
    await navigator.clipboard.writeText(textoDoAcerto(g, mes))
    setCopiado(g.chave)
    setTimeout(() => setCopiado(null), 2000)
  }

  const grupos: any[] = acerto?.grupos ?? []

  return (
    <div className="mb-7">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="titulo-secao flex items-center gap-2">
          <Handshake size={16} className="text-brand-500" /> Acerto de campanhas
        </h2>
        <input type="month" className="campo !mt-0 !w-auto !py-1.5 text-[12.5px]" value={mes}
          max={mesAtual()} onChange={(e) => e.target.value && setMes(e.target.value)} />
      </div>

      {erro && <p className="text-xs text-red-600 mb-2">{erro}</p>}

      {!acerto ? (
        <div className="cartao p-5 flex justify-center"><Loader2 className="animate-spin text-neutro-300" /></div>
      ) : grupos.length === 0 ? (
        <div className="cartao p-5 text-[12.5px] text-neutro-400">
          Nenhuma consulta concluída de campanha com valor de referência em {mesExtenso(mes)}.
          Defina o valor de referência na campanha para controlar a diferença das vendas na ótica.
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => (
            <div key={g.chave} className="cartao">
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="font-semibold">{titulo(g)}</p>
                    <p className="text-[11.5px] text-neutro-400 capitalize">{mesExtenso(mes)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => copiar(g)} className="btn-suave !py-1.5 !px-2.5 !text-[12px]"
                      title="Copia o resumo para mandar por WhatsApp ou e-mail">
                      {copiado === g.chave ? <Check size={13} /> : <Copy size={13} />}
                      {copiado === g.chave ? 'Copiado' : 'Copiar resumo'}
                    </button>
                    {g.pendente > 0 && (
                      <button onClick={() => registrar(g)} disabled={baixando === g.chave}
                        className="btn-primario !py-1.5 !px-2.5 !text-[12px]">
                        {baixando === g.chave && <Loader2 size={13} className="animate-spin" />}
                        Registrar acerto pago
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    ['Consultas', g.consultas],
                    ['Compraram na ótica', `${g.vendas} (${g.conversao.toLocaleString('pt-BR')}%)`],
                    ['Cobrado', moeda(g.cobrado)],
                    ['Diferenças', moeda(g.diferenca)],
                    [g.pendente > 0 ? 'Pendente' : 'Situação', g.pendente > 0 ? moeda(g.pendente) : 'Acertado'],
                  ].map(([r, v]) => (
                    <div key={r as string}>
                      <p className="text-[10.5px] text-neutro-400 uppercase tracking-wide">{r}</p>
                      <p className={`font-semibold numerico ${r === 'Pendente' ? 'text-amber-600' : r === 'Situação' ? 'text-brand-600' : ''}`}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => setAberto(aberto === g.chave ? null : g.chave)}
                className="w-full px-5 py-2.5 border-t border-neutro-100 dark:border-neutro-800 text-[12px] text-neutro-500 hover:text-neutro-700 flex items-center justify-center gap-1">
                {aberto === g.chave ? 'Esconder consultas' : `Ver as ${g.consultas} consultas`}
                <ChevronDown size={14} className={`transition-transform ${aberto === g.chave ? 'rotate-180' : ''}`} />
              </button>

              {aberto === g.chave && (
                <div className="border-t border-neutro-100 dark:border-neutro-800 divide-y divide-neutro-100 dark:divide-neutro-800">
                  {g.itens.map((i: any) => (
                    <div key={i.consultaId} className="px-5 py-2.5 flex items-center gap-3 text-[12.5px]">
                      <span className="text-neutro-400 w-20 shrink-0">{data(i.data)}</span>
                      <span className="flex-1 min-w-0 truncate">{i.paciente} <span className="text-neutro-400">· {i.campanha}</span></span>
                      <span className="numerico text-neutro-500 shrink-0">{moeda(i.cobrado)}</span>
                      {i.vendaFechada ? (
                        <span className={`shrink-0 flex items-center gap-1 font-medium numerico ${i.situacao === 'PAGO' ? 'text-brand-600' : 'text-amber-600'}`}>
                          <ShoppingBag size={12} /> + {moeda(i.diferenca)} {i.situacao === 'PAGO' ? '(pago)' : ''}
                        </span>
                      ) : (
                        <span className="shrink-0 text-neutro-300 dark:text-neutro-600">não comprou</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
