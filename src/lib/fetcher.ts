/**
 * Usado pelo SWR — já converte o corpo de erro da API numa Error legível.
 *
 * O retorno é `any` de propósito: quando a função é genérica, o SWR não tem
 * de onde inferir o tipo (a chave é uma string de URL) e resolve tudo para
 * `{}`, o que faz `data.map(...)` não compilar em toda página. Quem precisa
 * de tipo forte anota no destino: `useSWR<Paciente[]>(...)`.
 */
export async function fetcher(url: string): Promise<any> {
  const resposta = await fetch(url)
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}))
    throw new Error(corpo.erro ?? 'Erro ao carregar dados')
  }
  return resposta.json()
}

/** Wrapper para POST/PUT/PATCH/DELETE com o mesmo tratamento de erro. */
export async function enviar(
  url: string,
  metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  corpo?: unknown
): Promise<any> {
  const resposta = await fetch(url, {
    method: metodo,
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const dados = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(dados.erro ?? 'Erro ao salvar')
  return dados
}
