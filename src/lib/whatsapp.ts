/**
 * Link de conversa no WhatsApp com a mensagem já escrita.
 *
 * O `wa.me` só aceita **texto** — não dá para anexar PDF por aqui. Anexo
 * exigiria a API oficial do WhatsApp Business, com número verificado e
 * aprovação de modelo de mensagem. Por isso a receita vai formatada como
 * texto, legível no próprio aplicativo, e a via impressa fica no botão de
 * imprimir (que também salva em PDF pelo diálogo do navegador).
 */
export function telefoneE164(telefone: string | null | undefined): string | null {
  if (!telefone) return null

  const digitos = telefone.replace(/\D/g, '')
  if (digitos.length < 10) return null

  // Número brasileiro vem sem o país; com 12 ou 13 dígitos já veio com ele.
  return digitos.length <= 11 ? `55${digitos}` : digitos
}

export function linkWhatsApp(telefone: string | null | undefined, mensagem: string): string | null {
  const completo = telefoneE164(telefone)
  if (!completo) return null

  return `https://wa.me/${completo}?text=${encodeURIComponent(mensagem)}`
}
