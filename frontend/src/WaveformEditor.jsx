import { useEffect, useRef, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'

const REGION_SEC = 10

export default function WaveformEditor({ onFileAccepted, onTrimChange, onTrimReady }) {
  const wsContainerRef = useRef(null)
  const barRef = useRef(null)
  const wsRef = useRef(null)
  const blobUrlRef = useRef(null)

  const [file, setFile] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioDuration, setAudioDuration] = useState(0)
  const [regionStart, setRegionStart] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)

  const isDragging = useRef(false)
  const durRef = useRef(0)
  const rsRef = useRef(0)
  const offsetRef = useRef(0)

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
  const fmt = t => {
    const m = Math.floor(t / 60)
    const s = (t % 60).toFixed(1).padStart(4, '0')
    return `${m}:${s}`
  }
  const pct = v => durRef.current ? (v / durRef.current) * 100 : 0

  // ── WaveSurfer init: runs AFTER React mounts the waveform div ────
  useEffect(() => {
    if (!file || !wsContainerRef.current) return

    setError(null)
    setIsReady(false)
    setRegionStart(0); rsRef.current = 0
    setAudioDuration(0)

    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const url = URL.createObjectURL(file)
    blobUrlRef.current = url

    wsRef.current?.destroy()

    const ws = WaveSurfer.create({
      container: wsContainerRef.current,
      waveColor: 'rgba(139,92,246,0.5)',
      progressColor: 'rgba(139,92,246,0.95)',
      cursorColor: '#ec4899',
      barWidth: 2, barGap: 1, barRadius: 2,
      height: 90,
      normalize: true,
      interact: false,
    })
    ws.load(url)
    wsRef.current = ws

    ws.on('ready', () => {
      const dur = ws.getDuration()
      durRef.current = dur
      setAudioDuration(dur)

      // Disable pointer-events on internal WaveSurfer elements so region overlay gets all mouse events
      const inner = wsContainerRef.current
      if (inner) {
        inner.querySelectorAll('*').forEach(el => { el.style.pointerEvents = 'none' })
        inner.style.pointerEvents = 'none'
      }

      if (dur < REGION_SEC) {
        setError(`⚠ Áudio muito curto (${dur.toFixed(1)}s). Envie um áudio com pelo menos ${REGION_SEC} segundos.`)
        ws.destroy(); wsRef.current = null
        onTrimReady?.(false)
        return
      }

      setIsReady(true)
      onTrimChange?.(0, REGION_SEC)
      onTrimReady?.(true)
    })
    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))

    return () => { ws.destroy(); wsRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  // Accept file — only sets state; WaveSurfer loads via useEffect above
  const acceptFile = useCallback((f) => {
    if (!f) return
    const isAudio = f.type?.startsWith('audio/') || /\.(wav|mp3|ogg|flac|m4a|aac|opus|webm)$/i.test(f.name)
    if (!isAudio) {
      setError('Formato não suportado. Envie um arquivo de áudio (wav, mp3, flac, m4a, etc.)')
      return
    }
    setError(null)
    setFile(f)
    onFileAccepted?.(f)
  }, [onFileAccepted])

  // Drag-and-drop
  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) acceptFile(f)
  }
  const handleFileInput = (e) => {
    const f = e.target.files[0]
    if (f) acceptFile(f)
    e.target.value = ''
  }

  // Global drag listeners for region move
  useEffect(() => {
    const getTime = (e) => {
      if (!barRef.current) return 0
      const rect = barRef.current.getBoundingClientRect()
      const cx = e.touches ? e.touches[0].clientX : e.clientX
      const ratio = clamp((cx - rect.left) / rect.width, 0, 1)
      return ratio * durRef.current
    }
    const onMove = (e) => {
      if (!isDragging.current) return
      const t = getTime(e)
      const ns = clamp(t - offsetRef.current, 0, durRef.current - REGION_SEC)
      const rounded = Math.round(ns * 10) / 10
      rsRef.current = rounded
      setRegionStart(rounded)
      onTrimChange?.(rounded, rounded + REGION_SEC)
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [onTrimChange])

  const onRegionMouseDown = (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const ratio = clamp((cx - rect.left) / rect.width, 0, 1)
    const timeAtMouse = ratio * durRef.current
    offsetRef.current = clamp(timeAtMouse - rsRef.current, 0, REGION_SEC)
    isDragging.current = true
  }

  const handlePlayRegion = () => {
    if (!wsRef.current) return
    wsRef.current.setTime(rsRef.current)
    wsRef.current.play()
    const iv = setInterval(() => {
      if (!wsRef.current || wsRef.current.getCurrentTime() >= rsRef.current + REGION_SEC) {
        wsRef.current?.pause(); clearInterval(iv)
      }
    }, 80)
  }

  const leftPct = pct(regionStart)
  const widthPct = pct(REGION_SEC)

  // ── No file yet — show drop zone ──────────────────────────────
  if (!file) {
    return (
      <div
        className={`wf-dropzone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('wf-file-input').click()}
      >
        <input id="wf-file-input" type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileInput} />
        <div className="wf-drop-icon">🎵</div>
        <div className="wf-drop-title">Arraste seu áudio aqui</div>
        <div className="wf-drop-sub">ou clique para selecionar · WAV, MP3, FLAC, M4A...</div>
        {error && <div className="wf-drop-error">{error}</div>}
        <style>{dropStyle}</style>
      </div>
    )
  }

  // ── File loaded — show waveform ────────────────────────────────
  return (
    <div style={{ userSelect: 'none' }}>
      {/* File name bar */}
      <div className="wf-file-bar">
        <span className="wf-file-name">🎵 {file.name}</span>
        <button
          className="wf-change-btn"
          onClick={() => {
            setFile(null); setIsReady(false); setError(null)
            onFileAccepted?.(null); onTrimReady?.(false)
            wsRef.current?.destroy(); wsRef.current = null
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
          }}
        >
          ✕ Trocar
        </button>
      </div>

      {/* Waveform + region selector */}
      <div ref={barRef} style={{ position: 'relative', borderRadius: 8, background: 'rgba(0,0,0,0.3)', cursor: 'default' }}>
        <div ref={wsContainerRef} style={{ width: '100%', borderRadius: 8, overflow: 'hidden' }} />

        {!isReady && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 90 }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>⏳ Carregando forma de onda...</span>
          </div>
        )}

        {isReady && (
          <>
            {/* Left dark mask */}
            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: `${leftPct}%`, background: 'rgba(0,0,0,0.55)',
              pointerEvents: 'none', borderRadius: '6px 0 0 6px',
            }} />
            {/* Right dark mask */}
            <div style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: `${Math.max(0, 100 - leftPct - widthPct)}%`, background: 'rgba(0,0,0,0.55)',
              pointerEvents: 'none', borderRadius: '0 6px 6px 0',
            }} />
            {/* Draggable region */}
            <div
              onMouseDown={onRegionMouseDown}
              onTouchStart={onRegionMouseDown}
              style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${leftPct}%`, width: `${widthPct}%`,
                border: '2px solid #8b5cf6', background: 'rgba(139,92,246,0.18)',
                cursor: 'grab', boxSizing: 'border-box', zIndex: 5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <div style={{ width: 10, height: '100%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px 0 0 2px', flexShrink: 0 }}>
                <div style={{ width: 2, height: 20, background: 'rgba(255,255,255,0.8)', borderRadius: 1 }} />
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff', background: 'rgba(139,92,246,0.9)', padding: '2px 6px', borderRadius: 4, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                ✂ {REGION_SEC}s
              </span>
              <div style={{ width: 10, height: '100%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0 2px 2px 0', flexShrink: 0 }}>
                <div style={{ width: 2, height: 20, background: 'rgba(255,255,255,0.8)', borderRadius: 1 }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      {isReady && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => wsRef.current?.playPause()} className="btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
              {isPlaying ? '⏸ Pausar' : '▶ Play completo'}
            </button>
            <button onClick={handlePlayRegion} className="btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem', color: '#a78bfa', borderColor: 'rgba(139,92,246,0.4)' }}>
              ▶ Ouvir seleção
            </button>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a78bfa' }}>
              {fmt(regionStart)} → {fmt(regionStart + REGION_SEC)}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
              Duração total: {fmt(audioDuration)}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,200,0,0.7)', marginTop: 6 }}>
            ↔ Arraste o bloco roxo para posicionar nos melhores 10 segundos de áudio
          </p>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <style>{dropStyle}</style>
    </div>
  )
}

const dropStyle = `
.wf-dropzone {
  border: 2px dashed rgba(139,92,246,0.35);
  border-radius: 14px;
  padding: 36px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(139,92,246,0.04);
}
.wf-dropzone:hover, .wf-dropzone.drag-over {
  border-color: rgba(139,92,246,0.7);
  background: rgba(139,92,246,0.1);
}
.wf-drop-icon { font-size: 2.2rem; margin-bottom: 10px; }
.wf-drop-title { font-size: 1rem; font-weight: 600; color: rgba(255,255,255,0.8); margin-bottom: 6px; }
.wf-drop-sub { font-size: 0.82rem; color: rgba(255,255,255,0.35); }
.wf-drop-error { margin-top: 12px; color: #fca5a5; font-size: 0.85rem; }
.wf-file-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.wf-file-name { font-size: 0.82rem; color: rgba(255,255,255,0.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wf-change-btn {
  flex-shrink: 0; padding: 3px 10px; border-radius: 6px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.5); font-size: 0.75rem; cursor: pointer;
  transition: all 0.2s; font-family: inherit;
}
.wf-change-btn:hover { background: rgba(239,68,68,0.15); color: #fca5a5; border-color: rgba(239,68,68,0.3); }
`
