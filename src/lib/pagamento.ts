/** Formas de pagamento, na ordem em que aparecem nas telas. Vale para navegador e servidor. */
export const FORMAS_PAGAMENTO = [
  ['PIX', 'Pix'],
  ['DINHEIRO', 'Dinheiro'],
  ['CARTAO_DEBITO', 'Cartão de débito'],
  ['CARTAO_CREDITO', 'Cartão de crédito'],
  ['CHEQUE', 'Cheque'],
  ['BOLETO', 'Boleto'],
  ['CONVENIO', 'Convênio'],
  ['OUTRO', 'Outro'],
] as const

export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number][0]

export const CODIGOS_FORMA = FORMAS_PAGAMENTO.map(([v]) => v) as [FormaPagamento, ...FormaPagamento[]]

export const rotuloForma = (forma?: string | null) =>
  FORMAS_PAGAMENTO.find(([v]) => v === forma)?.[1] ?? 'Não informada'
