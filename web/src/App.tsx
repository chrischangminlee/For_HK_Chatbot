import React, { useMemo, useRef, useState } from 'react'
import axios from 'axios'

type ApiResponse = {
  verdict: 'approve' | 'revise'
  finalAnswer: string
  reasons: string[]
  draft: string
  raw: string
  error?: string
}

export default function App() {
  const [context, setContext] = useState('')
  const [question, setQuestion] = useState('')
  const [model, setModel] = useState('gemini-1.5-flash')
  const [temperature, setTemperature] = useState(0.2)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [showDebug, setShowDebug] = useState(false)

  const canAsk = useMemo(() => context.trim().length > 0 && question.trim().length > 0 && !loading, [context, question, loading])
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  async function ask() {
    if (!canAsk) return
    setLoading(true)
    try {
      const res = await axios.post<ApiResponse>('/api/chat', { context, question, model, temperature })
      const data = res.data

      setMessages(prev => [...prev, { role: 'user', content: question }, { role: 'assistant', content: data.finalAnswer }])
      setQuestion('')
      inputRef.current?.focus()
      if (showDebug) console.info('Validator:', data)
    } catch (e: any) {
      alert(e?.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>🤖 Context-Only Chatbot (Validated)</h1>
      <p>Two-step: Respond → Validate against provided context. Key stays server-side.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label><strong>Context / Knowledge Base</strong></label>
          <textarea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="Paste the authoritative info here."
            rows={12}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label><strong>Settings</strong></label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <span>Model</span>
            <select value={model} onChange={e => setModel(e.target.value)}>
              <option>gemini-1.5-flash</option>
              <option>gemini-1.5-flash-8b</option>
              <option>gemini-1.5-pro</option>
            </select>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Temperature: {temperature.toFixed(2)}</label>
            <input type="range" min={0} max={1} step={0.05} value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))} />
          </div>
          <div style={{ marginTop: 8 }}>
            <label><input type="checkbox" checked={showDebug} onChange={e => setShowDebug(e.target.checked)} /> Show validator details in console</label>
          </div>
        </div>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, minHeight: 180 }}>
        {messages.length === 0 ? (
          <div style={{ color: '#777' }}>No messages yet.</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ margin: '8px 0' }}>
              <strong>{m.role === 'user' ? 'You' : 'Assistant'}:</strong> {m.content}
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <label><strong>Your question</strong></label>
        <textarea
          ref={inputRef}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask() }}
          placeholder="Ask based on the context… (Ctrl/Cmd+Enter to send)"
          rows={3}
          style={{ width: '100%' }}
        />
        <button disabled={!canAsk} onClick={ask}>{loading ? 'Asking…' : 'Ask'}</button>
      </div>
    </div>
  )
}
