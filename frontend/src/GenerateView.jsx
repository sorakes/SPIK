import { useState, useRef, useEffect } from 'react'
import { Play, Activity, Briefcase, Book, Radio, Zap, BookOpen } from 'lucide-react'

const API_BASE = ''

const LANGUAGES = [
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
]

export default function GenerateView({ voices }) {
  const [text, setText] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('')
  const [language, setLanguage] = useState('pt')
  const [speed, setSpeed] = useState(1.0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [resultAudioUrl, setResultAudioUrl] = useState(null)
  
  const [history, setHistory] = useState([])
  
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/audit/jobs?limit=50`)
      if (res.ok) {
        const allJobs = await res.json()
        setHistory(allJobs.filter(j => j.type === 'TTS'))
      }
    } catch(e) {}
  }
  
  // Fetch history on mount and poll

  useEffect(() => {
    fetchHistory()
    const iv = setInterval(fetchHistory, 5000)
    return () => clearInterval(iv)
  }, [])

  const textRef = useRef(null)

  const handleGenerate = async () => {
    if (!text) return alert('Insira um texto.')
    if (!selectedVoice) return alert('Selecione uma voz do banco de vozes.')
    setIsGenerating(true)
    setResultAudioUrl(null)

    try {
      const res = await fetch(`${API_BASE}/api/jobs/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice_id: selectedVoice, speed, language })
      })
      const data = await res.json()
      fetchHistory() // Refresh history immediately
      // Poll for result
      const poll = setInterval(async () => {
        const s = await fetch(`${API_BASE}/api/jobs/${data.job_id}`)
        const status = await s.json()
        if (status.status === 'SUCCESS' && status.result?.output_filename) {
          clearInterval(poll)
          setResultAudioUrl(`${API_BASE}/audio/${status.result.output_filename}`)
          setIsGenerating(false)
        }
      }, 1500)
    } catch (err) {
      alert('Erro na geração.')
      setIsGenerating(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Left Column: TTS History */}
      <div className="glass-panel" style={{ width: '320px', flexShrink: 0, padding: '1.2rem', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'rgba(255,255,255,0.9)' }}>🕒 Histórico TTS</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {history.length === 0 && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>Nenhum áudio gerado ainda.</div>}
          
          {history.map(job => (
            <div key={job.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{job.voice_name || 'Voz Desconhecida'}</span>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
                   {job.status === 'SUCCESS' ? '✅' : job.status === 'FAILURE' ? '❌' : '⏳'}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {job.input_text}
              </p>
              {job.status === 'SUCCESS' && job.output_filename && (
                <audio controls src={`${API_BASE}/audio/${job.output_filename}`} style={{ width: '100%', height: '30px' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Studio */}
      <div className="glass-panel" style={{ flex: 1 }}>
        <div className="panel-header">
          <h2 className="panel-title">🎧 Estúdio de Geração TTS</h2>
        </div>

      {/* Settings Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Voz do Banco</label>
          <select className="form-select" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
            <option value="">Selecione um Clone...</option>
            {voices.map(v => (
              <option key={v.id} value={v.id}>{v.name} [{v.language}]</option>
            ))}
          </select>
          {voices.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '0.4rem' }}>
              Nenhuma voz no banco. Crie um clone e salve na aba "Clone Voice".
            </p>
          )}
        </div>
        
        <div className="form-group">
          <label className="form-label">Idioma</label>
          <select className="form-select" value={language} onChange={e => setLanguage(e.target.value)}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Velocidade: {speed}x</label>
          <input type="range" style={{ width: '100%', marginTop: '0.9rem' }}
            min="0.5" max="2" step="0.1" value={speed} onChange={e => setSpeed(Number(e.target.value))} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>0.5x</span><span>1.0x</span><span>2.0x</span>
          </div>
        </div>
      </div>

      {/* Text input */}
      <div className="form-group">
        <label className="form-label">
          <span>Texto para Sintetizar</span>
        </label>
        <textarea
          ref={textRef}
          className="form-textarea"
          placeholder={`Olá! Bem-vindo ao SPIK. Vamos começar?`}
          value={text}
          onChange={e => setText(e.target.value)}
        />
      </div>

      <button className="btn-primary" onClick={handleGenerate} disabled={isGenerating || !selectedVoice || !text}>
        {isGenerating ? <><Activity size={18} /> Gerando Áudio...</> : <><Play size={18} /> Gerar TTS</>}
      </button>

      {resultAudioUrl && (
        <div style={{ marginTop: '1.5rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '1rem' }}>
          <label className="form-label" style={{ color: 'var(--success)' }}>✅ Áudio Gerado</label>
          <audio controls src={resultAudioUrl} style={{ width: '100%' }} />
          <a href={resultAudioUrl} download style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
            ⬇ Baixar MP3
          </a>
        </div>
      )}
      </div>
    </div>
  )
}
