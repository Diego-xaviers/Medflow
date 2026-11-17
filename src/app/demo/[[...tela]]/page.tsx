'use client'

import { ForaDoDemo, TELAS_DEMO } from '@/components/demo/plumbing'

/**
 * Qualquer tela do sistema, servida pelo endereço `/demo/<tela>`.
 *
 * As telas vêm de `components/demo/plumbing`, que as importa dos arquivos de
 * rota de `/app` — os mesmos componentes, sem cópia.
 */
export default function TelaDoDemo({ params }: { params: { tela?: string[] } }) {
  const Tela = TELAS_DEMO[(params.tela ?? []).join('/')]
  return Tela ? <Tela /> : <ForaDoDemo />
}
