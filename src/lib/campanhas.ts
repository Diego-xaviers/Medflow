/**
 * Regras de campanha que valem igual no navegador e no servidor — por isso
 * este arquivo não importa o Prisma.
 *
 * Campanha aqui é de VENDA: período, oferta (preço fechado ou desconto) e
 * meta de vendas. Uma venda é uma consulta CONCLUÍDA ligada à campanha.
 */

export interface OfertaCampanha {
  precoPromocional?: number | string | null
  descontoPercentual?: number | null
}

export interface PeriodoCampanha {
  inicio: string | Date
  fim: string | Date
}

/** "AAAA-MM-DD" do instante, sem deixar o fuso puxar para o dia anterior. */
const diaISO = (d: string | Date) => new Date(d).toISOString().slice(0, 10)

/** Ativa = hoje está entre o primeiro e o último dia, inclusive. */
export function campanhaAtiva(c: PeriodoCampanha, hoje: string): boolean {
  return diaISO(c.inicio) <= hoje && hoje <= diaISO(c.fim)
}

export function situacaoCampanha(c: PeriodoCampanha, hoje: string): 'ATIVA' | 'AGENDADA' | 'ENCERRADA' {
  if (hoje < diaISO(c.inicio)) return 'AGENDADA'
  if (hoje > diaISO(c.fim)) return 'ENCERRADA'
  return 'ATIVA'
}

/**
 * Valor da consulta com a oferta aplicada. Preço fechado manda sobre o
 * desconto; sem oferta, o valor de tabela passa direto. Nulo quando não há
 * de onde tirar um número.
 */
export function valorComOferta(c: OfertaCampanha, valorTabela: number | null): number | null {
  const preco = c.precoPromocional == null || c.precoPromocional === '' ? null : Number(c.precoPromocional)
  if (preco != null && !Number.isNaN(preco)) return preco
  if (valorTabela == null) return null
  if (c.descontoPercentual) {
    return Math.round(valorTabela * (100 - c.descontoPercentual)) / 100
  }
  return valorTabela
}

/** "R$ 150,00" ou "20% off" — o resumo da oferta para listas e selects. */
export function rotuloOferta(c: OfertaCampanha, moeda: (n: number) => string): string | null {
  if (c.precoPromocional != null && c.precoPromocional !== '') return moeda(Number(c.precoPromocional))
  if (c.descontoPercentual) return `${c.descontoPercentual}% off`
  return null
}
