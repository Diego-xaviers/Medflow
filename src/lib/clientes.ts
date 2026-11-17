/**
 * As clínicas que aparecem na faixa "quem já confia" da vitrine.
 *
 * Lista vazia esconde a seção inteira. É a regra que importa aqui: faixa de
 * logos é prova social, e prova social inventada é propaganda enganosa — além
 * de uso de marca de terceiro sem autorização. Só entra cliente real que
 * autorizou aparecer.
 *
 * `logoUrl` é opcional: sem imagem, a faixa mostra o nome em texto, que já
 * cumpre o papel e evita logo esticado ou de má qualidade.
 */

export interface ClinicaParceira {
  nome: string
  /** Cidade e UF, como a clínica quer ser citada. Ex.: 'Manaus · AM'. */
  cidade?: string
  /** URL https de um PNG/SVG com fundo transparente. */
  logoUrl?: string
}

export const CLINICAS_PARCEIRAS: ClinicaParceira[] = []
