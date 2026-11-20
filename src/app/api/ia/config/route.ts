import { NextResponse } from 'next/server'

/** O modo automático acabou: cada lote é autorizado por `PATCH /api/ia/lotes/[id]`. */
export async function PATCH() {
  return NextResponse.json({ erro: 'Esta opção mudou: autorize cada lote.' }, { status: 410 })
}
