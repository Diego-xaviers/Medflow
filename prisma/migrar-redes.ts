/**
 * Uma vez só: converte os vínculos do modelo antigo (AcessoConsultorio —
 * dono com outras unidades) em Redes. Para cada dono vinculado, cria a rede
 * "Rede de <nome>" com a clínica dele e as vinculadas, e o torna gestor.
 * Idempotente: dono que já tem rede é pulado.
 *
 *   npx tsx prisma/migrar-redes.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const acessos = await prisma.acessoConsultorio.findMany({
    include: { usuario: { select: { id: true, nome: true, redeId: true, consultorioId: true } } },
  })
  const porDono = new Map<string, typeof acessos>()
  for (const a of acessos) porDono.set(a.usuarioId, [...(porDono.get(a.usuarioId) ?? []), a])

  for (const [, lista] of Array.from(porDono)) {
    const dono = lista[0].usuario
    if (dono.redeId) { console.log(`pulado: ${dono.nome} já gere uma rede`); continue }

    const ids = Array.from(new Set([dono.consultorioId, ...lista.map((a) => a.consultorioId)].filter(Boolean))) as string[]
    const ocupados = await prisma.consultorio.findMany({ where: { id: { in: ids }, redeId: { not: null } }, select: { nome: true } })
    if (ocupados.length) { console.log(`pulado: ${dono.nome} — unidades já em outra rede: ${ocupados.map((o) => o.nome).join(', ')}`); continue }

    await prisma.$transaction(async (tx) => {
      const rede = await tx.rede.create({ data: { nome: `Rede de ${dono.nome}` } })
      await tx.consultorio.updateMany({ where: { id: { in: ids } }, data: { redeId: rede.id } })
      await tx.usuario.update({ where: { id: dono.id }, data: { redeId: rede.id } })
      console.log(`criada: ${rede.nome} com ${ids.length} unidades`)
    })
  }
}

main().finally(() => prisma.$disconnect())
