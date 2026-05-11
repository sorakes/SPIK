import { useEffect, useState } from 'react'
import { Trash2, Play, RefreshCw } from 'lucide-react'

const API_BASE = ''

export default function VoiceBankView({ voices, fetchVoices }) {
  const [playingId, setPlayingId] = useState(null)

  const handleDelete = async (id, name) => {
    if (!confirm(`Deletar a voz "${name}" do banco?`)) return
    await fetch(`${API_BASE}/api/voices/${id}`, { method: 'DELETE' })
    fetchVoices()
  }

  const LANG_LABELS = { pt: '🇧🇷 PT', en: '🇺🇸 EN', es: '🇪🇸 ES', multi: '🌍 Multi' }

  return (
    <div className="glass-panel">
      <div className="panel-header" style={{ justifyContent: 'space-between' }}>
        <h2 className="panel-title">🏦 Banco de Vozes</h2>
        <button className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} onClick={fetchVoices}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {voices.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎙</p>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Nenhuma voz salva ainda</p>
          <p style={{ fontSize: '0.9rem' }}>Vá para "Clone Voice", processe um áudio e salve no banco.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {voices.map(voice => (
          <div key={voice.id} style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid var(--panel-border)',
            borderRadius: 16,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--panel-border)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '1.05rem' }}>{voice.name}</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(139,92,246,0.15)', color: 'var(--accent-primary)', padding: '0.15rem 0.5rem', borderRadius: 20 }}>
                    {LANG_LABELS[voice.language] || voice.language}
                  </span>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', padding: '0.15rem 0.5rem', borderRadius: 20 }}>
                    {voice.emotion}
                  </span>
                  <span className="status-badge status-completed" style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem' }}>
                    {voice.status}
                  </span>
                </div>
              </div>
              <button onClick={() => handleDelete(voice.id, voice.name)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', opacity: 0.7, padding: '0.25rem' }}
                title="Deletar">
                <Trash2 size={16} />
              </button>
            </div>

            {voice.prompt && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: '2px solid var(--accent-primary)', paddingLeft: '0.5rem' }}>
                {voice.prompt.slice(0, 80)}{voice.prompt.length > 80 ? '...' : ''}
              </p>
            )}

            <div style={{ marginTop: 'auto' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontFamily: 'monospace' }}>
                ID: {voice.id}
              </p>
              {voice.created_at && (
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Criado: {new Date(voice.created_at).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
