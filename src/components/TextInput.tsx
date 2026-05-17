import { useState, useRef, type KeyboardEvent } from 'react'

interface TextInputProps {
  onSubmit: (text: string) => void
  disabled?: boolean
}

export function TextInput({ onSubmit, disabled }: TextInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim()) { onSubmit(value.trim()); setValue('') }
    }
  }

  const handleSubmit = () => {
    if (value.trim()) { onSubmit(value.trim()); setValue('') }
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="prompt-input" className="sr-only">Enter your prompt</label>
      <textarea
        ref={textareaRef}
        id="prompt-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Enter your prompt… (Enter to submit, Shift+Enter for new line)"
        rows={5}
        className="w-full resize-y rounded-xl p-4 text-sm transition-all focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          color: 'var(--text-h)',
          caretColor: 'var(--accent)',
        }}
        onFocus={e => e.currentTarget.style.borderColor = 'var(--border-focus)'}
        onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
        aria-describedby="char-count"
      />
      <div className="flex items-center justify-between">
        <span id="char-count" className="text-xs" style={{ color: 'var(--text)' }}>
          {value.length} chars
        </span>
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
        >
          Run →
        </button>
      </div>
    </div>
  )
}
