import { NextRequest } from 'next/server'
import { exigirTela } from '@/lib/tenant'
import { rota } from '@/lib/api'
import { calcularRelatorio } from '@/lib/relatorios'
import { startOfDay, endOfDay, startOfMonth, subMonths, isValid } from 'date-fns'

/**
 * Relatórios do período escolhido. Sem parâmetro, olha os últimos 6 meses.
 * A conta fica em `calcularRelatorio`, que o Assistente IA também usa.
 */
export async function GET(req: NextRequest) {
  return rota(async () => {
    const { consultorioId } = await exigirTela('/relatorios')

    const hoje = new Date()
    const deParam = req.nextUrl.searchParams.get('de')
    const ateParam = req.nextUrl.searchParams.get('ate')

    const deBruto = deParam ? new Date(`${deParam}T12:00:00`) : startOfMonth(subMonths(hoje, 5))
    const ateBruto = ateParam ? new Date(`${ateParam}T12:00:00`) : hoje

    const de = startOfDay(isValid(deBruto) ? deBruto : startOfMonth(subMonths(hoje, 5)))
    const ate = endOfDay(isValid(ateBruto) && ateBruto >= de ? ateBruto : hoje)

    return calcularRelatorio(consultorioId, de, ate)
  })
}
