import type { InputMode } from '../types'

interface ModeToggleProps {
  mode: InputMode
  onChange: (mode: InputMode) => void
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Input mode"
      className="flex rounded-lg p-1 w-fit"
      style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
    >
      {(['text', 'audio'] as InputMode[]).map((m) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          onClick={() => onChange(m)}
          className="px-4 py-1.5 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
          style={
            mode === m
              ? {
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  color: '#fff',
                  boxShadow: '0 0 10px rgba(139,92,246,0.3)',
                }
              : {
                  color: 'var(--text)',
                }
          }
        >
          <span aria-hidden="true">{m === 'text' ? '⌨' : '🎙'}</span>
          {' '}{m === 'text' ? 'Text' : 'Audio'}
        </button>
      ))}
    </div>
  )
}
