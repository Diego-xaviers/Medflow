import { prisma } from './prisma'

const JANELA_MS = 15 * 60 * 1000
const MAX_POR_EMAIL = 10
const MAX_POR_IP = 20

export async function tentativaPermitida(email: string, ip: string): Promise<boolean> {
  const desde = new Date(Date.now() - JANELA_MS)
  const [porEmail, porIP] = await Promise.all([
    prisma.tentativaLogin.count({
      where: { email: email.toLowerCase(), criadoEm: { gte: desde } },
    }),
    prisma.tentativaLogin.count({
      where: { ip, criadoEm: { gte: desde } },
    }),
  ])
  return porEmail < MAX_POR_EMAIL && porIP < MAX_POR_IP
}

export async function registrarTentativa(email: string, ip: string) {
  await prisma.tentativaLogin.create({
    data: { email: email.toLowerCase(), ip },
  })
}
