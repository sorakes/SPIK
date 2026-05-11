import { useState, useEffect, useCallback } from 'react'
import { Activity, List, Settings, Mic, Play, Database } from 'lucide-react'
import './index.css'
import CloneView from './CloneView'
import GenerateView from './GenerateView'
import VoiceBankView from './VoiceBankView'

const API_BASE = ''
const API_BASE_JOBS = ''

const TYPE_META = {
  CLONE:   { label: 'Clone',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  TTS:     { label: 'TTS',     color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  API_TTS: { label: 'API',     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  PREVIEW: { label: 'Preview', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
}

const STATUS_META = {
  QUEUED:   { label: 'Na fila',     color: '#94a3b8', icon: '⏳' },
  PROGRESS: { label: 'Processando', color: '#f59e0b', icon: '⚙️' },
  SUCCESS:  { label: 'Sucesso',     color: '#10b981', icon: '✅' },
  FAILURE:  { label: 'Falhou',      color: '#ef4444', icon: '❌' },
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso.replace(' ', 'T') + 'Z')
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function JobRow({ job }) {
  const [open, setOpen] = useState(false)
  const type = TYPE_META[job.type] || TYPE_META.CLONE
  const status = STATUS_META[job.status] || STATUS_META.QUEUED

  return (
    <div className={`audit-row ${open ? 'expanded' : ''}`}>
      <div className="audit-row-header" onClick={() => setOpen(v => !v)}>
        <div className="audit-row-left">
          <span className="audit-type-badge" style={{ color: type.color, background: type.bg }}>
            {type.label}
          </span>
          <div className="audit-voice">
            <span className="audit-voice-name">{job.voice_name || job.voice_id || '—'}</span>
            {job.input_text && (
              <span className="audit-input-preview">{job.input_text.slice(0, 60)}{job.input_text.length > 60 ? '…' : ''}</span>
            )}
          </div>
        </div>
        <div className="audit-row-right">
          {job.duration_s != null && (
            <span className="audit-duration">{job.duration_s.toFixed(1)}s</span>
          )}
          <span className="audit-status-badge" style={{ color: status.color }}>
            {status.icon} {status.label}
          </span>
          <span className="audit-time">{fmtDate(job.created_at)}</span>
          <span className="audit-chevron">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="audit-row-detail">
          <div className="audit-detail-grid">
            <div><span className="detail-lbl">Job ID</span><code className="detail-val mono">{job.id}</code></div>
            <div><span className="detail-lbl">Tipo</span><span className="detail-val">{job.type}</span></div>
            <div><span className="detail-lbl">Status</span><span className="detail-val">{job.status}</span></div>
            <div><span className="detail-lbl">Voz usada</span><span className="detail-val">{job.voice_name || job.voice_id || '—'}</span></div>
            <div><span className="detail-lbl">Duração</span><span className="detail-val">{job.duration_s != null ? `${job.duration_s.toFixed(2)}s` : '—'}</span></div>
            <div><span className="detail-lbl">Criado em</span><span className="detail-val">{fmtDate(job.created_at)}</span></div>
            <div><span className="detail-lbl">Concluído</span><span className="detail-val">{fmtDate(job.completed_at)}</span></div>
          </div>

          {job.input_text && (
            <div className="detail-section">
              <span className="detail-lbl">Texto de entrada</span>
              <p className="detail-text">{job.input_text}</p>
            </div>
          )}

          {job.error && (
            <div className="detail-error">
              <span className="detail-lbl" style={{ color: '#ef4444' }}>Erro</span>
              <pre className="detail-error-msg">{job.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function JobsView() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_JOBS}/api/audit/jobs?limit=100`)
      if (res.ok) setJobs(await res.json())
    } catch (e) {}
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchJobs()
    const iv = setInterval(fetchJobs, 5000)
    return () => clearInterval(iv)
  }, [fetchJobs])

  const filtered = jobs.filter(j =>
    (filter === 'ALL' || j.type === filter) &&
    (statusFilter === 'ALL' || j.status === statusFilter)
  )

  const counts = { total: jobs.length, success: jobs.filter(j => j.status === 'SUCCESS').length, fail: jobs.filter(j => j.status === 'FAILURE').length, active: jobs.filter(j => ['QUEUED','PROGRESS'].includes(j.status)).length }

  return (
    <div className="audit-view">
      <div className="audit-header">
        <div>
          <h2 className="audit-title">📋 Auditoria de Jobs</h2>
          <p className="audit-sub">Histórico de requisições do sistema (Sem arquivos de áudio)</p>
        </div>
        <button className="audit-refresh-btn" onClick={fetchJobs}>↻ Atualizar</button>
      </div>

      <div className="audit-stats">
        {[
          { label: 'Total', value: counts.total },
          { label: 'Concluídos', value: counts.success },
          { label: 'Falhas', value: counts.fail },
          { label: 'Ativos', value: counts.active }
        ].map(s => (
          <div key={s.label} className="audit-stat">
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="audit-filters">
        <div className="filter-group">
          <span className="filter-lbl">Tipo:</span>
          {['ALL', 'CLONE', 'TTS', 'API_TTS', 'PREVIEW'].map(t => (
            <button key={t} className={`filter-btn ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>{t === 'ALL' ? 'Todos' : (TYPE_META[t]?.label || t)}</button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-lbl">Status:</span>
          {['ALL', 'SUCCESS', 'FAILURE', 'PROGRESS', 'QUEUED'].map(s => (
            <button key={s} className={`filter-btn ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
              {s === 'ALL' ? 'Todos' : STATUS_META[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      <div className="audit-list">
        {loading && <div className="audit-empty">⏳ Carregando...</div>}
        {!loading && filtered.length === 0 && (
          <div className="audit-empty">
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>📭</div>
            <div>{jobs.length === 0 ? 'Nenhum job na fila.' : 'Nenhum job com esses filtros.'}</div>
          </div>
        )}
        {filtered.map(job => <JobRow key={job.id} job={job} />)}
      </div>

      <style>{`
        .audit-view { max-width: 900px; margin: 0 auto; padding-bottom: 40px; }
        .audit-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
        .audit-title { font-size: 1.5rem; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .audit-sub { font-size: 0.82rem; color: rgba(255,255,255,0.35); }
        .audit-refresh-btn { padding: 8px 16px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); font-size: 0.85rem; cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .audit-refresh-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .audit-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
        .audit-stat { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .stat-value { font-size: 1.8rem; font-weight: 700; line-height: 1; }
        .stat-label { font-size: 0.75rem; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.05em; }
        .audit-filters { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px 16px; }
        .filter-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .filter-lbl { font-size: 0.75rem; color: rgba(255,255,255,0.35); width: 44px; flex-shrink: 0; }
        .filter-btn { padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5); font-size: 0.78rem; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .filter-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); }
        .filter-btn.active { background: rgba(139,92,246,0.2); border-color: rgba(139,92,246,0.4); color: #c4b5fd; }
        .audit-list { display: flex; flex-direction: column; gap: 6px; }
        .audit-empty { text-align: center; padding: 40px; color: rgba(255,255,255,0.25); font-size: 0.9rem; }
        .audit-row { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; overflow: hidden; transition: border-color 0.15s; }
        .audit-row:hover { border-color: rgba(255,255,255,0.13); }
        .audit-row.expanded { border-color: rgba(139,92,246,0.3); }
        .audit-row-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; gap: 12px; }
        .audit-row-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .audit-type-badge { padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
        .audit-voice { display: flex; flex-direction: column; min-width: 0; }
        .audit-voice-name { font-size: 0.88rem; font-weight: 600; color: rgba(255,255,255,0.85); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .audit-input-preview { font-size: 0.75rem; color: rgba(255,255,255,0.3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
        .audit-row-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .audit-duration { font-size: 0.78rem; color: rgba(255,255,255,0.35); font-variant-numeric: tabular-nums; }
        .audit-status-badge { font-size: 0.78rem; font-weight: 600; white-space: nowrap; }
        .audit-time { font-size: 0.72rem; color: rgba(255,255,255,0.25); white-space: nowrap; }
        .audit-chevron { font-size: 0.65rem; color: rgba(255,255,255,0.25); }
        .audit-row-detail { border-top: 1px solid rgba(255,255,255,0.07); padding: 16px; background: rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 14px; }
        .audit-detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
        .audit-detail-grid > div { display: flex; flex-direction: column; gap: 3px; }
        .detail-lbl { font-size: 0.7rem; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.06em; }
        .detail-val { font-size: 0.82rem; color: rgba(255,255,255,0.75); }
        .detail-val.mono, code.detail-val { font-family: 'Courier New', monospace; color: #a78bfa; word-break: break-all; }
        .detail-section { display: flex; flex-direction: column; gap: 4px; }
        .detail-text { font-size: 0.85rem; color: rgba(255,255,255,0.6); background: rgba(0,0,0,0.2); padding: 10px 12px; border-radius: 8px; margin: 0; line-height: 1.5; }
        .detail-error { display: flex; flex-direction: column; gap: 6px; }
        .detail-error-msg { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 10px 12px; margin: 0; font-size: 0.78rem; color: #fca5a5; white-space: pre-wrap; word-break: break-word; font-family: 'Courier New', monospace; }
      `}</style>
    </div>
  )
}

function SettingsView() {
  return (
    <div className="glass-panel" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="panel-header">
        <h2 className="panel-title">⚙️ Configurações do Sistema</h2>
      </div>
      <div className="settings-grid">
        <div className="form-group">
          <label className="form-label">Jobs Simultâneos (Celery Concurrency)</label>
          <input type="number" className="form-input" defaultValue={2} min={1} max={10} />
        </div>
        <div className="form-group">
          <label className="form-label">SPIK API Key</label>
          <input type="text" className="form-input" defaultValue="sk-spik-12345" readOnly />
        </div>
        <div className="form-group">
          <label className="form-label">OmniVoice Model Path</label>
          <input type="text" className="form-input" defaultValue="/app/models/omnivoice_v2" />
        </div>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
        <h3 style={{ color: '#c4b5fd', marginTop: 0, marginBottom: '15px', fontSize: '1.1rem' }}>Como configurar no OpenWebUI</h3>
        <ul style={{ color: 'rgba(255,255,255,0.7)', lineHeight: '1.8', fontSize: '0.9rem', paddingLeft: '20px', margin: 0 }}>
          <li>Vá em <strong>Configurações → Áudio</strong> (Settings → Audio).</li>
          <li>Em <strong>Motor de Texto para Fala</strong> selecione <code style={{ color: '#a78bfa' }}>OpenAI</code>.</li>
          <li>No campo <strong>URL Base da API</strong>, cole: <code style={{ color: '#a78bfa' }}>http://host.docker.internal:7512/v1</code></li>
          <li>No campo de <strong>Chave da API</strong> (ao lado da URL), cole: <code style={{ color: '#a78bfa' }}>sk-spik-12345</code></li>
          <li>No campo <strong>Voz TTS</strong>, digite: <code style={{ color: '#a78bfa' }}>alloy</code> (qualquer nome fictício serve).</li>
          <li>No campo <strong>Modelo TTS</strong>, cole o <strong>ID do seu Clone</strong> que está salvo no Banco de Vozes (ex: <code>clone_0817...</code>).</li>
        </ul>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('clone')
  const [jobs, setJobs] = useState([])
  const [voices, setVoices] = useState([])

  const fetchVoices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/voices`)
      setVoices(await res.json())
    } catch (e) {}
  }, [])

  useEffect(() => {
    const interval = setInterval(async () => {
      const active = jobs.filter(j => !['success', 'SUCCESS', 'FAILURE', 'failure'].includes(j.status))
      for (const job of active) {
        try {
          const res = await fetch(`${API_BASE}/api/jobs/${job.id}`)
          const data = await res.json()
          const newStatus = data.status
          if (newStatus !== job.status) {
            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j))
            if (['SUCCESS', 'success'].includes(newStatus)) fetchVoices()
          }
        } catch (e) {}
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [jobs, fetchVoices])

  useEffect(() => { fetchVoices() }, [fetchVoices])

  const TABS = [
    { id: 'clone', label: 'Clone Voice', icon: <Mic size={17} /> },
    { id: 'generate', label: 'Estúdio TTS', icon: <Play size={17} /> },
    { id: 'bank', label: 'Banco de Vozes', icon: <Database size={17} /> },
    { id: 'jobs', label: 'Jobs Queue', icon: <List size={17} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={17} /> },
  ]

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-container">
          <div className="logo-icon"><Activity color="white" size={22} /></div>
          <span className="logo-text">SPIK</span>
        </div>
        <nav className="nav-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-content">
        {activeTab === 'clone' && <CloneView jobs={jobs} setJobs={setJobs} setActiveTab={setActiveTab} />}
        {activeTab === 'generate' && <GenerateView voices={voices} />}
        {activeTab === 'bank' && <VoiceBankView voices={voices} fetchVoices={fetchVoices} />}
        {activeTab === 'jobs' && <JobsView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}
