from celery import Celery
from app.database import init_db, add_voice, update_job
import time
import os
import glob
import requests

try:
    from pydub import AudioSegment
    PYDUB_OK = True
except ImportError:
    PYDUB_OK = False

# OmniVoice FastAPI proxy — runs on the host server
OMNIVOICE_URL = os.environ.get("OMNIVOICE_URL", "http://192.168.10.87:8880")

redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "spik_worker",
    broker=redis_url,
    backend=redis_url
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    worker_concurrency=int(os.environ.get("WORKER_CONCURRENCY", 2)),
)

# Ensure DB table exists in the worker process too
init_db()

def cleanup_old_files():
    """Delete files older than 2 hours to prevent disk overload."""
    now = time.time()
    for directory in ["/app/data/outputs", "/app/data/uploads"]:
        if os.path.exists(directory):
            for f in glob.glob(f"{directory}/*"):
                if os.path.isfile(f) and "cut_" in f or "preview_" in f or "tts_" in f:
                    if os.stat(f).st_mtime < now - 7200:
                        try: os.remove(f)
                        except: pass

@celery_app.task(bind=True)
def process_audio_job(self, file_path: str, name: str, job_id: str,
                      language: str, prompt: str, emotion: str,
                      trim_start: float, trim_end: float):
    """Cut audio to the selected 10-second region and register clone."""
    self.update_state(state='PROGRESS', meta={'message': 'Cortando áudio...'})

    cut_path = file_path
    if PYDUB_OK:
        try:
            audio = AudioSegment.from_file(file_path)
            start_ms = int(trim_start * 1000)
            end_ms = int(trim_end * 1000)
            cut_audio = audio[start_ms:end_ms]
            cut_path = f"/app/data/uploads/cut_{job_id}.wav"
            cut_audio.export(cut_path, format="wav")
        except Exception as e:
            print(f"[SPIK] Audio cut error: {e}")

    self.update_state(state='PROGRESS', meta={'message': 'Registrando clone...'})
    time.sleep(1)  # Placeholder for future model feature extraction

    voice_id = f"clone_{job_id}"
    # Save voice to DB with real file path
    add_voice(voice_id, name, language, prompt, emotion, cut_path, "ready")

    return {
        "status": "completed",
        "voice_id": voice_id,
        "name": name,
        "file_path": cut_path,
    }


@celery_app.task(bind=True)
def clone_and_preview_job(self, file_path: str, name: str, job_id: str,
                          language: str, prompt: str, emotion: str,
                          trim_start: float, trim_end: float, test_text: str):
    """All-in-one: cut audio, call OmniVoice, save to DB, return preview URL."""
    cleanup_old_files()
    t0 = time.time()
    update_job(self.request.id, 'PROGRESS')
    self.update_state(state='PROGRESS', meta={'step': 'cutting', 'message': 'Cortando áudio de referência...'})

    # 1. Cut to selected region
    cut_path = file_path
    if PYDUB_OK:
        try:
            audio = AudioSegment.from_file(file_path)
            cut = audio[int(trim_start * 1000):int(trim_end * 1000)]
            cut_path = f"/app/data/uploads/cut_{job_id}.wav"
            cut.export(cut_path, format="wav")
        except Exception as e:
            print(f"[SPIK] Audio cut error: {e}")

    voice_id = f"clone_{job_id}"

    # 2. Call OmniVoice to generate preview
    self.update_state(state='PROGRESS', meta={'step': 'omnivoice', 'message': 'Gerando preview com OmniVoice...'})
    preview_filename = f"preview_{voice_id}_{int(time.time())}.mp3"
    preview_path = f"/app/data/outputs/{preview_filename}"
    preview_ok = False
    omni_error = None

    try:
        with open(cut_path, 'rb') as f:
            resp = requests.post(
                f"{OMNIVOICE_URL}/v1/audio/clone",
                files={'ref_audio': (os.path.basename(cut_path), f, 'audio/wav')},
                data={'text': test_text, 'language_id': language or 'pt'},
                timeout=120
            )
        resp.raise_for_status()
        with open(preview_path, 'wb') as f:
            f.write(resp.content)
        if os.path.getsize(preview_path) > 1000:
            preview_ok = True
        else:
            omni_error = 'OmniVoice returned empty audio'
            print(f"[SPIK] {omni_error}")
    except Exception as e:
        omni_error = str(e)
        print(f"[SPIK] OmniVoice clone error: {e}")
        open(preview_path, 'wb').close()

    duration = round(time.time() - t0, 2)
    update_job(
        self.request.id, 'SUCCESS' if preview_ok else 'FAILURE',
        output_filename=preview_filename if preview_ok else None,
        error=omni_error,
        duration_s=duration
    )

    # 3. Return all info — frontend decides whether to save to DB
    return {
        "status": "completed",
        "voice_id": voice_id,
        "name": name,
        "language": language,
        "prompt": prompt,
        "emotion": emotion,
        "file_path": cut_path,
        "preview_filename": preview_filename if preview_ok else None,
        "preview_ok": preview_ok,
        "duration_s": duration,
    }


@celery_app.task(bind=True)
def generate_tts_job(self, text: str, voice_id: str, speed: float, language: str = 'pt'):
    """Generate speech from text using OmniVoice with the cloned voice reference audio."""
    cleanup_old_files()
    t0 = time.time()
    update_job(self.request.id, 'PROGRESS')
    self.update_state(state='PROGRESS', meta={'message': 'Sintetizando voz no OmniVoice...'})

    output_filename = f"tts_{voice_id}_{int(time.time())}.wav"
    output_path = f"/app/data/outputs/{output_filename}"

    # Find the reference audio for this voice
    from app.database import get_voice
    voice = get_voice(voice_id)
    ref_audio_path = voice.get('file_path', '') if voice else ''
    tts_error = None

    try:
        if voice:
            if not ref_audio_path or not os.path.exists(ref_audio_path):
                raise FileNotFoundError(f"Áudio de referência do clone não encontrado (foi excluído do servidor). Por favor, crie o clone novamente.")
            
            with open(ref_audio_path, 'rb') as f:
                resp = requests.post(
                    f"{OMNIVOICE_URL}/v1/audio/clone",
                    files={'ref_audio': (os.path.basename(ref_audio_path), f, 'audio/wav')},
                    data={'text': text, 'language_id': language},
                    timeout=120
                )
        else:
            resp = requests.post(
                f"{OMNIVOICE_URL}/v1/audio/speech",
                json={'model': 'omnivoice', 'input': text, 'voice': voice_id},
                timeout=120
            )
        resp.raise_for_status()
        with open(output_path, 'wb') as f:
            f.write(resp.content)
    except Exception as e:
        tts_error = str(e)
        print(f"[SPIK] OmniVoice TTS error: {e}")
        open(output_path, 'wb').close()

    duration = round(time.time() - t0, 2)
    update_job(
        self.request.id,
        'FAILURE' if tts_error else 'SUCCESS',
        output_filename=output_filename if not tts_error else None,
        error=tts_error, duration_s=duration
    )
    return {
        'status': 'completed',
        'output_path': output_path,
        'output_filename': output_filename,
        'text_preview': text[:40],
        'duration_s': duration,
    }


@celery_app.task(bind=True)
def generate_preview_job(self, voice_id: str, test_text: str):
    """Quick audio preview using OmniVoice with the cloned voice reference audio."""
    cleanup_old_files()
    t0 = time.time()
    update_job(self.request.id, 'PROGRESS')
    self.update_state(state='PROGRESS', meta={'message': 'Gerando preview no OmniVoice...'})  

    output_filename = f"preview_{voice_id}_{int(time.time())}.mp3"
    output_path = f"/app/data/outputs/{output_filename}"

    from app.database import get_voice
    voice = get_voice(voice_id)
    ref_audio_path = voice.get('file_path', '') if voice else ''
    prev_error = None

    try:
        if ref_audio_path and os.path.exists(ref_audio_path):
            with open(ref_audio_path, 'rb') as f:
                resp = requests.post(
                    f"{OMNIVOICE_URL}/v1/audio/clone",
                    files={'ref_audio': (os.path.basename(ref_audio_path), f, 'audio/wav')},
                    data={'text': test_text, 'language_id': 'pt'},
                    timeout=120
                )
        else:
            resp = requests.post(
                f"{OMNIVOICE_URL}/v1/audio/speech",
                json={'model': 'omnivoice', 'input': test_text, 'voice': voice_id},
                timeout=120
            )
        resp.raise_for_status()
        with open(output_path, 'wb') as f:
            f.write(resp.content)
    except Exception as e:
        prev_error = str(e)
        print(f"[SPIK] OmniVoice preview error: {e}")
        open(output_path, 'wb').close()

    duration = round(time.time() - t0, 2)
    update_job(
        self.request.id,
        'FAILURE' if prev_error else 'SUCCESS',
        output_filename=output_filename if not prev_error else None,
        error=prev_error, duration_s=duration
    )
    return {
        'status': 'completed',
        'output_filename': output_filename,
        'voice_id': voice_id,
        'duration_s': duration,
    }
