/**
 * Gera o "copia e cola" do PIX — o BR Code do padrão EMV do Banco Central.
 *
 * Vale dizer o que este arquivo NÃO faz, porque é a parte importante: ele não
 * cobra, não conversa com banco, não integra adquirente e não vê dinheiro
 * passar. O que ele produz é um texto que descreve uma chave PIX, um valor e
 * um beneficiário — a mesma coisa que está impressa num QR de padaria. A
 * transferência acontece inteira dentro do aplicativo do banco de quem paga,
 * e a confirmação de que o dinheiro entrou é manual, feita pelo administrador.
 *
 * Consequência prática: não existe cartão, token de pagamento nem credencial
 * financeira neste sistema. Não há o que vazar porque não há o que guardar.
 */

/** Remove acento e caractere fora do ASCII — o BR Code não os aceita. */
function limpar(texto: string, tamanhoMax: number): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, tamanhoMax)
}

/** Campo no formato ID + tamanho (2 dígitos) + valor. */
function campo(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, '0')}${valor}`
}

/**
 * CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF) — é o que fecha o BR Code.
 * Sem ele, ou com ele errado, o aplicativo do banco recusa o código.
 */
function crc16(dados: string): string {
  let crc = 0xffff
  for (let i = 0; i < dados.length; i++) {
    crc ^= dados.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export interface DadosPix {
  chave: string
  beneficiario: string
  cidade: string
  valor?: number
  /** Identificador da cobrança. Vira "***" quando não informado. */
  identificador?: string
}

/** O texto do "copia e cola", pronto para virar QR ou ser colado no banco. */
export function gerarBrCode({
  chave, beneficiario, cidade, valor, identificador,
}: DadosPix): string {
  const conta =
    campo('00', 'br.gov.bcb.pix') +
    campo('01', limpar(chave, 77))

  const adicional = campo('05', limpar(identificador || '***', 25))

  const partes = [
    campo('00', '01'),                              // versão do payload
    campo('26', conta),                             // conta PIX
    campo('52', '0000'),                            // categoria do comerciante
    campo('53', '986'),                             // moeda: real
    ...(valor && valor > 0 ? [campo('54', valor.toFixed(2))] : []),
    campo('58', 'BR'),                              // país
    campo('59', limpar(beneficiario, 25)),
    campo('60', limpar(cidade, 15)),
    campo('62', adicional),
  ].join('')

  // O CRC entra no fim, calculado sobre tudo que veio antes MAIS o próprio
  // cabeçalho "6304" — é assim que a especificação define.
  const semCrc = `${partes}6304`
  return `${semCrc}${crc16(semCrc)}`
}

/** Está tudo preenchido para gerar um código válido? */
export function pixConfigurado(p: {
  pixChave?: string | null
  pixBeneficiario?: string | null
  pixCidade?: string | null
}): boolean {
  return Boolean(p.pixChave?.trim() && p.pixBeneficiario?.trim() && p.pixCidade?.trim())
}
