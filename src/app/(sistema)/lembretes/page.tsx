'use client'

import useSWR from 'swr'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  BellRing, CalendarCheck, CalendarX2, Receipt, RefreshCw, Wallet,
  MessageCircle, PhoneOff, Globe, Check,
} from 'lucide-react'
import { fetcher } from '@/lib/fetcher'
import { data, dataHora, hora, moeda } from '@/lib/formato'
import { linkWhatsApp } from '@/lib/whatsapp'

/**
 * Central de contatos pendentes.
 *
 * Cada item nasce de um dado real do sistema e some sozinho quando o motivo
 * deixa de existir — a consulta foi concluída, a receita foi renovada, o
 * paciente voltou. Por isso não há botão de "marcar como feito": resolver o
 * lembrete é resolver o que ele aponta.
 */

export default function LembretesPage() {
  const { data: lembretes, isLoading } = useSWR('/api/lembretes', fetcher, {
    refreshInterval: 60_000,
  })

  const blocos = [
    {
      chave: 'confirmacoes',
      titulo: 'Confirmar presença',
      descricao: 'Consultas nas próximas 48 horas',
      icone: CalendarCheck,
      cor: 'text-brand-600 bg-brand-50 dark:bg-brand-900/30',
      itens: lembretes?.confirmacoes ?? [],
      detalhe: (i: any) => (i.hoje ? `Hoje às ${hora(i.quando)}` : dataHora(i.quando)),
      mensagem: (i: any) =>
        `Olá, ${i.paciente}! Passando para confirmar sua consulta em ${dataHora(i.quando)}. Podemos contar com você?`,
      selo: (i: any) => (i.origemPublica ? 'Online' : null),
    },
    {
      chave: 'remarcar',
      titulo: 'Remarcar faltas',
      descricao: 'Faltou e ainda não tem novo horário',
      icone: CalendarX2,
      cor: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40',
      itens: lembretes?.remarcar ?? [],
      detalhe: (i: any) => `Faltou em ${dataHora(i.quando)}`,
      mensagem: (i: any) =>
        `Olá, ${i.paciente}! Sentimos sua falta na consulta de ${data(i.quando)}. Quer remarcar para outro dia?`,
      selo: () => null,
    },
    {
      chave: 'receitasVencendo',
      titulo: 'Receitas a renovar',
      descricao: 'Vencidas há pouco ou vencendo em 45 dias',
      icone: Receipt,
      cor: 'text-neutro-600 bg-neutro-100 dark:bg-neutro-800 dark:text-neutro-300',
      itens: lembretes?.receitasVencendo ?? [],
      detalhe: (i: any) =>
        i.vencida ? `Venceu em ${data(i.validadeAte)}` : `Vence em ${data(i.validadeAte)}`,
      mensagem: (i: any) =>
        `Olá, ${i.paciente}! Sua receita ${i.vencida ? 'venceu' : 'vence'} em ${data(i.validadeAte)}. Vamos agendar um novo exame?`,
      selo: (i: any) => (i.vencida ? 'Vencida' : null),
    },
    {
      chave: 'retornos',
      titulo: 'Retorno anual',
      descricao: 'Sem consulta há mais de 12 meses',
      icone: RefreshCw,
      cor: 'text-neutro-600 bg-neutro-100 dark:bg-neutro-800 dark:text-neutro-300',
      itens: lembretes?.retornos ?? [],
      detalhe: (i: any) =>
        i.ultimaConsulta ? `Última consulta em ${data(i.ultimaConsulta)}` : 'Sem histórico recente',
      mensagem: (i: any) =>
        `Olá, ${i.paciente}! Já faz mais de um ano desde seu último exame de vista. Que tal agendar uma revisão?`,
      selo: () => null,
    },
    {
      chave: 'financeiro',
      titulo: 'Pagamentos em atraso',
      descricao: 'Lançamentos pendentes com data vencida',
      icone: Wallet,
      cor: 'text-red-600 bg-red-50 dark:bg-red-950/40',
      itens: lembretes?.financeiro ?? [],
      detalhe: (i: any) => `${i.descricao} — venceu em ${data(i.data)}`,
      mensagem: (i: any) =>
        `Olá, ${i.paciente}! Consta em aberto o pagamento de ${moeda(i.valor)} referente a ${i.descricao}. Podemos acertar?`,
      selo: (i: any) => moeda(i.valor),
    },
  ]

  const total = lembretes?.total ?? 0

  return (
    <div className="p-4 sm:p-7 max-w-[1100px]">
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="titulo-pagina">Lembretes</h1>
          <p className="subtitulo mt-1">Quem precisa de um contato hoje</p>
        </div>
        {!isLoading && (
          <span className="etiqueta bg-neutro-100 text-neutro-600 dark:bg-neutro-800 dark:text-neutro-400">
            <BellRing size={12} strokeWidth={2} /> {total} pendência{total === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <div key={i} className="esqueleto h-[150px]" />)}
        </div>
      ) : total === 0 ? (
        <div className="cartao py-20 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center mb-3">
            <Check size={22} strokeWidth={2} />
          </div>
          <p className="text-[14px] font-medium">Nenhum contato pendente</p>
          <p className="text-[12px] text-neutro-400 mt-1">
            Consultas confirmadas, receitas em dia e ninguém para remarcar.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {blocos.filter((b) => b.itens.length > 0).map((bloco, indice) => (
            <motion.section key={bloco.chave}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: indice * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="cartao overflow-hidden">

              <div className="flex items-center gap-3 px-5 py-4 border-b border-neutro-100 dark:border-neutro-800">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${bloco.cor}`}>
                  <bloco.icone size={17} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="titulo-secao">{bloco.titulo}</h2>
                  <p className="text-[11px] text-neutro-400 mt-0.5">{bloco.descricao}</p>
                </div>
                <span className="text-[13px] font-medium numerico text-neutro-400">
                  {bloco.itens.length}
                </span>
              </div>

              <div className="divide-y divide-neutro-100 dark:divide-neutro-800">
                {bloco.itens.map((item: any) => {
                  const whats = linkWhatsApp(item.telefone, bloco.mensagem(item))
                  const selo = bloco.selo(item)

                  return (
                    <div key={`${bloco.chave}-${item.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.pacienteId ? (
                            <Link href={`/pacientes?paciente=${item.pacienteId}`}
                              className="text-[13.5px] font-medium truncate hover:text-brand-600 transition-colors">
                              {item.paciente ?? 'Sem paciente vinculado'}
                            </Link>
                          ) : (
                            <span className="text-[13.5px] font-medium truncate">
                              {item.paciente ?? 'Sem paciente vinculado'}
                            </span>
                          )}
                          {selo === 'Online' && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-brand-600 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded">
                              <Globe size={10} strokeWidth={2.2} /> Online
                            </span>
                          )}
                          {selo && selo !== 'Online' && (
                            <span className="text-[10px] font-medium text-neutro-500 bg-neutro-100 dark:bg-neutro-800 px-1.5 py-0.5 rounded numerico">
                              {selo}
                            </span>
                          )}
                        </div>
                        <p className="text-[11.5px] text-neutro-400 mt-0.5 truncate">
                          {bloco.detalhe(item)}
                        </p>
                      </div>

                      {whats ? (
                        <a href={whats} target="_blank" rel="noreferrer"
                          className="btn-suave !py-2 !px-3 !text-[12px] shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                          <MessageCircle size={14} strokeWidth={2} /> WhatsApp
                        </a>
                      ) : (
                        <span title="Paciente sem telefone cadastrado"
                          className="flex items-center gap-1.5 text-[11px] text-neutro-400 shrink-0">
                          <PhoneOff size={13} strokeWidth={2} /> Sem telefone
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </motion.section>
          ))}
        </div>
      )}
    </div>
  )
}
