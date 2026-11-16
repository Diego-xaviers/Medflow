import type { Metadata } from 'next'
import { Suspense } from 'react'
import Cadastro from '@/components/previa/Cadastro'

/**
 * Pública, como a vitrine: é a tela de quem ainda não tem conta. Fica fora do
 * matcher do middleware junto com `/`, `/login` e `/agendar/*`.
 */
export const metadata: Metadata = {
  title: 'Criar conta — Medflow',
  description: 'Crie a conta da sua clínica e comece a usar o Medflow hoje.',
  // Nada aqui serve para busca, e a URL carrega o plano escolhido.
  robots: { index: false },
}

export default function PaginaCadastro() {
  // `useSearchParams` (o plano vindo do card da vitrine) exige Suspense na
  // fronteira, senão o build falha ao pré-renderizar a rota.
  return (
    <Suspense>
      <Cadastro />
    </Suspense>
  )
}
