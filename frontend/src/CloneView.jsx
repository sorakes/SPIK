import { useState, useRef, useCallback } from 'react';
import WaveformEditor from './WaveformEditor';

const API = import.meta.env.VITE_API_URL ?? '';

const EMOTIONS = ['Neutro', 'Alegre', 'Triste', 'Animado', 'Calmo', 'Sério', 'Empolgado'];
const LANGUAGES = [
  { code: 'pt', label: 'Português' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
];

const DEFAULT_TEST_TEXT = 'Olá! Esta é uma amostra da minha voz clonada. Como posso te ajudar hoje?';

export default function CloneView() {
  const [file, setFile] = useState(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(10);
  const [trimReady, setTrimReady] = useState(false);

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('pt');
  const [emotion, setEmotion] = useState('Neutro');
  const [prompt, setPrompt] = useState('');
  const [testText, setTestText] = useState(DEFAULT_TEST_TEXT);
  const [showPromptInfo, setShowPromptInfo] = useState(false);

  // Job state
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [jobStep, setJobStep] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cloneResult, setCloneResult] = useState(null); // full result from Celery
  const [saveState, setSaveState] = useState(null); // null | 'saving' | 'saved' | 'discarded'
  const [error, setError] = useState(null);

  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = useCallback((jid) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/jobs/${jid}`);
        const data = await res.json();
        setJobStatus(data.status);

        if (data.status === 'PROGRESS' && data.result) {
          setJobStep(data.result.step || '');
        }

        if (data.status === 'SUCCESS') {
          stopPolling();
          const result = data.result;
          setCloneResult(result);
          if (result?.preview_filename) {
            setPreviewUrl(`${API}/audio/${result.preview_filename}`);
          }
          if (!result?.preview_ok) {
            setError('OmniVoice não retornou áudio. Verifique se o serviço está rodando.');
          }
        }

        if (data.status === 'FAILURE') {
          stopPolling();
          setError('O job falhou. Veja os logs do worker para detalhes.');
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 1500);
  }, []);

  const handleFileAccepted = (f) => {
    setFile(f);
    setPreviewUrl(null);
    setJobId(null);
    setJobStatus(null);
    setError(null);
    setCloneResult(null);
    setSaveState(null);
  };

  const handleTrimChange = (start, end) => {
    setTrimStart(start);
    setTrimEnd(end);
  };

  const handleSubmit = async () => {
    if (!file) return setError('Selecione um arquivo de áudio.');
    if (!name.trim()) return setError('Dê um nome para a voz.');
    if (!trimReady) return setError('Selecione um trecho de 10 segundos no waveform.');

    setError(null);
    setPreviewUrl(null);
    setCloneResult(null);
    setSaveState(null);
    setJobStatus('queued');
    setJobStep('');

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', name.trim());
      form.append('language', language);
      form.append('prompt', prompt);
      form.append('emotion', emotion);
      form.append('trim_start', trimStart);
      form.append('trim_end', trimEnd);
      form.append('test_text', testText);

      const res = await fetch(`${API}/api/jobs/clone`, { method: 'POST', body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Erro no servidor');
      }
      const data = await res.json();
      setJobId(data.job_id);
      startPolling(data.job_id);
    } catch (e) {
      setJobStatus('FAILURE');
      setError(e.message);
    }
  };

  const handleSaveToBank = async () => {
    if (!cloneResult) return;
    setSaveState('saving');
    try {
      const res = await fetch(`${API}/api/voices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cloneResult.voice_id,
          name: cloneResult.name,
          language: cloneResult.language || language,
          prompt: cloneResult.prompt || prompt,
          emotion: cloneResult.emotion || emotion,
          file_path: cloneResult.file_path,
        }),
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      setSaveState('saved');
    } catch (e) {
      setError('Erro ao salvar no banco: ' + e.message);
      setSaveState(null);
    }
  };

  const handleDiscard = () => {
    setSaveState('discarded');
  };

  const handleReset = () => {
    setFile(null); setJobId(null); setJobStatus(null);
    setPreviewUrl(null); setCloneResult(null); setSaveState(null); setError(null);
    setName(''); setTrimReady(false); setJobStep('');
  };

  const isProcessing = jobStatus && jobStatus !== 'SUCCESS' && jobStatus !== 'FAILURE';
  const isDone = jobStatus === 'SUCCESS';
  const canSubmit = file && name.trim() && trimReady && !isProcessing;

  const stepLabel = () => {
    if (jobStatus === 'queued') return '⏳ Na fila de processamento...';
    if (jobStatus === 'PROGRESS') {
      if (jobStep === 'cutting') return '✂️ Cortando áudio de referência...';
      if (jobStep === 'omnivoice') return '🧠 OmniVoice sintetizando a voz...';
      return '⚙️ Processando...';
    }
    return '';
  };

  return (
    <div className="clone-view">
      <h2 className="clone-title">🎙 Clone de Voz</h2>
      <p className="clone-subtitle">
        Faça upload de um áudio, selecione 10 segundos, configure e clone — tudo aqui.
      </p>

      {/* 1. Áudio */}
      <section className="clone-section">
        <h3 className="section-label">1. Áudio de Referência</h3>
        <WaveformEditor
          onFileAccepted={handleFileAccepted}
          onTrimChange={handleTrimChange}
          onTrimReady={setTrimReady}
        />
      </section>

      {/* 2. Configurações */}
      <section className="clone-section">
        <h3 className="section-label">2. Configurações da Voz</h3>
        <div className="clone-fields">
          <div className="field-group">
            <label>Nome da voz *</label>
            <input
              className="field-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Locutor Radio, Narrador..."
              maxLength={40}
            />
          </div>
          <div className="field-group">
            <label>Idioma do áudio</label>
            <select className="field-select" value={language} onChange={e => setLanguage(e.target.value)}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label>Emoção base</label>
            <select className="field-select" value={emotion} onChange={e => setEmotion(e.target.value)}>
              {EMOTIONS.map(em => <option key={em} value={em}>{em}</option>)}
            </select>
          </div>
        </div>

        {/* System Prompt with info tooltip */}
        <div className="field-group" style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>Prompt de Sistema</label>
            <button
              className="info-btn"
              onClick={() => setShowPromptInfo(v => !v)}
              title="O que é o Prompt de Sistema?"
            >?</button>
          </div>
          {showPromptInfo && (
            <div className="prompt-info-box">
              <strong>O que é o Prompt de Sistema?</strong>
              <p>
                É uma instrução que define <em>como</em> esta voz deve se comportar quando usada via API ou no Generate TTS.
                Ela é enviada junto com o texto para o OmniVoice, guiando o estilo da fala.
              </p>
              <p><strong>Exemplos:</strong></p>
              <ul>
                <li><code>Você é um locutor de rádio. Fale com energia, ritmo acelerado e entusiasmo.</code></li>
                <li><code>Fale de forma calma, pausada e profissional, como um narrador de documentário.</code></li>
                <li><code>Tom infantil e alegre, como uma professora explicando para crianças.</code></li>
              </ul>
              <p>
                No OmniVoice, o prompt é enviado como prefixo do texto de síntese. Deixe em branco para usar a voz sem instrução.
              </p>
            </div>
          )}
          <textarea
            className="field-textarea"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Ex: Você é um locutor profissional de rádio. Fale com energia e clareza..."
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      </section>

      {/* 3. Texto para testar */}
      <section className="clone-section">
        <h3 className="section-label">3. Texto para Testar</h3>
        <textarea
          className="field-textarea"
          value={testText}
          onChange={e => setTestText(e.target.value)}
          rows={4}
          placeholder="Texto que será sintetizado pelo OmniVoice para você ouvir o resultado..."
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
      </section>

      {/* Action Button */}
      <section className="clone-action-section">
        <button
          className={`clone-submit-btn ${isProcessing ? 'loading' : ''}`}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {isProcessing ? (
            <span className="btn-inner">
              <span className="spin-icon">⚙️</span>
              {stepLabel()}
            </span>
          ) : (
            <span className="btn-inner">🚀 Clonar e Gerar Preview com OmniVoice</span>
          )}
        </button>

        {isProcessing && (
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" />
          </div>
        )}

        {error && (
          <div className="clone-error">⚠️ {error}</div>
        )}
      </section>

      {/* Result */}
      {isDone && (
        <section className="clone-result">
          {/* Preview audio */}
          {previewUrl && saveState !== 'discarded' && (
            <div className="preview-player">
              <div className="preview-label">🔊 Preview — <strong>{name}</strong></div>
              <audio controls src={previewUrl} style={{ width: '100%', marginTop: 8 }} />
            </div>
          )}

          {!previewUrl && (
            <div className="result-header warn">
              ⚠️ OmniVoice não retornou áudio de preview. O áudio de referência foi salvo, mas revise os logs.
            </div>
          )}

          {/* Save / Discard */}
          {saveState === null && (
            <div className="result-actions">
              <button className="btn-save" onClick={handleSaveToBank}>
                ✅ Salvar no Banco de Vozes
              </button>
              <button className="btn-discard" onClick={handleDiscard}>
                🗑 Descartar
              </button>
            </div>
          )}

          {saveState === 'saving' && (
            <div className="result-status saving">⏳ Salvando no banco...</div>
          )}

          {saveState === 'saved' && (
            <div className="result-status saved">
              ✅ Voz <strong>{name}</strong> salva no banco de vozes! Disponível para TTS e API.
            </div>
          )}

          {saveState === 'discarded' && (
            <div className="result-status discarded">
              🗑 Descartado. O arquivo de referência foi removido da sessão.
            </div>
          )}

          {/* Reset */}
          {(saveState === 'saved' || saveState === 'discarded') && (
            <button className="clone-reset-btn" onClick={handleReset}>
              ➕ Clonar outra voz
            </button>
          )}
        </section>
      )}

      <style>{`
        .clone-view {
          max-width: 820px;
          margin: 0 auto;
          padding: 0 0 40px 0;
        }
        .clone-title {
          font-size: 1.6rem;
          font-weight: 700;
          color: #fff;
          margin-bottom: 6px;
        }
        .clone-subtitle {
          color: rgba(255,255,255,0.4);
          font-size: 0.88rem;
          margin-bottom: 24px;
        }
        .clone-section {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 20px 22px;
          margin-bottom: 14px;
        }
        .section-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.35);
          margin: 0 0 14px 0;
        }
        .clone-fields {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 14px;
        }
        @media (max-width: 640px) { .clone-fields { grid-template-columns: 1fr; } }
        .field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .field-group label {
          font-size: 0.78rem;
          color: rgba(255,255,255,0.45);
          font-weight: 500;
        }
        .field-input, .field-select, .field-textarea {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.11);
          border-radius: 10px;
          color: #fff;
          padding: 10px 14px;
          font-size: 0.88rem;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
          resize: vertical;
          width: 100%;
          box-sizing: border-box;
        }
        .field-input:focus, .field-select:focus, .field-textarea:focus {
          border-color: rgba(139,92,246,0.55);
          background: rgba(255,255,255,0.09);
        }
        .field-select option { background: #1a1a2e; }
        .info-btn {
          width: 18px; height: 18px;
          border-radius: 50%;
          background: rgba(139,92,246,0.25);
          border: 1px solid rgba(139,92,246,0.4);
          color: #a78bfa;
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
          font-family: inherit;
        }
        .info-btn:hover { background: rgba(139,92,246,0.4); }
        .prompt-info-box {
          background: rgba(139,92,246,0.08);
          border: 1px solid rgba(139,92,246,0.25);
          border-radius: 10px;
          padding: 14px 16px;
          font-size: 0.82rem;
          color: rgba(255,255,255,0.65);
          line-height: 1.6;
          margin-bottom: 8px;
        }
        .prompt-info-box strong { color: #c4b5fd; }
        .prompt-info-box p { margin: 6px 0; }
        .prompt-info-box ul { margin: 6px 0 6px 18px; padding: 0; }
        .prompt-info-box li { margin-bottom: 4px; }
        .prompt-info-box code {
          background: rgba(255,255,255,0.1);
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 0.8rem;
          color: #e2e8f0;
        }
        .clone-action-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 14px;
        }
        .clone-submit-btn {
          width: 100%;
          padding: 18px 24px;
          border-radius: 14px;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          border: none;
          color: #fff;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          font-family: inherit;
        }
        .clone-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(139,92,246,0.4);
        }
        .clone-submit-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
        .clone-submit-btn.loading { background: linear-gradient(135deg, #4c3483, #7c2d5e); animation: pulse-btn 1.5s infinite; }
        @keyframes pulse-btn { 0%,100%{opacity:1} 50%{opacity:0.75} }
        .btn-inner { display: flex; align-items: center; justify-content: center; gap: 10px; }
        .spin-icon { animation: spin 1.5s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .progress-bar-wrap { height: 3px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
        .progress-bar-fill { height: 100%; width: 50%; background: linear-gradient(90deg, #8b5cf6, #ec4899); animation: progress-slide 1.8s ease-in-out infinite; }
        @keyframes progress-slide { 0%{transform:translateX(-120%)} 100%{transform:translateX(260%)} }
        .clone-error {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px;
          padding: 11px 15px;
          color: #fca5a5;
          font-size: 0.85rem;
        }
        .clone-result {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .result-header.warn {
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: 10px;
          padding: 12px 16px;
          color: #fcd34d;
          font-size: 0.88rem;
        }
        .preview-player {
          background: rgba(0,0,0,0.2);
          border-radius: 12px;
          padding: 16px;
        }
        .preview-label {
          font-size: 0.82rem;
          color: rgba(255,255,255,0.45);
          margin-bottom: 4px;
        }
        .result-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .btn-save {
          flex: 1;
          padding: 14px 20px;
          border-radius: 12px;
          background: linear-gradient(135deg, #059669, #10b981);
          border: none;
          color: #fff;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }
        .btn-save:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(16,185,129,0.35); }
        .btn-discard {
          padding: 14px 20px;
          border-radius: 12px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.5);
          font-size: 0.95rem;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }
        .btn-discard:hover { background: rgba(239,68,68,0.12); color: #fca5a5; border-color: rgba(239,68,68,0.25); }
        .result-status {
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 0.88rem;
          font-weight: 500;
        }
        .result-status.saving { background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.25); color: #c4b5fd; }
        .result-status.saved { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); color: #6ee7b7; }
        .result-status.discarded { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.35); }
        .clone-reset-btn {
          align-self: flex-start;
          padding: 10px 18px;
          border-radius: 10px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.6);
          font-size: 0.88rem;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
        }
        .clone-reset-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
      `}</style>
    </div>
  );
}
