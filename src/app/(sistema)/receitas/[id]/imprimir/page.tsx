'use client'

import { useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import useSWR from 'swr'
import { Printer, Loader2, AlertCircle, Eye } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { data } from '@/lib/formato'

/**
 * A via em papel da receita — o que o paciente leva para a ótica.
 *
 * Impressão sai pelo diálogo do navegador em vez de uma biblioteca de PDF:
 * o mesmo diálogo já oferece "Salvar como PDF", então uma dependência a mais
 * resolveria um problema que o navegador resolve sozinho. O que vale a pena
 * cuidar é o CSS de impressão — é ele que tira menu, cabeçalho e botões da
 * folha, deixando só o documento.
 */

const TIPO_LENTE: Record<string, string> = {
  MONOFOCAL: 'Monofocal', BIFOCAL: 'Bifocal', MULTIFOCAL: 'Multifocal',
  OCUPACIONAL: 'Ocupacional', CONTATO: 'Lente de contato',
}

const temValor = (v: any) => v !== null && v !== undefined && String(v).trim() !== ''

function idade(nascimento?: string | null) {
  if (!nascimento) return null
  const n = new Date(nascimento)
  const hoje = new Date()
  let anos = hoje.getFullYear() - n.getFullYear()
  const m = hoje.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) anos--
  return anos
}

export default function ImprimirReceitaPage() {
  const { id } = useParams<{ id: string }>()
  const { data: r, isLoading, error } = useSWR(`/api/receitas/${id}`, fetcher)
  const jaImprimiu = useRef(false)

  // Quem clicou no ícone de impressora já pediu para imprimir: abrir o
  // diálogo sozinho poupa um clique. O guard evita reabrir a cada revalidação
  // do SWR, que deixaria o diálogo piscando na tela.
  useEffect(() => {
    if (!r || jaImprimiu.current) return
    jaImprimiu.current = true
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [r])

  if (isLoading) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="animate-spin text-neutro-300" />
      </div>
    )
  }

  if (error || !r) {
    return (
      <div className="p-10 flex flex-col items-center text-center">
        <AlertCircle size={22} className="text-amber-500 mb-2" strokeWidth={1.9} />
        <p className="text-[14px] font-medium">Receita não encontrada</p>
        <p className="text-[12px] text-neutro-400 mt-1">{error?.message}</p>
      </div>
    )
  }

  const anos = idade(r.paciente?.dataNascimento)

  return (
    <div className="p-4 sm:p-7 max-w-[820px] mx-auto">
      <div className="flex items-center justify-between mb-5 nao-imprimir">
        <p className="text-[12px] text-neutro-400">
          Confira antes de imprimir. O diálogo do navegador também salva em PDF.
        </p>
        <button onClick={() => window.print()} className="btn-primario">
          <Printer size={16} strokeWidth={2.2} /> Imprimir
        </button>
      </div>

      <article className="documento cartao p-10">
        {/* Cabeçalho da clínica */}
        <header className="flex items-start justify-between pb-5 border-b border-neutro-300">
          <div className="flex items-center gap-3">
            {/* Com logo, ela manda no cabeçalho; sem logo, cai no símbolo do
                Medflow para o papel não sair com um buraco. A altura é fixa e
                a largura livre, então logo horizontal e brasão quadrado saem
                com o mesmo peso visual sem deformar nenhum dos dois. */}
            {r.consultorio?.logoUrl ? (
              <img
                src={r.consultorio.logoUrl}
                alt={r.consultorio.nome}
                className="h-12 w-auto max-w-[220px] object-contain"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center text-white">
                <Eye size={20} strokeWidth={2.2} />
              </div>
            )}
            <div>
              <p className="text-[16px] font-semibold tracking-apertado">
                {r.consultorio?.nome}
              </p>
              <p className="text-[11px] text-neutro-500">
                {[r.consultorio?.telefone, r.consultorio?.endereco].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-semibold tracking-wide">RECEITA OFTÁLMICA</p>
            <p className="text-[11px] text-neutro-500 numerico">
              Emitida em {data(r.dataEmissao)}
            </p>
            <p className="text-[11px] text-neutro-500 numerico">
              Válida até {data(r.validadeAte)}
            </p>
          </div>
        </header>

        {/* Paciente */}
        <section className="py-4 border-b border-neutro-200">
          <div className="flex flex-wrap gap-x-8 gap-y-1">
            <Dado rotulo="Paciente" valor={r.paciente?.nome} destaque />
            {anos !== null && <Dado rotulo="Idade" valor={`${anos} anos`} />}
            {temValor(r.paciente?.cpf) && <Dado rotulo="CPF" valor={r.paciente.cpf} />}
          </div>
        </section>

        {/* Grau */}
        <section className="py-5">
          <Titulo>Grau prescrito</Titulo>
          <table className="w-full text-[12.5px] mt-3 border-collapse">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wide text-neutro-500">
                <th className="text-left font-medium py-1.5 w-24"></th>
                <th className="text-left font-medium py-1.5">Esférico</th>
                <th className="text-left font-medium py-1.5">Cilíndrico</th>
                <th className="text-left font-medium py-1.5">Eixo</th>
                <th className="text-left font-medium py-1.5">Adição</th>
              </tr>
            </thead>
            <tbody className="numerico">
              <LinhaOlho
                olho="OD (direito)"
                esf={r.longeEsfericoOD} cil={r.longeCilindricoOD}
                eixo={r.longeEixoOD} adicao={r.adicaoOD}
              />
              <LinhaOlho
                olho="OE (esquerdo)"
                esf={r.longeEsfericoOE} cil={r.longeCilindricoOE}
                eixo={r.longeEixoOE} adicao={r.adicaoOE}
              />
            </tbody>
          </table>
        </section>

        {/* Acuidade alcançada — o número que o paciente quer saber */}
        {(temValor(r.avCorrigidaOD) || temValor(r.avCorrigidaOE)) && (
          <section className="pb-5">
            <Titulo>Acuidade visual com esta correção</Titulo>
            <div className="flex gap-8 mt-2 numerico text-[12.5px]">
              <Dado rotulo="OD" valor={r.avCorrigidaOD || '—'} />
              <Dado rotulo="OE" valor={r.avCorrigidaOE || '—'} />
            </div>
          </section>
        )}

        {/* Montagem */}
        {[r.dpLongeOD, r.dpLongeOE, r.dpPerto, r.alturaOD, r.alturaOE,
          r.prismaOD, r.prismaOE].some(temValor) && (
          <section className="pb-5">
            <Titulo>Medidas de montagem</Titulo>
            <div className="flex flex-wrap gap-x-8 gap-y-1.5 mt-2 numerico text-[12.5px]">
              {temValor(r.dpLongeOD) && <Dado rotulo="DP longe OD" valor={`${r.dpLongeOD} mm`} />}
              {temValor(r.dpLongeOE) && <Dado rotulo="DP longe OE" valor={`${r.dpLongeOE} mm`} />}
              {temValor(r.dpPerto) && <Dado rotulo="DP perto" valor={`${r.dpPerto} mm`} />}
              {temValor(r.alturaOD) && <Dado rotulo="Altura OD" valor={`${r.alturaOD} mm`} />}
              {temValor(r.alturaOE) && <Dado rotulo="Altura OE" valor={`${r.alturaOE} mm`} />}
              {temValor(r.prismaOD) && (
                <Dado rotulo="Prisma OD" valor={`${r.prismaOD} ${r.baseprismaOD ?? ''}`} />
              )}
              {temValor(r.prismaOE) && (
                <Dado rotulo="Prisma OE" valor={`${r.prismaOE} ${r.baseprismaOE ?? ''}`} />
              )}
            </div>
          </section>
        )}

        {/* Lente */}
        <section className="pb-5">
          <Titulo>Lente indicada</Titulo>
          <div className="flex flex-wrap gap-x-8 gap-y-1.5 mt-2 text-[12.5px]">
            <Dado rotulo="Tipo" valor={TIPO_LENTE[r.tipoLente] ?? r.tipoLente} />
            {temValor(r.materialLente) && <Dado rotulo="Material" valor={r.materialLente} />}
            {temValor(r.tratamentos) && <Dado rotulo="Tratamentos" valor={r.tratamentos} />}
          </div>
          {temValor(r.orientacoesUso) && (
            <p className="text-[12.5px] mt-3">
              <span className="text-neutro-500">Orientações de uso: </span>
              {r.orientacoesUso}
            </p>
          )}
        </section>

        {/* Assinatura — com o registro no conselho, que é o que dá validade
            à prescrição na hora de a ótica montar a lente. */}
        <footer className="pt-12 flex justify-end">
          <div className="text-center w-72">
            <div className="border-t border-neutro-400 pt-2">
              <p className="text-[12.5px] font-semibold">
                {r.profissional?.nome ?? 'Profissional responsável'}
              </p>
              {r.profissional?.registroProfissional ? (
                <p className="text-[11.5px] text-neutro-600 numerico">
                  {[r.profissional.conselhoProfissional, r.profissional.registroProfissional]
                    .filter(Boolean)
                    .join(' ')}
                </p>
              ) : (
                <p className="text-[11px] text-neutro-400 nao-imprimir">
                  Registro não preenchido — informe em Perfil
                </p>
              )}
              <p className="text-[11px] text-neutro-500 mt-0.5">{r.consultorio?.nome}</p>
            </div>
          </div>
        </footer>
      </article>
    </div>
  )
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold tracking-wider uppercase text-neutro-500">
      {children}
    </h2>
  )
}

function Dado({ rotulo, valor, destaque }: { rotulo: string; valor: any; destaque?: boolean }) {
  return (
    <div>
      <p className="text-[10.5px] text-neutro-500">{rotulo}</p>
      <p className={destaque ? 'text-[14px] font-semibold' : 'text-[12.5px] font-medium'}>
        {valor ?? '—'}
      </p>
    </div>
  )
}

function LinhaOlho({ olho, esf, cil, eixo, adicao }: any) {
  const celula = (v: any) => (temValor(v) ? String(v) : '—')
  return (
    <tr className="border-t border-neutro-200">
      <td className="py-2 font-medium text-[12px]">{olho}</td>
      <td className="py-2">{celula(esf)}</td>
      <td className="py-2">{celula(cil)}</td>
      <td className="py-2">{temValor(eixo) ? `${eixo}°` : '—'}</td>
      <td className="py-2">{celula(adicao)}</td>
    </tr>
  )
}
