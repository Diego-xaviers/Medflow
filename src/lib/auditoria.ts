import { prisma } from './prisma'

interface EntradaAuditoria {
  acao: string
  entidade: string
  entidadeId?: string | null
  detalhes?: string | null
  ip?: string | null
  usuarioId?: string | null
  consultorioId?: string | null
}

// Fire-and-forget: falha silenciosa para não derrubar a operação principal.
export function registrarAuditoria(dados: EntradaAuditoria): void {
  prisma.logAuditoria.create({ data: dados }).catch((err) => {
    console.error('[auditoria] falha ao registrar:', err)
  })
}
