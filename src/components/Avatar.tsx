/**
 * Foto do usuário, com as iniciais como reserva.
 *
 * A imagem é um data URI vindo do banco, então entra como <img> comum em vez
 * de next/image: não há URL remota para o otimizador processar.
 */
export default function Avatar({
  nome, fotoUrl, tamanho = 32, className = '',
}: {
  nome?: string | null
  fotoUrl?: string | null
  tamanho?: number
  className?: string
}) {
  const iniciais = (nome ?? '?')
    .split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

  const estilo = { width: tamanho, height: tamanho }

  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={nome ?? 'Foto de perfil'}
        style={estilo}
        className={`rounded-full object-cover shrink-0 ring-1 ring-neutro-200 dark:ring-neutro-700 ${className}`}
      />
    )
  }

  return (
    <div
      style={{ ...estilo, fontSize: Math.max(10, Math.round(tamanho * 0.34)) }}
      className={`rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white font-semibold flex items-center justify-center shadow-suave shrink-0 ${className}`}
    >
      {iniciais}
    </div>
  )
}
