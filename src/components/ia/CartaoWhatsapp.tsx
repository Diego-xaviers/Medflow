'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { Loader2, MessageCircle } from 'lucide-react'
import { fetcher, enviar } from '@/lib/fetcher'
import type { Painel } from '@/lib/lotesServidor'
import ModalAutorizar from './ModalAutorizar'

type Zap = Extract<Painel, { liberado: true }>['whatsapp']
type Resposta = Zap & { qrCode: string | null; erroConexao?: boolean }

const TEXTO_POS_VENDA = 'Você autoriza a IA a enviar uma mensagem de acompanhamento 7 dias após cada consulta com receita?'

/**
 * O WhatsApp da clínica no topo do painel. Desconectado, busca o QR a cada
 * 20 s; ao detectar a conexão, avisa a tela para recarregar o painel.
 */
export default function CartaoWhatsapp({
  whatsapp,
  aoMudar,
  aoConectar,
}: {
  whatsapp: Zap
  aoMudar: (p: Painel) => void
  aoConectar: () => void
}) {
  const desconectado = whatsapp.status === 'DESCONECTADO'
  const { data, error: erroQr } = useSWR<Resposta>(desconectado ? '/api/ia/whatsapp' : null, fetcher, {
    refreshInterval: 20000,
    revalidateOnFocus: false,
  })
  const [autorizando, setAutorizando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const avisou = useRef(false)

  // A rota já viu a leitura do QR; o painel ainda diz "desconectado". Avisa uma vez por transição.
  useEffect(() => {
    if (!desconectado) avisou.current = false
    else if (data?.status === 'CONECTADO' && !avisou.current) {
      avisou.current = true
      aoConectar()
    }
  }, [desconectado, data?.status, aoConectar])

  if (whatsapp.status === 'SEM_INSTANCIA') return null

  async function patch(corpo: object) {
    setOcupado(true)
    setErro(null)
    try {
      aoMudar(await enviar('/api/ia/whatsapp', 'PATCH', corpo))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo agora.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="cartao p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-brand-500 text-brand-950 flex items-center justify-center shrink-0">
          <MessageCircle size={16} strokeWidth={2.2} />
        </div>
        <h2 className="titulo-secao">WhatsApp da clínica</h2>
      </div>

      {whatsapp.status === 'EM_CONFIGURACAO' && (
        <p className="text-[13px] text-neutro-600 dark:text-neutro-400">
          Estamos configurando o seu Assistente IA. Enquanto isso, vá cadastrando seus pacientes — quanto mais completo o cadastro, melhor a IA trabalha.
        </p>
      )}

      {desconectado && (
        <div className="flex flex-wrap gap-5 items-start">
          <div className="w-[180px] h-[180px] rounded-lg border border-neutro-200 dark:border-neutro-700 bg-white flex items-center justify-center text-center p-2 shrink-0">
            {data?.qrCode ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.qrCode} alt="Código QR para conectar o WhatsApp" className="w-full h-full object-contain" />
            ) : data?.erroConexao || erroQr ? (
              <p className="text-[12px] text-amber-700 dark:text-amber-400">Não foi possível falar com o WhatsApp agora. Tente de novo em instantes.</p>
            ) : (
              <p className="text-[12px] text-neutro-500 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Gerando o código…</p>
            )}
          </div>
          <div className="min-w-0 flex-1 basis-60">
            <p className="text-[13px] font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neutro-300" /> Desconectado
            </p>
            <ol className="mt-2 space-y-1 text-[13px] text-neutro-600 dark:text-neutro-400 list-decimal list-inside">
              <li>Abra o WhatsApp no celular da clínica.</li>
              <li>Toque em Aparelhos conectados.</li>
              <li>Toque em Conectar aparelho e aponte para o código.</li>
            </ol>
            <p className="text-[11.5px] text-neutro-400 mt-2">Sem conexão, os contatos continuam saindo pelo seu WhatsApp, um a um.</p>
          </div>
        </div>
      )}

      {whatsapp.status === 'CONECTADO' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500" /> Conectado{whatsapp.numero ? ` · ${whatsapp.numero}` : ''}
            </p>
            {confirmando ? (
              <div className="flex gap-2">
                <button onClick={() => setConfirmando(false)} className="btn-suave text-[12px] px-2.5 py-1.5">Cancelar</button>
                <button onClick={() => { setConfirmando(false); patch({ acao: 'desconectar' }) }} disabled={ocupado}
                  className="btn-primario text-[12px] px-2.5 py-1.5">Confirmar desconexão</button>
              </div>
            ) : (
              <button onClick={() => setConfirmando(true)} disabled={ocupado} className="btn-suave text-[12px] px-2.5 py-1.5">
                Desconectar
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px]">Pós-venda: <span className="text-neutro-500">{whatsapp.posVendaLigada ? 'ligado' : 'desligado'}</span></p>
            {whatsapp.posVendaLigada ? (
              <button onClick={() => patch({ acao: 'posVenda', ligar: false })} disabled={ocupado} className="btn-suave text-[12px] px-2.5 py-1.5">
                Desligar pós-venda
              </button>
            ) : (
              <button onClick={() => setAutorizando(true)} disabled={ocupado} className="btn-suave text-[12px] px-2.5 py-1.5">
                Ligar pós-venda
              </button>
            )}
          </div>
          <p className="text-[12.5px] text-neutro-500 numerico">Enviadas hoje: {whatsapp.enviadasHoje} de {whatsapp.limite}</p>
        </div>
      )}

      {erro && <p className="text-[12px] text-amber-600 dark:text-amber-400 mt-3">{erro}</p>}

      {autorizando && (
        <ModalAutorizar
          texto={TEXTO_POS_VENDA}
          aoFechar={() => setAutorizando(false)}
          aoConfirmar={async () => {
            aoMudar(await enviar('/api/ia/whatsapp', 'PATCH', { acao: 'posVenda', ligar: true }))
            setAutorizando(false)
          }}
        />
      )}
    </section>
  )
}
