import type { Metadata } from 'next'
import Apresentacao from '@/components/previa/Apresentacao'

/**
 * A raiz do domínio é a página de apresentação, não o sistema.
 *
 * O sistema mora embaixo de `/app` (veja `src/lib/rotas.ts`) justamente para
 * esta página existir aqui: o endereço que o cliente digita e o que entra no
 * anúncio é o domínio puro, e cair numa tela de login é o pior primeiro
 * contato possível — a pessoa ainda não tem conta.
 *
 * Pública de propósito: fica fora do matcher do middleware.
 */
export const metadata: Metadata = {
  title: 'Medflow — o sistema da sua clínica, do agendamento à receita',
  description:
    'Agenda, prontuário, receita, financeiro e relatórios num só lugar. Veja o sistema funcionando antes de assinar e escolha o plano que serve para a sua clínica.',
  openGraph: {
    title: 'Medflow — gestão clínica sem planilha',
    description:
      'Agenda, prontuário, receita, financeiro e relatórios num só lugar. Veja o sistema funcionando antes de assinar.',
    type: 'website',
  },
}

export default function PaginaApresentacao() {
  return <Apresentacao />
}
