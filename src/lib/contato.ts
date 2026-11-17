/**
 * Os canais de contato que a vitrine oferece.
 *
 * Fica num arquivo só porque o número aparece em quatro lugares da
 * apresentação (topo, faixa final, rodapé e o recado de cadastro indisponível)
 * e porque trocar de número é a mudança mais provável desta página inteira.
 *
 * Vazio = o botão não existe. É de propósito: um "Agendar demonstração" que
 * abre uma conversa com número errado é pior que não ter botão nenhum.
 */

/** Só dígitos, com DDI e DDD. Ex.: '5592999999999'. */
export const WHATSAPP_CONTATO = ''

export const temWhatsApp = () => WHATSAPP_CONTATO.replace(/\D/g, '').length >= 12

/** Link do WhatsApp com a mensagem já escrita. `null` quando não há número. */
export function linkContatoWhatsApp(mensagem: string): string | null {
  if (!temWhatsApp()) return null
  return `https://wa.me/${WHATSAPP_CONTATO.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`
}
