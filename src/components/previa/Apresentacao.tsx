'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  FileText,
  LogIn,
  MessageCircle,
  Minus,
  Plus,
  Printer,
  QrCode,
  Smartphone,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import {
  INCLUI,
  ORDEM_PLANOS,
  PRECO_TABELA,
  ROTULO,
  TETO_USUARIOS,
  type PlanoNome,
} from '@/lib/planos'
import { DEPOIMENTOS } from '@/lib/depoimentos'
import { CLINICAS_PARCEIRAS } from '@/lib/clientes'
import { postsRecentes } from '@/lib/posts'
import { linkContatoWhatsApp } from '@/lib/contato'
import { data as formatarData } from '@/lib/formato'
import Previa from './Previa'
import { TelaAgenda, TelaFinanceiro, TelaProntuario, TelaReceita } from './telas'

/**
 * O sistema de verdade só entra no pacote de quem rola até o quadro — são as
 * telas inteiras de `/app` atrás dele.
 */
const SistemaDemo = dynamic(() => import('@/components/demo/SistemaDemo'), {
  ssr: false,
  loading: () => (
    <div className="h-[560px] sm:h-[680px] grid place-items-center">
      <p className="text-[13px] text-neutro-400">Abrindo a demonstração…</p>
    </div>
  ),
})

/**
 * A página de apresentação do Medflow.
 *
 * Ela tem uma linguagem visual própria — título grande de peso médio, selo
 * em cápsula, painel cinza emoldurando print, esteira que anda sozinha — e
 * isso é proposital: a vitrine vende, o sistema opera. As classes dessa
 * linguagem moram em `globals.css` sob "Vitrine" para não vazarem para
 * dentro de `/app`, onde a régua é densidade de informação.
 *
 * Cliente porque o plano escolhido é estado compartilhado: o seletor do
 * demonstrativo e o comparativo de planos apontam para o mesmo valor, então
 * clicar "Pro" num muda o outro. Duas cópias desse estado davam a sensação
 * de dois sites colados.
 *
 * Nenhum texto de plano é escrito aqui: preço, itens e teto vêm de
 * `src/lib/planos.ts`, que é também quem o sistema consulta para liberar ou
 * barrar. É isso que impede o clássico "o site prometia relatório no Básico".
 *
 * Três seções aparecem só quando há o que mostrar — clínicas (`clientes.ts`),
 * blog (`posts.ts`) e os botões de WhatsApp (`contato.ts`). Seção vazia passa
 * a impressão contrária da que ela existe para passar.
 */

const MENSAGEM_DEMO =
  'Olá! Vi o site do Medflow e quero ver uma demonstração do sistema para minha clínica.'

export default function Apresentacao() {
  const [plano, setPlano] = useState<PlanoNome>('PRO')
  const posts = postsRecentes(3)
  const linkDemo = linkContatoWhatsApp(MENSAGEM_DEMO)

  return (
    <div className="min-h-screen bg-white dark:bg-neutro-950 overflow-x-hidden">
      <Topo linkDemo={linkDemo} temBlog={posts.length > 0} />
      <Hero linkDemo={linkDemo} />
      <EsteiraDeClinicas />
      <Plataforma />
      <Abas />
      <EmUmaTela />
      <Depoimentos />
      <Planos plano={plano} aoTrocarPlano={setPlano} />
      <Comparativo />
      <Integracoes />
      <Duvidas />
      {posts.length > 0 && <Blog posts={posts} />}
      <ChamadaFinal linkDemo={linkDemo} />
      <Rodape linkDemo={linkDemo} temBlog={posts.length > 0} />
    </div>
  )
}

/* ───────────────────── Peças da linguagem visual ───────────────────── */

/** Entra quando chega na tela, uma vez só. */
function Revelar({
  children,
  atraso = 0,
  className,
}: {
  children: React.ReactNode
  atraso?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay: atraso, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function Cabecalho({
  selo,
  titulo,
  texto,
}: {
  selo: string
  titulo: React.ReactNode
  texto: string
}) {
  return (
    <Revelar className="text-center">
      <span className="selo">{selo}</span>
      <h2 className="titulo-vitrine mt-5">{titulo}</h2>
      <p className="subtitulo-vitrine mt-4">{texto}</p>
    </Revelar>
  )
}

/**
 * Faixa que anda sozinha. O conteúdo vai duplicado e a animação corre até
 * -50%: no instante do salto, a cópia está exatamente onde o original
 * começou, então não existe emenda visível.
 */
function Esteira({
  children,
  rapida = false,
}: {
  children: React.ReactNode
  rapida?: boolean
}) {
  return (
    <div className="esteira-mascara overflow-hidden">
      <div
        className={`flex w-max ${rapida ? 'animate-esteira-rapida' : 'animate-esteira'}`}
        /* Parar no hover é o mínimo de respeito com quem está lendo um
           depoimento no meio da faixa. */
        onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = 'paused')}
        onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = 'running')}
      >
        {children}
        {/* A cópia. `aria-hidden` porque o leitor de tela já leu a primeira. */}
        <div aria-hidden className="flex">
          {children}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── Topo ─────────────────────────── */

function Topo({ linkDemo, temBlog }: { linkDemo: string | null; temBlog: boolean }) {
  const secoes: [string, string][] = [
    ['Recursos', '#recursos'],
    ['Demonstrativo', '#demonstrativo'],
    ['Planos', '#planos'],
    ['Integrações', '#integracoes'],
    ...(temBlog ? ([['Blog', '#blog']] as [string, string][]) : []),
    ['Dúvidas', '#duvidas'],
  ]

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-neutro-950/80 backdrop-blur-xl border-b border-neutro-200/60 dark:border-neutro-800/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[68px] flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center shadow-suave">
            <span
              className="text-brand-950 font-black text-[20px] leading-none"
              style={{ letterSpacing: '-2px', marginRight: '-1px' }}
            >
              +
            </span>
          </div>
          <p className="text-[19px] font-semibold tracking-[-0.03em]">Medflow</p>
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {secoes.map(([rotulo, href]) => (
            <a
              key={href}
              href={href}
              className="text-[14px] text-neutro-600 dark:text-neutro-400 hover:text-neutro-900 dark:hover:text-white transition-colors duration-200"
            >
              {rotulo}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/login"
            className="hidden sm:inline-flex btn-pilula text-neutro-600 dark:text-neutro-300 hover:text-neutro-900 dark:hover:text-white"
          >
            <LogIn size={15} strokeWidth={2.2} /> Entrar
          </Link>
          {linkDemo ? (
            <a
              href={linkDemo}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pilula-escuro"
            >
              Agendar demonstração <ArrowRight size={15} strokeWidth={2.2} />
            </a>
          ) : (
            <a href="#planos" className="btn-pilula-escuro">
              Ver planos <ArrowRight size={15} strokeWidth={2.2} />
            </a>
          )}
        </div>
      </div>
    </header>
  )
}

/* ─────────────────────────── Hero ─────────────────────────── */

const TITULO = 'A clínica inteira numa tela, do agendamento à receita'

function Hero({ linkDemo }: { linkDemo: string | null }) {
  return (
    <section className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-brand-500/10 via-transparent to-transparent"
      />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 text-center">
        <span className="selo animate-surgir">
          <Sparkles size={13} className="text-brand-600" strokeWidth={2.2} />
          Feito para oftalmologia e optometria
        </span>

        {/* Palavra a palavra: cada uma chega desfocada 40ms depois da
            anterior. É o movimento que a página inteira repete depois. */}
        <h1 className="text-[36px] sm:text-[58px] font-medium leading-[1.04] tracking-[-0.035em] mt-6 max-w-3xl mx-auto">
          {TITULO.split(' ').map((palavra, i) => (
            <span
              key={`${palavra}-${i}`}
              className="inline-block animate-surgir"
              style={{ animationDelay: `${0.08 + i * 0.04}s` }}
            >
              {palavra}&nbsp;
            </span>
          ))}
        </h1>

        <p
          className="subtitulo-vitrine mt-6 animate-surgir"
          style={{ animationDelay: '0.5s' }}
        >
          Agenda, prontuário, receita, financeiro e relatórios no mesmo lugar.
          Sem planilha, sem caderno e sem pagar por módulo que você não usa.
        </p>

        <div
          className="flex flex-col sm:flex-row gap-3 justify-center mt-8 animate-surgir"
          style={{ animationDelay: '0.6s' }}
        >
          <Link href="/cadastro?plano=PRO" className="btn-pilula-escuro">
            Começar agora <ArrowRight size={15} strokeWidth={2.2} />
          </Link>
          {linkDemo ? (
            <a
              href={linkDemo}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pilula-claro"
            >
              <MessageCircle size={15} strokeWidth={2.2} /> Agendar demonstração
            </a>
          ) : (
            <a href="#demonstrativo" className="btn-pilula-claro">
              Ver funcionando
            </a>
          )}
        </div>
      </div>

      {/* ── O sistema de verdade, rodando dentro da página ── */}
      <div
        id="demonstrativo"
        className="relative max-w-6xl mx-auto px-4 sm:px-6 mt-12 sm:mt-16 scroll-mt-[84px]"
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="painel"
        >
          <SistemaAoVivo />
        </motion.div>
        <p className="text-center text-[12.5px] text-neutro-400 mt-4">
          É o sistema de verdade, com dados de exemplo. Clique no menu, abra as
          telas, navegue à vontade — nada aqui é salvo.
        </p>
      </div>
    </section>
  )
}

/**
 * O sistema inteiro rodando dentro da vitrine, sem login e sem banco.
 *
 * Monta só quando o quadro chega perto da tela: são as telas do sistema
 * inteiro atrás dele, e carregar isso no primeiro byte atrasaria o título da
 * vitrine, que é o que vende.
 */
function SistemaAoVivo() {
  const [visivel, setVisivel] = useState(false)
  const alvo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const no = alvo.current
    if (!no || visivel) return

    // Sem IntersectionObserver (navegador antigo, teste), monta direto: pior
    // é a pessoa olhar para um quadro que nunca enche.
    if (typeof IntersectionObserver === 'undefined') return setVisivel(true)

    const observador = new IntersectionObserver(
      ([entrada]) => entrada.isIntersecting && setVisivel(true),
      { rootMargin: '400px' }
    )
    observador.observe(no)
    return () => observador.disconnect()
  }, [visivel])

  return (
    <div
      ref={alvo}
      className="rounded-[18px] overflow-hidden bg-white dark:bg-neutro-950 shadow-alta"
    >
      {/* Barra do navegador: é o que faz o quadro ser lido como "um sistema"
          em vez de mais uma seção colorida da página. */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutro-200/70 dark:border-neutro-800 bg-neutro-50 dark:bg-neutro-900">
        <span className="w-2.5 h-2.5 rounded-full bg-neutro-300 dark:bg-neutro-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-neutro-300 dark:bg-neutro-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-neutro-300 dark:bg-neutro-700" />
        <p className="flex-1 text-center text-[11.5px] text-neutro-400 truncate">
          medflow.app · demonstração
        </p>
      </div>

      {visivel ? (
        <SistemaDemo />
      ) : (
        <div className="h-[560px] sm:h-[680px] grid place-items-center">
          <p className="text-[13px] text-neutro-400">Carregando o sistema…</p>
        </div>
      )}
    </div>
  )
}

/* ───────────────────── Esteira de clínicas ───────────────────── */

function EsteiraDeClinicas() {
  if (CLINICAS_PARCEIRAS.length === 0) return null

  return (
    <section className="py-14 sm:py-20">
      <p className="text-[13px] text-neutro-400 text-center mb-8">
        Clínicas que já usam o Medflow
      </p>
      <Esteira rapida>
        {CLINICAS_PARCEIRAS.map((c) => (
          <div key={c.nome} className="flex items-center gap-3 px-10 shrink-0">
            {c.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={c.logoUrl}
                alt={c.nome}
                className="h-8 w-auto object-contain opacity-60 dark:opacity-90"
              />
            ) : (
              <span className="text-[19px] font-semibold tracking-[-0.02em] text-neutro-400">
                {c.nome}
              </span>
            )}
          </div>
        ))}
      </Esteira>
    </section>
  )
}

/* ─────────────── Uma plataforma só (dois painéis) ─────────────── */

function Plataforma() {
  return (
    <section id="recursos" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 scroll-mt-[84px]">
      <Cabecalho
        selo="Feito para clínica de olho"
        titulo={
          <>
            Uma plataforma só
            <br className="hidden sm:block" /> para a clínica inteira
          </>
        }
        texto="Pare de pular entre caderno, planilha e grupo do WhatsApp. O dado entra uma vez e aparece onde precisa."
      />

      <div className="grid lg:grid-cols-2 gap-5 mt-12">
        <Revelar>
          <div className="painel h-full">
            <div className="rounded-[16px] bg-white dark:bg-neutro-950 p-4 shadow-media">
              <TelaAgenda />
            </div>
          </div>
          <h3 className="text-[21px] font-medium tracking-[-0.02em] mt-6">
            A agenda que o paciente preenche
          </h3>
          <p className="text-[14px] text-neutro-500 leading-relaxed mt-2.5 max-w-md">
            Link público com os horários reais, ausência do profissional
            bloqueando os dois lados e lembrete pronto para disparar.
          </p>
        </Revelar>

        <Revelar atraso={0.12}>
          <div className="painel h-full">
            <div className="rounded-[16px] bg-white dark:bg-neutro-950 p-4 shadow-media">
              <TelaReceita />
            </div>
          </div>
          <h3 className="text-[21px] font-medium tracking-[-0.02em] mt-6">
            A receita que sai do exame
          </h3>
          <p className="text-[14px] text-neutro-500 leading-relaxed mt-2.5 max-w-md">
            O que foi medido no prontuário vira receita sem redigitar — que é
            exatamente onde o erro de grau costuma nascer.
          </p>
        </Revelar>
      </div>
    </section>
  )
}

/* ──────────────────── Seção de abas ──────────────────── */

const ABAS = [
  {
    chave: 'agenda',
    rotulo: 'Agenda',
    icone: CalendarCheck2,
    titulo: 'Agenda',
    texto:
      'Dia, semana ou mês, por profissional. O paciente marca sozinho pelo link público, a recepção confirma pelo WhatsApp e a ausência do profissional fecha o horário nos dois lados.',
    Tela: TelaAgenda,
    itens: ['Link público de agendamento', 'Ausências por profissional', 'Confirmação no WhatsApp'],
  },
  {
    chave: 'prontuario',
    rotulo: 'Prontuário',
    icone: Stethoscope,
    titulo: 'Prontuário',
    texto:
      'Anamnese por chips, acuidade com e sem correção, refração e o grau dos óculos que o paciente já usa — lado a lado com o que foi encontrado agora.',
    Tela: TelaProntuario,
    itens: ['Anamnese em chips', 'Grau atual x refração', 'Histórico por paciente'],
  },
  {
    chave: 'receita',
    rotulo: 'Receita',
    icone: Printer,
    titulo: 'Receita e documentos',
    texto:
      'Receita optométrica ou oftalmológica, com AV de longe e de perto, DP e altura. Atestado, declaração e encaminhamento saem do mesmo lugar, com o cabeçalho da clínica.',
    Tela: TelaReceita,
    itens: ['Optométrica ou oftalmológica', 'AV de longe e de perto', 'Atestado e encaminhamento'],
  },
  {
    chave: 'financeiro',
    rotulo: 'Financeiro',
    icone: TrendingUp,
    titulo: 'Financeiro',
    texto:
      'Consulta com valor vira lançamento sozinha, com a forma de pagamento marcada na recepção. Meta do mês, campanhas de venda e acerto com a ótica parceira no mesmo painel.',
    Tela: TelaFinanceiro,
    itens: ['Entradas por forma de pagamento', 'Meta mensal', 'Campanhas e acerto de parceiro'],
  },
]

function Abas() {
  const [ativa, setAtiva] = useState(ABAS[0].chave)
  const aba = ABAS.find((a) => a.chave === ativa) ?? ABAS[0]

  return (
    <section className="border-y border-neutro-200/60 dark:border-neutro-800 bg-neutro-50/60 dark:bg-neutro-900/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <Cabecalho
          selo="Recursos"
          titulo={
            <>
              Do primeiro contato
              <br className="hidden sm:block" /> até o dinheiro no caixa
            </>
          }
          texto="Quatro telas que se conversam. Escolha uma para ver o que ela entrega."
        />

        {/* Barra de abas em cápsula, como no topo de um app */}
        <Revelar atraso={0.1} className="flex justify-center mt-10">
          <div className="inline-flex flex-wrap justify-center gap-1 p-1.5 rounded-full bg-white dark:bg-neutro-900 border border-neutro-200/80 dark:border-neutro-800 shadow-suave">
            {ABAS.map((a) => (
              <button
                key={a.chave}
                onClick={() => setAtiva(a.chave)}
                className={`inline-flex items-center gap-2 text-[13.5px] font-medium px-4 py-2.5 rounded-full transition-all duration-200 ${
                  a.chave === ativa
                    ? 'bg-neutro-900 text-white dark:bg-white dark:text-neutro-900'
                    : 'text-neutro-500 hover:text-neutro-900 dark:hover:text-white'
                }`}
              >
                <a.icone size={15} strokeWidth={2.1} />
                {a.rotulo}
              </button>
            ))}
          </div>
        </Revelar>

        {/* `key` troca o nó inteiro: é o que faz a animação rodar de novo a
            cada aba, em vez de o React reaproveitar o elemento e não animar. */}
        <motion.div
          key={aba.chave}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center mt-12"
        >
          <div>
            <h3 className="text-[26px] sm:text-[32px] font-medium tracking-[-0.03em] leading-[1.1]">
              {aba.titulo}
            </h3>
            <p className="text-[14.5px] text-neutro-500 leading-relaxed mt-4">{aba.texto}</p>
            <ul className="space-y-2.5 mt-6">
              {aba.itens.map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-brand-500/15 text-brand-600 flex items-center justify-center shrink-0">
                    <Check size={12} strokeWidth={2.8} />
                  </span>
                  <span className="text-[14px] text-neutro-600 dark:text-neutro-300">{item}</span>
                </li>
              ))}
            </ul>
            <Link href="/cadastro?plano=PRO" className="btn-pilula-escuro mt-8">
              Começar agora <ArrowRight size={15} strokeWidth={2.2} />
            </Link>
          </div>

          <div className="painel">
            <div className="rounded-[16px] bg-white dark:bg-neutro-950 p-4 shadow-media">
              <aba.Tela />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ──────────────── Print grande, levemente inclinado ──────────────── */

function EmUmaTela() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <Cabecalho
        selo="Visão do dono"
        titulo={
          <>
            O mês inteiro
            <br className="hidden sm:block" /> numa olhada só
          </>
        }
        texto="Quanto entrou, por qual meio, quanto falta para a meta e o que cada profissional produziu."
      />

      <Revelar atraso={0.1} className="mt-12">
        <div className="painel overflow-hidden">
          {/* Inclinação de verdade em 3D: a perspectiva fica no pai e a
              rotação no filho, senão o navegador achata tudo. */}
          <div style={{ perspective: '1600px' }}>
            <motion.div
              initial={{ rotateX: 14, y: 30, opacity: 0 }}
              whileInView={{ rotateX: 6, y: 0, opacity: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-[16px] bg-white dark:bg-neutro-950 p-4 sm:p-6 shadow-alta origin-top"
            >
              <TelaFinanceiro />
            </motion.div>
          </div>
        </div>
      </Revelar>
    </section>
  )
}

/* ─────────────────────── Depoimentos ──────────────────────── */

function Depoimentos() {
  if (DEPOIMENTOS.length === 0) return null

  return (
    <section className="py-16 sm:py-24 border-y border-neutro-200/60 dark:border-neutro-800 bg-neutro-50/60 dark:bg-neutro-900/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Cabecalho
          selo="Quem já usa"
          titulo="Clínicas que largaram a planilha"
          texto="Quem atende todo dia é quem melhor diz se o sistema atrapalha ou ajuda."
        />
      </div>

      <div className="mt-12">
        <Esteira>
          {DEPOIMENTOS.map((d) => (
            <figure
              key={d.nome}
              className="w-[320px] sm:w-[380px] shrink-0 mx-3 cartao p-6 rounded-[20px]"
            >
              <div className="flex items-center gap-3">
                {/* <img> puro, como em sign-in.tsx: o avatar vem do Unsplash, e
                    next/image exigiria remotePatterns no next.config só para
                    quatro fotos decorativas. O CSP já libera img-src https:. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.avatarSrc} alt="" className="w-11 h-11 rounded-full object-cover" />
                <figcaption>
                  <p className="text-[14px] font-semibold">{d.nome}</p>
                  <p className="text-[12px] text-neutro-400">{d.cargo}</p>
                </figcaption>
              </div>
              <blockquote className="text-[14px] text-neutro-600 dark:text-neutro-300 leading-relaxed mt-4">
                “{d.texto}”
              </blockquote>
            </figure>
          ))}
        </Esteira>
      </div>
    </section>
  )
}

/* ────────────────────────── Planos ────────────────────────── */

function Planos({
  plano,
  aoTrocarPlano,
}: {
  plano: PlanoNome
  aoTrocarPlano: (p: PlanoNome) => void
}) {
  return (
    <section id="planos" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 scroll-mt-[84px]">
      <Cabecalho
        selo="Planos"
        titulo={
          <>
            Planos para cada
            <br className="hidden sm:block" /> tamanho de clínica
          </>
        }
        texto="Mensal, sem fidelidade. Troca de plano a qualquer momento, para cima ou para baixo."
      />

      <div className="grid sm:grid-cols-3 gap-5 mt-12">
        {ORDEM_PLANOS.map((p, i) => {
          const destaque = p === plano
          const teto = TETO_USUARIOS[p]

          return (
            <Revelar key={p} atraso={i * 0.08}>
              <div
                className={`h-full flex flex-col rounded-[20px] overflow-hidden transition-all duration-300 ${
                  destaque
                    ? 'painel-escuro shadow-alta'
                    : 'bg-white dark:bg-neutro-900 border border-neutro-200/80 dark:border-neutro-800'
                }`}
              >
                <button
                  onClick={() => aoTrocarPlano(p)}
                  className="text-left p-6 pb-5"
                  aria-label={`Ver o plano ${ROTULO[p]} no demonstrativo`}
                >
                  <p className={`text-[17px] font-medium ${destaque ? 'text-white' : ''}`}>
                    {ROTULO[p]}
                  </p>
                  <p
                    className={`text-[12.5px] mt-1.5 ${
                      destaque ? 'text-white/60' : 'text-neutro-400'
                    }`}
                  >
                    {teto === null
                      ? 'Para rede e clínica com equipe grande'
                      : teto === 1
                      ? 'Para quem atende sozinho'
                      : `Para equipe de até ${teto} pessoas`}
                  </p>

                  <p className="mt-5">
                    <span
                      className={`text-[40px] font-medium tracking-[-0.04em] numerico ${
                        destaque ? 'text-white' : ''
                      }`}
                    >
                      R$ {PRECO_TABELA[p].toLocaleString('pt-BR')}
                    </span>
                    <span
                      className={`text-[13px] ${destaque ? 'text-white/60' : 'text-neutro-400'}`}
                    >
                      {' '}
                      /mês
                    </span>
                  </p>
                </button>

                <div className="px-6">
                  <Link
                    href={`/cadastro?plano=${p}`}
                    className={`w-full ${
                      destaque
                        ? 'btn-pilula bg-white text-neutro-900 hover:bg-neutro-100'
                        : 'btn-pilula-escuro'
                    }`}
                  >
                    Assinar o {ROTULO[p]} <ArrowRight size={15} strokeWidth={2.2} />
                  </Link>
                </div>

                <div
                  className={`mt-6 pt-5 px-6 pb-6 border-t flex-1 ${
                    destaque ? 'border-white/15' : 'border-neutro-200/70 dark:border-neutro-800'
                  }`}
                >
                  <p
                    className={`text-[12.5px] mb-3.5 ${
                      destaque ? 'text-white/60' : 'text-neutro-400'
                    }`}
                  >
                    O que inclui:
                  </p>
                  <ul className="space-y-2.5">
                    {INCLUI[p].map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <Check
                          size={14}
                          strokeWidth={2.6}
                          className={`shrink-0 mt-[3px] ${
                            destaque ? 'text-brand-400' : 'text-brand-600'
                          }`}
                        />
                        <span
                          className={`text-[13.5px] ${
                            destaque ? 'text-white/85' : 'text-neutro-600 dark:text-neutro-300'
                          }`}
                        >
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Revelar>
          )
        })}
      </div>

      <p className="text-[12.5px] text-neutro-400 text-center mt-7 max-w-lg mx-auto leading-relaxed">
        Você escolhe o plano, cria a conta e ativa a assinatura por PIX ou
        cartão. O sistema abre assim que o pagamento é confirmado.
      </p>

      {/* O que cada plano abre e o que tranca, nas próprias telas. Fica junto
          dos preços porque é aqui que a dúvida aparece: "o Básico serve?" */}
      <Revelar atraso={0.1} className="mt-14">
        <div className="painel">
          <p className="text-center text-[13px] text-neutro-500 mb-6">
            Escolha um plano acima e veja o que ele abre:
          </p>
          <Previa plano={plano} aoTrocarPlano={aoTrocarPlano} />
        </div>
      </Revelar>
    </section>
  )
}

/* ──────────────────────── Comparativo ─────────────────────── */

const SEM = [
  'Agenda no caderno e no grupo do WhatsApp',
  'Receita escrita à mão, sem cópia',
  'Prontuário em pasta, só na clínica',
  'Dinheiro conferido na planilha, dias depois',
  'Ninguém sabe quem remarcou',
  'Relatório feito à mão quando dá',
]

const COM = [
  'Agenda única, o paciente marca pelo link',
  'Receita impressa a partir do exame',
  'Prontuário com histórico e acesso registrado',
  'Lançamento na hora, por forma de pagamento',
  'Trilha de quem criou e quem alterou',
  'Relatório por período e por profissional',
]

function Comparativo() {
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <Cabecalho
        selo="Antes e depois"
        titulo="A diferença no dia a dia"
        texto="O lado esquerdo é como a maioria das clínicas trabalha hoje."
      />

      <div className="grid md:grid-cols-2 gap-5 mt-12">
        <Revelar>
          <div className="rounded-[20px] border border-neutro-200/80 dark:border-neutro-800 p-6 sm:p-7 h-full">
            <p className="text-[15px] font-medium text-neutro-400">Sem o Medflow</p>
            <ul className="space-y-3.5 mt-5">
              {SEM.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <X size={15} strokeWidth={2.4} className="text-neutro-400 shrink-0 mt-[3px]" />
                  <span className="text-[14px] text-neutro-500 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Revelar>

        <Revelar atraso={0.12}>
          <div className="painel-escuro p-6 sm:p-7 h-full">
            <p className="text-[15px] font-medium">Com o Medflow</p>
            <ul className="space-y-3.5 mt-5">
              {COM.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check size={15} strokeWidth={2.6} className="text-brand-400 shrink-0 mt-[3px]" />
                  <span className="text-[14px] text-white/85 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Revelar>
      </div>
    </section>
  )
}

/* ─────────────────────── Integrações ──────────────────────── */

const INTEGRACOES = [
  { icone: MessageCircle, nome: 'WhatsApp', texto: 'Confirmação, lembrete e retorno com texto pronto.' },
  { icone: QrCode, nome: 'PIX e cartão', texto: 'Mensalidade pelo Asaas, com baixa automática.' },
  { icone: Printer, nome: 'Impressão', texto: 'Receita e documentos com o cabeçalho da clínica.' },
  { icone: Smartphone, nome: 'Celular', texto: 'Instala na tela inicial como aplicativo.' },
  { icone: Users, nome: 'Equipe', texto: 'Cada pessoa vê só as telas que o dono liga.' },
  { icone: FileText, nome: 'Link público', texto: 'Agendamento pelo Instagram ou pela bio.' },
]

function Integracoes() {
  return (
    <section
      id="integracoes"
      className="border-y border-neutro-200/60 dark:border-neutro-800 bg-neutro-50/60 dark:bg-neutro-900/30 scroll-mt-[84px]"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <Cabecalho
          selo="Integrações"
          titulo="Conversa com o que a clínica já usa"
          texto="Sem instalar nada e sem configurar servidor. O que está aqui funciona no primeiro dia."
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
          {INTEGRACOES.map((i, idx) => (
            <Revelar key={i.nome} atraso={idx * 0.06}>
              <div className="group bg-white dark:bg-neutro-900 border border-neutro-200/80 dark:border-neutro-800 rounded-[18px] p-6 h-full transition-all duration-300 hover:shadow-media hover:-translate-y-1">
                <div className="w-11 h-11 rounded-xl bg-neutro-100 dark:bg-neutro-800 flex items-center justify-center transition-colors duration-300 group-hover:bg-brand-500/15">
                  <i.icone
                    size={19}
                    strokeWidth={2}
                    className="text-neutro-600 dark:text-neutro-300 transition-colors duration-300 group-hover:text-brand-600"
                  />
                </div>
                <p className="text-[16px] font-medium tracking-[-0.02em] mt-4">{i.nome}</p>
                <p className="text-[13.5px] text-neutro-500 leading-relaxed mt-1.5">{i.texto}</p>
              </div>
            </Revelar>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────── Dúvidas ───────────────────────── */

const PERGUNTAS: [string, string][] = [
  [
    'Tem contrato ou fidelidade?',
    'Não. A assinatura é mensal e você cancela quando quiser, pela própria tela de Cobrança.',
  ],
  [
    'Como funciona o pagamento?',
    'Você escolhe o plano, cria a conta e ativa a assinatura por PIX ou cartão. O sistema abre assim que o pagamento é confirmado, e as cobranças seguintes são automáticas, uma por mês.',
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
    'Não, e por um motivo honesto: parte do produto custa por uso. Em vez de trial, o demonstrativo aqui em cima mostra o sistema de verdade antes de você decidir.',
  ],
]

function Duvidas() {
  const [aberta, setAberta] = useState<number | null>(0)

  return (
    <section id="duvidas" className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 scroll-mt-[84px]">
      <Cabecalho
        selo="Dúvidas"
        titulo="O que perguntam antes de assinar"
        texto="Se faltar alguma, fale com a gente — respondemos todas."
      />

      <div className="space-y-3 mt-12">
        {PERGUNTAS.map(([pergunta, resposta], i) => {
          const abertaAgora = aberta === i
          return (
            <Revelar key={pergunta} atraso={i * 0.04}>
              <button
                onClick={() => setAberta(abertaAgora ? null : i)}
                className="w-full text-left bg-white dark:bg-neutro-900 border border-neutro-200/80 dark:border-neutro-800 rounded-[18px] px-5 sm:px-6 py-5 transition-colors duration-200 hover:border-neutro-300 dark:hover:border-neutro-700"
                aria-expanded={abertaAgora}
              >
                <div className="flex items-start gap-4">
                  <span className="text-[13px] text-neutro-400 numerico mt-0.5 shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[15.5px] font-medium flex-1 tracking-[-0.01em]">
                    {pergunta}
                  </span>
                  <span className="text-neutro-400 shrink-0 mt-0.5">
                    {abertaAgora ? (
                      <Minus size={17} strokeWidth={2.2} />
                    ) : (
                      <Plus size={17} strokeWidth={2.2} />
                    )}
                  </span>
                </div>

                {/* Altura animada: `grid-template-rows` de 0fr para 1fr é o
                    jeito de animar altura automática sem medir nada em JS. */}
                <div
                  className={`grid transition-all duration-300 ease-out ${
                    abertaAgora ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="text-[14px] text-neutro-500 leading-relaxed pl-9 pr-6">
                      {resposta}
                    </p>
                  </div>
                </div>
              </button>
            </Revelar>
          )
        })}
      </div>
    </section>
  )
}

/* ─────────────────────────── Blog ─────────────────────────── */

function Blog({ posts }: { posts: ReturnType<typeof postsRecentes> }) {
  return (
    <section
      id="blog"
      className="border-y border-neutro-200/60 dark:border-neutro-800 bg-neutro-50/60 dark:bg-neutro-900/30 scroll-mt-[84px]"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <Cabecalho
          selo="Blog"
          titulo="Gestão de clínica, na prática"
          texto="O que aprendemos atendendo clínicas de optometria e oftalmologia."
        />

        <div className="grid sm:grid-cols-3 gap-5 mt-12">
          {posts.map((post, i) => (
            <Revelar key={post.slug} atraso={i * 0.08}>
              <Link
                href={`/blog/${post.slug}`}
                className="group block bg-white dark:bg-neutro-900 border border-neutro-200/80 dark:border-neutro-800 rounded-[18px] p-6 h-full transition-all duration-300 hover:shadow-media hover:-translate-y-1"
              >
                <p className="text-[11.5px] text-neutro-400">
                  {formatarData(`${post.data}T12:00:00`)}
                </p>
                <h3 className="text-[17px] font-medium tracking-[-0.02em] leading-snug mt-3">
                  {post.titulo}
                </h3>
                <p className="text-[13.5px] text-neutro-500 leading-relaxed mt-2.5">
                  {post.resumo}
                </p>
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium mt-5 group-hover:gap-2.5 transition-all duration-200">
                  Ler <ArrowRight size={14} strokeWidth={2.2} />
                </span>
              </Link>
            </Revelar>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ──────────────────────── Chamada final ───────────────────── */

function ChamadaFinal({ linkDemo }: { linkDemo: string | null }) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
      <Revelar>
        <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto shadow-alta">
          <span
            className="text-brand-950 font-black text-[30px] leading-none"
            style={{ letterSpacing: '-3px', marginRight: '-2px' }}
          >
            +
          </span>
        </div>

        <h2 className="titulo-vitrine mt-8">Comece hoje com a agenda de amanhã</h2>
        <p className="subtitulo-vitrine mt-4">
          Cadastro em dois minutos. O consultório nasce com expediente, link
          público e você como profissional que atende.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Link href="/cadastro?plano=PRO" className="btn-pilula-escuro">
            Criar minha conta <ArrowRight size={15} strokeWidth={2.2} />
          </Link>
          {linkDemo && (
            <a
              href={linkDemo}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pilula-claro"
            >
              <MessageCircle size={15} strokeWidth={2.2} /> Falar com a gente
            </a>
          )}
        </div>
      </Revelar>
    </section>
  )
}

/* ────────────────────────── Rodapé ────────────────────────── */

function Rodape({ linkDemo, temBlog }: { linkDemo: string | null; temBlog: boolean }) {
  return (
    <footer className="border-t border-neutro-200/60 dark:border-neutro-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid sm:grid-cols-4 gap-8">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
                <span
                  className="text-brand-950 font-black text-[18px] leading-none"
                  style={{ letterSpacing: '-2px', marginRight: '-1px' }}
                >
                  +
                </span>
              </div>
              <p className="text-[16px] font-semibold tracking-[-0.02em]">Medflow</p>
            </div>
            <p className="text-[13px] text-neutro-400 leading-relaxed mt-4 max-w-[280px]">
              Gestão para clínicas de oftalmologia e optometria: agenda,
              prontuário, receita e financeiro num só lugar.
            </p>
          </div>

          <div>
            <p className="text-[13px] font-medium">Produto</p>
            <nav className="flex flex-col gap-2.5 mt-4 text-[13px] text-neutro-500">
              <a href="#recursos" className="hover:text-neutro-900 dark:hover:text-white">
                Recursos
              </a>
              <a href="#demonstrativo" className="hover:text-neutro-900 dark:hover:text-white">
                Demonstrativo
              </a>
              <a href="#planos" className="hover:text-neutro-900 dark:hover:text-white">
                Planos
              </a>
              <a href="#integracoes" className="hover:text-neutro-900 dark:hover:text-white">
                Integrações
              </a>
              {temBlog && (
                <a href="#blog" className="hover:text-neutro-900 dark:hover:text-white">
                  Blog
                </a>
              )}
            </nav>
          </div>

          <div>
            <p className="text-[13px] font-medium">Conta e contato</p>
            <nav className="flex flex-col gap-2.5 mt-4 text-[13px] text-neutro-500">
              <Link href="/login" className="hover:text-neutro-900 dark:hover:text-white">
                Entrar
              </Link>
              <Link href="/cadastro" className="hover:text-neutro-900 dark:hover:text-white">
                Criar conta
              </Link>
              {linkDemo && (
                <a
                  href={linkDemo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-neutro-900 dark:hover:text-white"
                >
                  WhatsApp
                </a>
              )}
              <Link href="/termos" className="hover:text-neutro-900 dark:hover:text-white">
                Termos de uso
              </Link>
              <Link
                href="/politica-de-privacidade"
                className="hover:text-neutro-900 dark:hover:text-white"
              >
                Privacidade
              </Link>
            </nav>
          </div>
        </div>

        <p className="text-[12px] text-neutro-400 mt-10 pt-6 border-t border-neutro-200/60 dark:border-neutro-800">
          © {new Date().getFullYear()} Medflow · Gestão clínica
        </p>
      </div>
    </footer>
  )
}
