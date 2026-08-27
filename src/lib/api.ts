import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { ErroNaoAutorizado, ErroSemPermissao, ErroPagamentoPendente } from './tenant'

/** Erro de regra de negócio — vira 400 com mensagem legível pro usuário. */
export class ErroDeNegocio extends Error {
  status = 400
}

/**
 * Envolve o corpo de uma rota e transforma exceções em respostas HTTP
 * coerentes, para não repetir try/catch em cada arquivo.
 */
export async function rota<T>(fn: () => Promise<T>) {
  try {
    const dados = await fn()
    return NextResponse.json(dados)
  } catch (erro: any) {
    if (erro instanceof ZodError) {
      const primeira = erro.errors[0]
      return NextResponse.json({ erro: primeira?.message ?? 'Dados inválidos' }, { status: 400 })
    }
    if (erro instanceof ErroNaoAutorizado) {
      return NextResponse.json({ erro: erro.message }, { status: 401 })
    }
    if (erro instanceof ErroSemPermissao) {
      return NextResponse.json({ erro: erro.message }, { status: 403 })
    }
    // 402 é lido pelo cliente como "conta bloqueada" e leva para Cobrança,
    // sem depender de interpretar a mensagem.
    if (erro instanceof ErroPagamentoPendente) {
      return NextResponse.json({ erro: erro.message, bloqueado: true }, { status: 402 })
    }
    if (erro instanceof ErroDeNegocio) {
      return NextResponse.json({ erro: erro.message }, { status: 400 })
    }
    // Não é erro: é como o Next avisa a si mesmo, durante o build, que a rota
    // leu headers/cookies e portanto não pode ser pré-renderizada. Precisa
    // subir — se capturarmos aqui, viram falsos "erro não tratado" no log do
    // build e o Next perde o sinal de que a rota é dinâmica.
    if (erro?.digest === 'DYNAMIC_SERVER_USAGE') throw erro
    // Erro inesperado: loga inteiro no servidor, devolve mensagem genérica
    // pro cliente (nunca vazar stack trace ou detalhe de banco).
    console.error('[medflow] erro não tratado:', erro)
    return NextResponse.json({ erro: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
