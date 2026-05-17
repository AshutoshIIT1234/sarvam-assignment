import { useState } from 'react'
import { Playground } from './components/Playground'
import { DiffView } from './components/DiffView'

type AppMode = 'playground' | 'diff'

function App() {
  const [mode, setMode] = useState<AppMode>('playground')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg font-semibold" style={{ color: 'var(--text-h)' }}>
              Sarvam Developer Portal
            </span>
          </div>

          {/* Tab nav */}
          <nav
            className="flex gap-1 p-1 rounded-xl w-fit"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            role="tablist"
            aria-label="App sections"
          >
            {(['playground', 'diff'] as AppMode[]).map((tab) => (
              <button
                key={tab}
                id={`tab-${tab}`}
                role="tab"
                aria-selected={mode === tab}
                aria-controls={`panel-${tab}`}
                onClick={() => setMode(tab)}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[var(--bg-card)]"
                style={
                  mode === tab
                    ? {
                        background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                        color: '#fff',
                        boxShadow: '0 0 16px rgba(139,92,246,0.4)',
                      }
                    : {
                        color: 'var(--text)',
                      }
                }
              >
                {tab === 'playground' ? 'Inference Playground' : 'Diff View'}
              </button>
            ))}
          </nav>
        </header>

        {mode === 'playground' ? (
          <div id="panel-playground" role="tabpanel" aria-labelledby="tab-playground">
            <Playground />
          </div>
        ) : (
          <div id="panel-diff" role="tabpanel" aria-labelledby="tab-diff">
            <DiffView />
          </div>
        )}
      </div>
    </div>
  )
}

export default App
