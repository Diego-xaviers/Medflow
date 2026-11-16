'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, LogIn } from 'lucide-react'
import {
  INCLUI,
  ORDEM_PLANOS,
  PRECO_TABELA,
  ROTULO,
  TETO_USUARIOS,
  type PlanoNome,
} from '@/lib/planos'
import { DEPOIMENTOS } from '@/lib/depoimentos'
import Previa from './Previa'

/**
 * A página de apresentação do Medflow.
 *
 * Cliente porque o plano escolhido é estado compartilhado: o seletor da
 * prévia e o comparativo de planos apontam para o mesmo valor, então clicar
 * "Pro" no comparativo muda a prévia e vice-versa. Duas cópias desse estado
 * davam a sensação de dois sites colados.
 *
 * Nenhum texto de plano é escrito aqui: preço, itens e teto vêm de
 * `src/lib/planos.ts`, que é também quem o sistema consulta para liberar ou
 * barrar. É isso que impede o clássico "o site prometia relatório no Básico".
 */
export default function Apresentacao() {
  const [plano, setPlano] = useState<PlanoNome>('PRO')

  return (
    <div className="min-h-screen bg-neutro-50 dark:bg-neutro-950">
      {/* ─── Topo ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-neutro-50/85 dark:bg-neutro-950/85 backdrop-blur-md border-b border-neutro-200/70 dark:border-neutro-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[9px] bg-brand-500 flex items-center justify-center shadow-suave shrink-0">
              <span
                className="text-brand-950 font-black text-[18px] leading-none"
                style={{ letterSpacing: '-2px', marginRight: '-1px' }}
              >
                +
              </span>
            </div>
            <div>
              <p className="text-[15px] font-bold leading-none tracking-apertado">Medflow</p>
              <p className="text-[9px] font-semibold tracking-widest text-neutro-400 mt-1 uppercase">
                Gestão Clínica
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-suave text-[13px] px-3 py-2">
              <LogIn size={15} strokeWidth={2.2} /> Entrar
            </Link>
            <Link href="#planos" className="btn-marca text-[13px] px-3.5 py-2">
              Ver planos
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-14 pb-10 sm:pt-20 text-center">
        <p className="etiqueta bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-400 mb-5">
          Para clínicas de oftalmologia e optometria
        </p>
        <h1 className="text-[30px] sm:text-[44px] font-semibold tracking-apertado leading-[1.1]">
          A clínica inteira numa tela,
          <br className="hidden sm:block" /> do agendamento à receita
        </h1>
        <p className="text-[14.5px] sm:text-[16px] text-neutro-500 mt-5 max-w-xl mx-auto leading-relaxed">
          Agenda, prontuário, receita, financeiro e relatórios no mesmo lugar.
          Sem planilha, sem caderno e sem pagar por módulo que você não usa.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center mt-7">
          <Link href="#previa" className="btn-primario">
            Ver o sistema funcionando <ArrowRight size={15} strokeWidth={2.2} />
          </Link>
          <Link href="#planos" className="btn-suave">
            Escolher um plano
          </Link>
        </div>
      </section>

      {/* ─── Prévia ───────────────────────────────────────────── */}
      <section id="previa" className="max-w-3xl mx-auto px-4 sm:px-6 py-10 scroll-mt-[72px]">
        <div className="text-center mb-7">
          <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-apertado">
            Veja antes de assinar
          </h2>
          <p className="text-[13.5px] text-neutro-500 mt-2 max-w-md mx-auto leading-relaxed">
            Estas são as telas do sistema, com dados de exemplo. Troque o plano
            e veja exatamente o que abre e o que fica de fora.
          </p>
        </div>
        <Previa plano={plano} aoTrocarPlano={setPlano} />
      </section>

      {/* ─── Planos ───────────────────────────────────────────── */}
      <section id="planos" className="max-w-5xl mx-auto px-4 sm:px-6 py-12 scroll-mt-[72px]">
        <div className="text-center mb-8">
          <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-apertado">
            Planos
          </h2>
          <p className="text-[13.5px] text-neutro-500 mt-2">
            Mensal, sem fidelidade. Troca de plano a qualquer momento.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {ORDEM_PLANOS.map((p) => {
            const destaque = p === plano
            const teto = TETO_USUARIOS[p]
            return (
              <div
                key={p}
                className={`cartao p-5 flex flex-col transition-all duration-200 ${
                  destaque
                    ? 'border-brand-400 dark:border-brand-700 shadow-media'
                    : 'hover:border-neutro-300 dark:hover:border-neutro-700'
                }`}
              >
                <button
                  onClick={() => setPlano(p)}
                  className="text-left"
                  aria-label={`Ver o plano ${ROTULO[p]} na prévia`}
                >
                  <p className="titulo-secao">{ROTULO[p]}</p>
                  <p className="mt-2">
                    <span className="numero-destaque">
                      R$ {PRECO_TABELA[p].toLocaleString('pt-BR')}
                    </span>
                    <span className="text-[12.5px] text-neutro-400"> /mês</span>
                  </p>
                  <p className="text-[11.5px] text-neutro-400 mt-1">
                    {teto === null
                      ? 'Usuários ilimitados'
                      : `${teto} ${teto === 1 ? 'usuário' : 'usuários'}`}
                  </p>
                </button>

                <ul className="mt-4 space-y-1.5 flex-1">
                  {INCLUI[p].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-[12.5px] text-neutro-600 dark:text-neutro-300"
                    >
                      <Check
                        size={13}
                        className="text-brand-600 shrink-0 mt-[3px]"
                        strokeWidth={2.4}
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/cadastro?plano=${p}`}
                  className={`${destaque ? 'btn-marca' : 'btn-suave'} w-full mt-5`}
                >
                  Assinar o {ROTULO[p]}
                </Link>
              </div>
            )
          })}
        </div>

        <p className="text-[11.5px] text-neutro-400 text-center mt-5 max-w-lg mx-auto leading-relaxed">
          Você cria a conta e entra no sistema na hora. A cobrança é ligada
          dentro dele, na tela de Cobrança, por PIX ou cartão.
        </p>
      </section>

      {/* ─── Depoimentos ──────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-apertado text-center mb-8">
          Quem já usa
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DEPOIMENTOS.map((d) => (
            <figure key={d.nome} className="cartao p-4 flex flex-col">
              <blockquote className="text-[13px] text-neutro-600 dark:text-neutro-300 leading-relaxed flex-1">
                “{d.texto}”
              </blockquote>
              <figcaption className="flex items-center gap-2.5 mt-4 pt-4 border-t border-neutro-200/70 dark:border-neutro-800">
                {/* <img> puro, como em sign-in.tsx: o avatar vem do Unsplash, e
                    next/image exigiria remotePatterns no next.config só para
                    quatro fotos decorativas. O CSP já libera img-src https:. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.avatarSrc}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold truncate">{d.nome}</p>
                  <p className="text-[11px] text-neutro-400 truncate">{d.cargo}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ─── Dúvidas ──────────────────────────────────────────── */}
      <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-apertado text-center mb-8">
          Dúvidas
        </h2>
        <div className="space-y-2">
          {[
            [
              'Tem contrato ou fidelidade?',
              'Não. A assinatura é mensal e você cancela quando quiser, pela própria tela de Cobrança.',
            ],
            [
              'Posso trocar de plano depois?',
              'Sim, para cima ou para baixo. A troca vale na próxima cobrança e nenhum dado é apagado no caminho.',
            ],
            [
              'Os dados dos meus pacientes ficam seguros?',
              'Cada clínica só enxerga os próprios dados, e todo acesso a prontuário fica registrado. Tratamos dado de saúde conforme a LGPD — os detalhes estão na política de privacidade.',
            ],
            [
              'Preciso instalar algo?',
              'Não. Funciona no navegador, e no celular dá para instalar como aplicativo na tela inicial.',
            ],
            [
              'Existe teste grátis?',
              'Não, e por um motivo honesto: parte do produto custa por uso. Em vez de trial, a prévia aqui em cima mostra o sistema de verdade antes de você decidir.',
            ],
          ].map(([pergunta, resposta]) => (
            <details key={pergunta} className="cartao px-4 py-3 group">
              <summary className="text-[13.5px] font-medium cursor-pointer list-none flex items-center justify-between gap-3">
                {pergunta}
                <span className="text-neutro-400 group-open:rotate-45 transition-transform duration-200 shrink-0">
                  +
                </span>
              </summary>
              <p className="text-[12.5px] text-neutro-500 leading-relaxed mt-2.5">{resposta}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ─── Rodapé ───────────────────────────────────────────── */}
      <footer className="border-t border-neutro-200/70 dark:border-neutro-800 mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-7 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11.5px] text-neutro-400">
            © {new Date().getFullYear()} Medflow · Gestão clínica
          </p>
          <nav className="flex items-center gap-4 text-[11.5px] text-neutro-400">
            <Link href="/termos" className="hover:text-neutro-600 dark:hover:text-neutro-300">
              Termos de uso
            </Link>
            <Link
              href="/politica-de-privacidade"
              className="hover:text-neutro-600 dark:hover:text-neutro-300"
            >
              Privacidade
            </Link>
            <Link href="/login" className="hover:text-neutro-600 dark:hover:text-neutro-300">
              Entrar
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
