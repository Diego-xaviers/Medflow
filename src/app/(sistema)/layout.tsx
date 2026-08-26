import Moldura from '@/components/Moldura'

/**
 * Layout de tudo que exige login. O middleware já barra quem não tem sessão,
 * então aqui só montamos a moldura — que é cliente porque a gaveta do menu
 * no celular precisa de estado.
 */
export default function LayoutSistema({ children }: { children: React.ReactNode }) {
  return <Moldura>{children}</Moldura>
}
