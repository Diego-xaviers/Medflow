'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight, Lock } from 'lucide-react'
import { SESSAO_DEMO, MENSAGEM_SO_LEITURA, respostaDemo } from '@/lib/demo'

/**
 * As peças comuns aos dois jeitos de mostrar o sistema sem conta:
 *
 *   1. `/demo` — página inteira, navegada por rota;
 *   2. o quadro na vitrine — o mesmo sistema embutido dentro da home.
 *
 * Os dois montam as TELAS DE VERDADE (os arquivos de rota de `/app`); o que
 * muda é só quem manda na navegação. Ficam juntos aqui para não existirem
 * duas listas de telas que um dia divergem.
 */

const carregando = () => (
  <div className="p-6">
    <div className="esqueleto h-8 w-48" />
    <div className="esqueleto h-32 w-full mt-4" />
  </div>
)

/**
 * `ssr: false` porque as telas são de cliente e só fazem sentido depois que
 * o `fetch` foi trocado; no servidor elas disparariam as chamadas reais, que
 * voltariam 401.
 */
export const TELAS_DEMO: Record<string, React.ComponentType> = {
  '': dynamic(() => import('@/app/app/(sistema)/page'), { ssr: false, loading: carregando }),
  agenda: dynamic(() => import('@/app/app/(sistema)/agenda/page'), { ssr: false, loading: carregando }),
  pacientes: dynamic(() => import('@/app/app/(sistema)/pacientes/page'), { ssr: false, loading: carregando }),
  prontuarios: dynamic(() => import('@/app/app/(sistema)/prontuarios/page'), { ssr: false, loading: carregando }),
  receitas: dynamic(() => import('@/app/app/(sistema)/receitas/page'), { ssr: false, loading: carregando }),
  financeiro: dynamic(() => import('@/app/app/(sistema)/financeiro/page'), { ssr: false, loading: carregando }),
  relatorios: dynamic(() => import('@/app/app/(sistema)/relatorios/page'), { ssr: false, loading: carregando }),
  encaminhamentos: dynamic(() => import('@/app/app/(sistema)/encaminhamentos/page'), { ssr: false, loading: carregando }),
  lembretes: dynamic(() => import('@/app/app/(sistema)/lembretes/page'), { ssr: false, loading: carregando }),
  ia: dynamic(() => import('@/app/app/(sistema)/ia/page'), { ssr: false, loading: carregando }),
  equipe: dynamic(() => import('@/app/app/(sistema)/equipe/page'), { ssr: false, loading: carregando }),
  configuracoes: dynamic(() => import('@/app/app/(sistema)/configuracoes/page'), { ssr: false, loading: carregando }),
}

/**
 * Troca o `fetch` da página pelo do demo e devolve se já está valendo.
 *
 * Tem que valer ANTES do primeiro render das telas: montar primeiro e trocar
 * depois deixaria a primeira chamada de cada tela ir para a API de verdade,
 * voltar 401 e pintar erro antes de o demo assumir.
 *
 * `aoTentarEscrever` é chamado quando alguém clica em salvar: a escrita não
 * acontece, e dizer isso é melhor do que fingir que salvou.
 */
export function useApiDemo(aoTentarEscrever: () => void): boolean {
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    const original = window.fetch

    window.fetch = async (entrada: RequestInfo | URL, opcoes?: RequestInit) => {
      const url =
        typeof entrada === 'string'
          ? entrada
          : entrada instanceof URL
          ? entrada.toString()
          : entrada.url
      const metodo = (
        opcoes?.method ?? (entrada instanceof Request ? entrada.method : 'GET')
      ).toUpperCase()

      if (!url.startsWith('/api/')) return original(entrada, opcoes)

      const json = (corpo: unknown, status = 200) =>
        new Response(JSON.stringify(corpo), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })

      // O next-auth pergunta pela sessão assim que monta. Sem esta resposta
      // ele conclui "deslogado" e a moldura manda o visitante para o login.
      if (url.startsWith('/api/auth/session')) return json(SESSAO_DEMO)
      if (url.startsWith('/api/auth/')) return json({})

      if (metodo !== 'GET') {
        aoTentarEscrever()
        return json({ erro: MENSAGEM_SO_LEITURA }, 403)
      }

      // Rota que o demo não conhece devolve lista vazia: é o formato que a
      // maioria das telas espera e o único que não quebra o render.
      return json(respostaDemo(url) ?? [])
    }

    setPronto(true)
    return () => {
      window.fetch = original
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return pronto
}

/** Tela que existe no sistema mas não entrou na demonstração. */
export function ForaDoDemo() {
  return (
    <div className="p-6 sm:p-10 flex justify-center">
      <div className="cartao p-8 max-w-sm w-full text-center mt-8">
        <div className="w-12 h-12 rounded-full bg-neutro-100 dark:bg-neutro-800 text-neutro-400 flex items-center justify-center mx-auto mb-4">
          <Lock size={22} strokeWidth={1.9} />
        </div>
        <p className="text-[16px] font-medium tracking-apertado">Esta tela abre na sua conta</p>
        <p className="text-[13px] text-neutro-500 leading-relaxed mt-2">
          A demonstração traz as telas do dia a dia. O resto — cobrança,
          perfil, suporte e administração — aparece depois que a conta existe.
        </p>
        <Link href="/cadastro?plano=PRO" className="btn-pilula-escuro w-full mt-6">
          Criar minha conta <ArrowRight size={15} strokeWidth={2.2} />
        </Link>
      </div>
    </div>
  )
}

/** O aviso de "nada é salvo", igual nos dois modos. */
export function AvisoSoLeitura({ visivel }: { visivel: boolean }) {
  return (
    <div
      aria-live="polite"
      className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-[60] transition-all duration-300 ${
        visivel ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <p className="text-[12.5px] bg-neutro-900 text-white px-4 py-2.5 rounded-full shadow-alta whitespace-nowrap">
        {MENSAGEM_SO_LEITURA}
      </p>
    </div>
  )
}
