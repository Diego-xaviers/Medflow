'use client'
import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'

interface TagsInputProps {
  rotulo: string
  sugestoes: string[]
  valor: string
  aoMudar: (v: string) => void
  placeholder?: string
}

export default function TagsInput({ rotulo, sugestoes, valor, aoMudar, placeholder }: TagsInputProps) {
  const [digitando, setDigitando] = useState('')
  const [aberto, setAberto] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const tags = valor ? valor.split(',').map(t => t.trim()).filter(Boolean) : []

  const filtradas = sugestoes.filter(s =>
    !tags.includes(s) &&
    (digitando === '' || s.toLowerCase().includes(digitando.toLowerCase()))
  )

  function adicionar(tag: string) {
    const nova = tag.trim()
    if (!nova || tags.includes(nova)) return
    aoMudar([...tags, nova].join(', '))
    setDigitando('')
  }

  function remover(tag: string) {
    aoMudar(tags.filter(t => t !== tag).join(', '))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && digitando.trim()) {
      e.preventDefault()
      adicionar(digitando)
    } else if (e.key === 'Backspace' && !digitando && tags.length) {
      remover(tags[tags.length - 1])
    } else if (e.key === 'Escape') {
      setAberto(false)
    }
  }

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const mostrarDropdown = aberto && (
    filtradas.length > 0 ||
    (digitando.trim() !== '' && !sugestoes.includes(digitando.trim()) && !tags.includes(digitando.trim()))
  )

  return (
    <div ref={containerRef} className="relative">
      <label className="rotulo">{rotulo}</label>
      <div
        className="campo !h-auto min-h-[38px] !py-1.5 flex flex-wrap gap-1.5 cursor-text"
        onClick={() => { setAberto(true); inputRef.current?.focus() }}
      >
        {tags.map(tag => (
          <span key={tag}
            className="inline-flex items-center gap-1 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-[12px] font-medium px-2 py-0.5 rounded-md">
            {tag}
            <button type="button"
              onMouseDown={e => { e.stopPropagation(); remover(tag) }}
              className="hover:text-brand-900 dark:hover:text-brand-100 transition-colors leading-none">
              <X size={11} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={digitando}
          onChange={e => { setDigitando(e.target.value); setAberto(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => setAberto(true)}
          placeholder={tags.length === 0 ? (placeholder ?? 'Digite para buscar...') : ''}
          className="flex-1 min-w-[100px] bg-transparent outline-none text-[13px] py-0.5"
        />
      </div>

      {mostrarDropdown && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-neutro-800 border border-neutro-200 dark:border-neutro-700 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-48 overflow-y-auto py-1">
            {filtradas.map(s => (
              <button key={s} type="button"
                onMouseDown={e => { e.preventDefault(); adicionar(s); setAberto(false) }}
                className="w-full text-left px-3 py-2 text-[13px] hover:bg-neutro-50 dark:hover:bg-neutro-700 transition-colors">
                {s}
              </button>
            ))}
            {digitando.trim() !== '' && !sugestoes.includes(digitando.trim()) && !tags.includes(digitando.trim()) && (
              <button type="button"
                onMouseDown={e => { e.preventDefault(); adicionar(digitando); setAberto(false) }}
                className="w-full text-left px-3 py-2 text-[13px] text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors border-t border-neutro-100 dark:border-neutro-700">
                + Adicionar &quot;{digitando.trim()}&quot;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
